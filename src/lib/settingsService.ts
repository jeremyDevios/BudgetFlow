/**
 * Firestore read/write helpers for user budget settings.
 *
 * All Firestore operations are scoped to:
 *   users/{uid}/settings/general
 *
 * The pure helper functions (sanitize, compute, resolve) have no side effects
 * and can be tested in isolation without a Firestore connection.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import { resolveCurrencyCode } from "@/types/currency";
import {
  BentoPreset,
  BudgetSubItem,
  DEFAULT_USER_SETTINGS,
  UserSettings,
} from "@/types/settings";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Resolves an unknown Firestore value to a valid `BentoPreset`.
 * Falls back to `"balanced"` for any unrecognised value.
 */
export function resolveBentoPreset(value: unknown): BentoPreset {
  if (value === "compact" || value === "balanced" || value === "airy") {
    return value;
  }
  return "balanced";
}

/**
 * Validates and sanitizes an unknown value into a `BudgetSubItem[]`.
 *
 * Malformed entries are silently dropped so that documents with unexpected
 * Firestore shapes degrade gracefully rather than throwing.
 */
export function sanitizeSubItems(value: unknown): BudgetSubItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 100) // SEC-24 : cap aligné sur la limite des règles Firestore —
    // borne la taille maximale du document settings.
    .filter((item): item is BudgetSubItem => {
      if (item === null || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        candidate.id.length > 0 &&
        candidate.id.length <= 100 &&
        typeof candidate.name === "string" &&
        candidate.name.length <= 100 &&
        typeof candidate.amount === "number" &&
        Number.isFinite(candidate.amount) &&
        candidate.amount >= 0 &&
        candidate.amount <= 100000000
      );
    });
}

/**
 * Sums the `amount` of every item in a `BudgetSubItem` array.
 * Returns `0` for an empty array.
 */
