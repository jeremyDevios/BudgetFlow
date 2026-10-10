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
import { sanitizeCustomMonthConfig } from "@/lib/budgetMonth";
import { resolveCurrencyCode } from "@/types/currency";
import {
  BentoPreset,
  BudgetSubItem,
  BudgetVersionEntry,
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

/**
 * Validates and sanitizes an unknown value into a `BudgetVersionEntry[]`.
 *
 * Retrocompatible and tolerant by design: legacy documents without history
 * keys yield `[]` (the flat fields remain the source of truth for all
 * months). Malformed entries are dropped rather than throwing, mirroring
 * `sanitizeSubItems`. The list is capped at 100 entries (SEC-24) and sorted
 * by `startDate`.
 *
 * A valid entry carries an `id` (≤ 100 chars), a `startDate` matching
 * `YYYY-MM-DD`, an `endDate` that is either `null` or a `YYYY-MM-DD` day
 * ≥ `startDate`, an `amount` OR `total` in 0..100000000, an optional
 * `detailedEnabled` boolean, optional `items` (sanitized via
 * `sanitizeSubItems`) and an `updatedAt` string.
 */
export function sanitizeBudgetVersionHistory(value: unknown): BudgetVersionEntry[] {
  if (!Array.isArray(value)) return [];
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  const sanitized: BudgetVersionEntry[] = [];
  for (const raw of value.slice(0, 100)) {
    if (raw === null || typeof raw !== "object") continue;
    const candidate = raw as Record<string, unknown>;

    if (typeof candidate.id !== "string" || candidate.id.length === 0 || candidate.id.length > 100) {
      continue;
    }
    if (typeof candidate.startDate !== "string" || !datePattern.test(candidate.startDate)) {
      continue;
    }
    let endDate: string | null;
    if (candidate.endDate === null) {
      endDate = null;
    } else if (typeof candidate.endDate === "string" && datePattern.test(candidate.endDate)) {
      endDate = candidate.endDate;
    } else {
      continue;
    }
    // Lexicographic comparison is chronological for zero-padded dates.
    if (endDate !== null && endDate < candidate.startDate) continue;

    const amount = typeof candidate.amount === "number" ? candidate.amount : undefined;
    const total = typeof candidate.total === "number" ? candidate.total : undefined;
    const numeric = amount ?? total;
    if (
      numeric === undefined ||
      !Number.isFinite(numeric) ||
      numeric < 0 ||
      numeric > 100000000
    ) {
      continue;
    }

    const items = candidate.items === undefined ? undefined : sanitizeSubItems(candidate.items);
    const detailedEnabled =
      typeof candidate.detailedEnabled === "boolean" ? candidate.detailedEnabled : undefined;
    if (typeof candidate.updatedAt !== "string" || candidate.updatedAt.length > 30) continue;

    const entry: BudgetVersionEntry = {
      id: candidate.id,
      startDate: candidate.startDate,
      endDate,
      updatedAt: candidate.updatedAt,
    };
    if (amount !== undefined) entry.amount = amount;
    if (total !== undefined) entry.total = total;
    if (detailedEnabled !== undefined) entry.detailedEnabled = detailedEnabled;
    if (items !== undefined) entry.items = items;
    sanitized.push(entry);
  }

  return sanitized.sort((a, b) => a.startDate.localeCompare(b.startDate));
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
 * Sanitizes the custom-month fields of a partial settings payload before
 * writing to Firestore. Invalid values are dropped rather than written
 * (the read-time sanitizer in `sanitizeStoredSettingsDocument` covers the
 * case of malformed documents already in Firestore).
 */
export function normalizeCustomMonthFields(
  partial: Partial<UserSettings>,
): Partial<UserSettings> {
  const result: Partial<UserSettings> = { ...partial };

  if (
    "customMonthEnabled" in result &&
    typeof result.customMonthEnabled !== "boolean"
  ) {
    delete result.customMonthEnabled;
  }
  if ("customMonthStartDay" in result) {
    const day = result.customMonthStartDay;
    if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 28) {
      delete result.customMonthStartDay;
    }
  }
  if ("customMonthStartOverrides" in result) {
    const cleaned = sanitizeCustomMonthConfig({
      customMonthStartOverrides: result.customMonthStartOverrides,
    }).overrides;
    if (Object.keys(cleaned).length > 0) {
      result.customMonthStartOverrides = cleaned;
    } else {
      delete result.customMonthStartOverrides;
    }
  }

  return result;
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
 *  - Custom-month fields are sanitized via `normalizeCustomMonthFields`.
 *
 * Callers that only update the flag (without touching the items list) are not
 * affected by this normalization — the read-time enforcement in `loadSettings`
 * covers that case.
 */
export function normalizeSettingsPayload(
  partial: Partial<UserSettings>,
): Partial<UserSettings> {
  let result: Partial<UserSettings> = { ...partial };

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

  result = normalizeCustomMonthFields(result);

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

  // Version histories: sanitized and passed through so that a settings write
  // from a legacy web client no longer wipes them (retrocompat with iOS 1.05).
  const incomeHistory = sanitizeBudgetVersionHistory(raw.incomeHistory);
  const fixedCostsHistory = sanitizeBudgetVersionHistory(raw.fixedCostsHistory);
  const savingsHistory = sanitizeBudgetVersionHistory(raw.savingsHistory);

  // Custom budget month: sanitized and passed through for the same reason —
  // a settings write from any client must never wipe iOS-written fields.
  const customMonth = sanitizeCustomMonthConfig(raw);
  const hasCustomMonth =
    customMonth.enabled ||
    customMonth.startDay !== 1 ||
    Object.keys(customMonth.overrides).length > 0;

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
    // History keys are only kept when non-empty: legacy documents keep their
    // exact shape and empty histories converge with the iOS payload builder.
    ...(incomeHistory.length > 0 ? { incomeHistory } : {}),
    ...(fixedCostsHistory.length > 0 ? { fixedCostsHistory } : {}),
    ...(savingsHistory.length > 0 ? { savingsHistory } : {}),
    // Custom-month keys follow the same rule: absent unless non-default.
    ...(hasCustomMonth
      ? {
          customMonthEnabled: customMonth.enabled,
          customMonthStartDay: customMonth.startDay,
          customMonthStartOverrides: customMonth.overrides,
        }
      : {}),
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
    ...(stored.incomeHistory?.length ? { incomeHistory: stored.incomeHistory } : {}),
    ...(stored.fixedCostsHistory?.length ? { fixedCostsHistory: stored.fixedCostsHistory } : {}),
    ...(stored.savingsHistory?.length ? { savingsHistory: stored.savingsHistory } : {}),
    ...(stored.customMonthEnabled ? { customMonthEnabled: stored.customMonthEnabled } : {}),
    ...(stored.customMonthStartDay && stored.customMonthStartDay !== 1
      ? { customMonthStartDay: stored.customMonthStartDay }
      : {}),
    ...(stored.customMonthStartOverrides &&
    Object.keys(stored.customMonthStartOverrides).length > 0
      ? { customMonthStartOverrides: stored.customMonthStartOverrides }
      : {}),
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
