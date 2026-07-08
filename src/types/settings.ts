/**
 * Canonical web types for user budget settings.
 *
 * Used by: settingsService, onboarding/page.tsx, settings/page.tsx,
 * and any future UI surface that reads/writes user budget settings.
 *
 * Firestore path: users/{uid}/settings/general
 */

import { CurrencyCode } from "@/types/currency";

// ---------------------------------------------------------------------------
// Sub-items
// ---------------------------------------------------------------------------

/**
 * A single line item inside a detailed fixed-costs or savings breakdown.
 *
 * Invariant: `amount` must be ≥ 0.
 */
export interface BudgetSubItem {
  /** Stable unique identifier (e.g. crypto.randomUUID() or Date.now().toString()). */
  id: string;
  /** Display name shown in the UI, e.g. "Loyer", "Livret A". */
  name: string;
  /** Monthly amount in the user's currency. Must be ≥ 0. */
  amount: number;
}

// ---------------------------------------------------------------------------
// Derived enums / literals
// ---------------------------------------------------------------------------

/** Dashboard bento-grid density preset. */
export type BentoPreset = "compact" | "balanced" | "airy";

// ---------------------------------------------------------------------------
// Main settings document
// ---------------------------------------------------------------------------

/**
 * Canonical settings document stored at users/{uid}/settings/general.
 *
 * Invariants enforced at read time (see settingsService):
 *  - `fixedCostsDetailedEnabled` is treated as `false` when `fixedCostsItems` is empty.
 *  - `savingsDetailedEnabled`    is treated as `false` when `savingsItems`    is empty.
 *  - When a detailed mode is disabled, the corresponding aggregate field
 *    (`fixedCosts` / `monthlySavings`) is the source of truth.
 *  - Sub-items are preserved when their detailed mode is disabled so the user
 *    can re-enable the mode without data loss.
 */
export interface UserSettings {
  /** Net monthly income in the user's currency. */
  monthlyIncome: number;

  /**
   * Whether the user has a fixed monthly income (true) or variable (false).
   * When false, the dashboard shows a per-month income update button.
   * Defaults to true for backward compatibility.
   */
  isFixedIncome: boolean;

  /**
   * Aggregate fixed costs.
   * Source of truth when `fixedCostsDetailedEnabled` is false.
   */
  fixedCosts: number;

  /**
   * Aggregate monthly savings target.
   * Source of truth when `savingsDetailedEnabled` is false.
   */
  monthlySavings: number;

  /** Dashboard grid density preference. */
  bentoPreset: BentoPreset;

  /**
   * Display-only currency code controlling how amounts are rendered.
   * No conversion is performed — stored amounts are always raw numbers.
   * Legacy documents that do not store this field default to `"EUR"`.
   */
  currency: CurrencyCode;

  /**
   * Display-only privacy mode for masking currency amounts in the web UI.
   * Legacy documents that do not store this field default to `false`.
   */
  anonymousMode?: boolean;

  // ── Detailed mode ──────────────────────────────────────────────────────────

  /**
   * When `true`, fixed costs are broken down into `fixedCostsItems`.
   * Automatically treated as `false` when `fixedCostsItems` is empty.
   */
  fixedCostsDetailedEnabled: boolean;

  /**
   * When `true`, savings targets are broken down into `savingsItems`.
   * Automatically treated as `false` when `savingsItems` is empty.
   */
  savingsDetailedEnabled: boolean;

  /**
   * Individual fixed-cost sub-items (e.g. "Loyer", "Électricité").
   * Preserved even when detailed mode is disabled.
   */
  fixedCostsItems: BudgetSubItem[];

  /**
   * Individual savings sub-items (e.g. "Livret A", "PEA").
   * Preserved even when detailed mode is disabled.
   */
  savingsItems: BudgetSubItem[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Default settings applied to any field missing in existing Firestore documents.
 *
 * Guarantees retrocompatibility: documents created before the detailed-mode
 * feature was introduced will default to `false` / empty arrays, preserving
 * existing aggregate-only behaviour unchanged.
 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  monthlyIncome: 0,
  isFixedIncome: true,
  fixedCosts: 0,
  monthlySavings: 0,
  bentoPreset: "balanced",
  currency: "EUR",
  anonymousMode: false,
  fixedCostsDetailedEnabled: false,
  savingsDetailedEnabled: false,
  fixedCostsItems: [],
  savingsItems: [],
};
