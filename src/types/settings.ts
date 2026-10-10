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
// Version history (dated budget values)
// ---------------------------------------------------------------------------

/**
 * A single line item inside a versioned fixed-costs or savings snapshot.
 * Mirrors the iOS `BudgetVersionItem` (BudgetVersionTimeline.swift).
 */
export interface BudgetVersionItem {
  /** Stable unique identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Monthly amount in the user's currency. Must be ≥ 0. */
  amount: number;
  /** Display order within the snapshot. */
  order?: number;
}

/**
 * One dated version of a budget value (income, fixed costs or savings).
 *
 * Stored in the settings document under `incomeHistory`,
 * `fixedCostsHistory` and `savingsHistory`. Absent/empty history means the
 * flat fields apply to every month (legacy behaviour, no migration).
 *
 * Invariants (guaranteed by the iOS `BudgetVersionTimeline` engine, tolerated
 * at read time by `sanitizeBudgetVersionHistory`):
 *  - sorted by ascending `startDate`;
 *  - no overlap (`v[i].endDate` is the day before `v[i+1].startDate`);
 *  - `endDate` is `null` only on the last entry (the active version);
 *  - at most 100 entries per history (SEC-24).
 */
export interface BudgetVersionEntry {
  /** Stable unique identifier. */
  id: string;
  /** Effective start day, `YYYY-MM-DD`. */
  startDate: string;
  /** Last effective day, `YYYY-MM-DD`. `null` = still active. */
  endDate: string | null;
  /** Value for `incomeHistory`. */
  amount?: number;
  /** Value for `fixedCostsHistory` / `savingsHistory`. */
  total?: number;
  /** Detailed-mode flag (fixed-costs/savings histories only). */
  detailedEnabled?: boolean;
  /** Full item snapshot (fixed-costs/savings histories only). */
  items?: BudgetVersionItem[];
  /** ISO 8601 timestamp of the last write. */
  updatedAt: string;
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

  // ── Version history ───────────────────────────────────────────────────────

  /**
   * Dated versions of the fixed income. Only meaningful when
   * `isFixedIncome` is true (variable income uses the `monthlyIncomes`
   * subcollection). Absent → `monthlyIncome` applies to every month.
   */
  incomeHistory?: BudgetVersionEntry[];

  /**
   * Dated versions of the fixed costs. Absent → `fixedCosts` /
   * `fixedCostsItems` apply to every month.
   */
  fixedCostsHistory?: BudgetVersionEntry[];

  /**
   * Dated versions of the savings target. Absent → `monthlySavings` /
   * `savingsItems` apply to every month.
   */
  savingsHistory?: BudgetVersionEntry[];

  // ── Custom budget month (date de tombée du salaire) ──────────────────────

  /**
   * Opt-in : le mois budgétaire commence le jour de tombée du salaire
   * (`customMonthStartDay`, surchargé par mois via
   * `customMonthStartOverrides`). Absent/false → mois calendaires
   * (comportement historique, aucune migration).
   */
  customMonthEnabled?: boolean;

  /**
   * Jour de paie commun à tous les mois (1..28). Absent → 1 = mois
   * calendaire. Seules les valeurs 1..28 sont acceptées (29-31 clampés /
   * rejetés : février n'a pas ces jours).
   */
  customMonthStartDay?: number;

  /**
   * Jour de paie par mois : `"YYYY-MM"` → jour (1..28). Surcharge
   * `customMonthStartDay` pour les mois listés. Absent → `{}`. Borné à
   * 100 entrées (SEC-24) ; les valeurs sont validées côté client
   * (Firestore Security Rules ne peut pas itérer les clés d'une map).
   */
  customMonthStartOverrides?: Record<string, number>;
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
  customMonthEnabled: false,
  customMonthStartDay: 1,
  customMonthStartOverrides: {},
};