export function computeDetailedTotal(items: BudgetSubItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/**
 * Resolves the effective monthly income for a given month.
 *
 * Resolution order:
 * 1. Explicit entry for the requested month (if it exists).
 * 2. Most recent past month with an entry (if any).
 * 3. Global `fallbackIncome` (the `monthlyIncome` field from settings).
 *
 * Month keys are `"YYYY-MM"` strings, so lexicographic ordering matches
 * chronological ordering (e.g. `"2025-12" < "2026-01"`).
 *
 * @param month          - The month to resolve, in `YYYY-MM` format.
 * @param monthlyIncomes - Map of month → amount (from Firestore subcollection).
 * @param fallbackIncome - Global fallback when no entry exists.
 * @returns The effective income for the given month.
 */
export function resolveMonthlyIncome(
  month: string,
  monthlyIncomes: Record<string, number>,
  fallbackIncome: number,
): number {
  // 1. Exact match for the requested month.
  if (monthlyIncomes[month] !== undefined) {
    return monthlyIncomes[month];
  }

  // 2. Most recent past month with an entry.
  const pastKeys = Object.keys(monthlyIncomes)
    .filter((k) => k < month)
    .sort();

  if (pastKeys.length > 0) {
    return monthlyIncomes[pastKeys[pastKeys.length - 1]];
  }

  // 3. Global fallback.
  return fallbackIncome;
}

/** Creates a new empty detailed-budget line with a stable client-side id. */
export function createEmptyBudgetSubItem(): BudgetSubItem {
  const supportsRandomUuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
  return {
    id: supportsRandomUuid ? crypto.randomUUID() : String(Date.now()),
    name: "",
    amount: 0,
  };
}

/**
 * Enforces the invariant: detailed mode is `false` when there are no sub-items.
 *
 * @param enabled - The stored boolean flag.
 * @param items   - The associated sub-items array.
 * @returns `true` only when `enabled` is `true` AND at least one item exists.
 *
 * @example
 * resolveDetailedEnabled(true, [])         // → false  (no items → mode off)
 * resolveDetailedEnabled(true, [item])     // → true
 * resolveDetailedEnabled(false, [item])    // → false  (user disabled it)
 */
export function resolveDetailedEnabled(
  enabled: boolean,
  items: BudgetSubItem[],
): boolean {
  return enabled && items.length > 0;
}

/**
 * Normalizes a partial settings payload before writing to Firestore.
 *
 * Rules applied at save time (mirrors the read-time invariant in `loadSettings`):
 *  - Items arrays are sanitized via `sanitizeSubItems` (malformed entries dropped).
 *  - If a sanitized items list is empty, the corresponding detailed-mode flag is
 *    forced to `false` to satisfy the invariant "flag is false when no items exist".
 *  - Items are NEVER deleted when the flag is `false`; they are preserved so the
 *    user can re-enable detailed mode without data loss.
 *
 * Callers that only update the flag (without touching the items list) are not
 * affected by this normalization — the read-time enforcement in `loadSettings`
 * covers that case.
 */
export function normalizeSettingsPayload(
  partial: Partial<UserSettings>,
): Partial<UserSettings> {
  const result: Partial<UserSettings> = { ...partial };

  if ("fixedCostsItems" in result) {
    const items = sanitizeSubItems(result.fixedCostsItems);
    result.fixedCostsItems = items;
    // Invariant: flag must be false when the items list is empty.
    if (items.length === 0) {
      result.fixedCostsDetailedEnabled = false;
    }
  }

  if ("savingsItems" in result) {
    const items = sanitizeSubItems(result.savingsItems);
    result.savingsItems = items;
    if (items.length === 0) {
      result.savingsDetailedEnabled = false;
    }
  }

  return result;
}

interface StoredSettingsDocument extends UserSettings {
  isOnboarded: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function sanitizeStoredSettingsDocument(raw: Record<string, unknown>): StoredSettingsDocument {
  const fixedCostsItems = sanitizeSubItems(raw.fixedCostsItems);
  const savingsItems = sanitizeSubItems(raw.savingsItems);

  return {
    monthlyIncome: Number(raw.monthlyIncome ?? DEFAULT_USER_SETTINGS.monthlyIncome),
    isFixedIncome: raw.isFixedIncome !== false, // default true for backward compat
    fixedCosts: Number(raw.fixedCosts ?? DEFAULT_USER_SETTINGS.fixedCosts),
    monthlySavings: Number(raw.monthlySavings ?? DEFAULT_USER_SETTINGS.monthlySavings),
    bentoPreset: resolveBentoPreset(raw.bentoPreset),
    anonymousMode: raw.anonymousMode === true,
    fixedCostsItems,
    savingsItems,
    fixedCostsDetailedEnabled: resolveDetailedEnabled(
      raw.fixedCostsDetailedEnabled === true,
      fixedCostsItems,
    ),
    savingsDetailedEnabled: resolveDetailedEnabled(
      raw.savingsDetailedEnabled === true,
      savingsItems,
    ),
    isOnboarded: raw.isOnboarded !== false,
    currency: resolveCurrencyCode(raw.currency),
    ...(typeof raw.createdAt === "string" ? { createdAt: raw.createdAt } : {}),
    ...(typeof raw.updatedAt === "string" ? { updatedAt: raw.updatedAt } : {}),
  };
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

/** Returns the Firestore DocumentReference for a user's settings. */
function settingsDocRef(uid: string) {
  return doc(db, "users", uid, "settings", "general");
}

/**
 * Loads the user's settings from Firestore and merges defaults for any
 * missing fields.
 *
 * Retrocompatible: documents that pre-date the detailed-mode feature will
 * transparently default to `fixedCostsDetailedEnabled = false`, empty arrays,
 * etc., preserving existing aggregate-only behaviour.
 *
 * @throws Re-throws Firestore errors so callers can surface them to the user.
 */
export async function loadSettings(uid: string): Promise<UserSettings> {
  const snap = await getDoc(settingsDocRef(uid));

  if (!snap.exists()) {
    logger.info(`settingsService.loadSettings: document absent, returning defaults for uid ${uid}`);
    return { ...DEFAULT_USER_SETTINGS };
  }

  const stored = sanitizeStoredSettingsDocument(snap.data() as Record<string, unknown>);
  return {
    isFixedIncome: stored.isFixedIncome,
    monthlyIncome: stored.monthlyIncome,
    fixedCosts: stored.fixedCosts,
    monthlySavings: stored.monthlySavings,
    bentoPreset: stored.bentoPreset,
    currency: stored.currency,
    anonymousMode: stored.anonymousMode,
    fixedCostsDetailedEnabled: stored.fixedCostsDetailedEnabled,
    savingsDetailedEnabled: stored.savingsDetailedEnabled,
    fixedCostsItems: stored.fixedCostsItems,
    savingsItems: stored.savingsItems,
  };
}

/**
 * Saves a partial settings update to Firestore using a canonical overwrite.
 *
 * Before writing, the existing document is reloaded and sanitized so legacy or
 * malformed fields do not keep failing the Firestore allow-list rules. Missing
 * `isOnboarded` is healed to `true` for already accessible settings pages.
 *
 * @throws Re-throws Firestore errors so callers can surface them to the user.
 */
export async function saveSettings(
  uid: string,
  partial: Partial<UserSettings>,
): Promise<void> {
  // Enforce write-time invariants (empty items list → flag forced to false).
  const normalized = normalizeSettingsPayload(partial);
  logger.info(
    `settingsService.saveSettings: persisting fields [${Object.keys(normalized).join(", ")}] for uid ${uid}`,
  );
  const ref = settingsDocRef(uid);
  const snap = await getDoc(ref);
  const existing = snap.exists()
    ? sanitizeStoredSettingsDocument(snap.data() as Record<string, unknown>)
    : { ...DEFAULT_USER_SETTINGS, isOnboarded: true };
  const nextDocument: StoredSettingsDocument = {
    ...existing,
    ...normalized,
  };

  await setDoc(ref, nextDocument);
}
