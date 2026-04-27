/**
 * Canonical web envelope type.
 *
 * Used by: Dashboard, Settings, TransactionModal, SearchDropdown, and any
 * future surface that reads from the Firestore `envelopes` sub-collection.
 *
 * Firestore stores envelopes under:
 *   users/{uid}/envelopes/{envelopeId}
 *
 * Field notes:
 *  - `spent`     – runtime-aggregated from transactions; not stored in Firestore.
 *                  Optional here so Settings (which does not always aggregate)
 *                  can reuse the same type.
 *  - `order`     – drag-and-drop sort index; present after the user has reordered.
 *  - `tileSize`  – bento-grid size override set by the user on the Dashboard.
 *  - `isTemporary` – when true the envelope should only appear in the months
 *                  listed in `activeMonths`.  Absent / false = always active.
 *  - `activeMonths` – ISO-8601 year-month strings (YYYY-MM) that define the
 *                  months a temporary envelope is visible.  Ignored when
 *                  `isTemporary` is falsy.
 */
export interface Envelope {
  /** Firestore document id. */
  id: string;

  /** Display name shown on tiles and in pickers. */
  name: string;

  /** Lucide icon key (e.g. "ShoppingCart"). */
  icon: string;

  /** Tailwind background-color class (e.g. "bg-amber-500"). */
  color: string;

  /** Monthly budget ceiling in the user's currency. */
  budget: number;

  /**
   * Amount spent in the currently viewed month.
   * Aggregated at runtime from transactions; not persisted to Firestore.
   * Optional so that surfaces which don't aggregate (e.g. Settings) can
   * still use this type without a placeholder value.
   */
  spent?: number;

  /** Drag-and-drop order index within the bento grid. */
  order?: number;

  /** Per-envelope tile size override on the Dashboard bento grid. */
  tileSize?: "small" | "wide" | null;

  /**
   * When true, this envelope only participates in months listed in
   * `activeMonths`.  Non-temporary envelopes are always active.
   */
  isTemporary?: boolean;

  /**
   * Exhaustive list of months (YYYY-MM) in which a temporary envelope is
   * visible.  Undefined or empty is treated as "no active months" for a
   * temporary envelope.
   *
   * Contract: strings must match /^\d{4}-\d{2}$/ (YYYY-MM).
   *
   * Examples: ["2024-11", "2024-12", "2025-01"]
   */
  activeMonths?: string[];
}

/**
 * Determines whether an envelope should be displayed for the given month.
 *
 * Rules:
 *  1. A non-temporary envelope (`isTemporary` absent or false) is always active.
 *  2. A temporary envelope is active only when `selectedMonth` appears in its
 *     `activeMonths` array.
 *  3. A temporary envelope with no `activeMonths` (or an empty array) is never
 *     active, because it has not been assigned to any month yet.
 *
 * @param envelope     - The envelope to evaluate.
 * @param selectedMonth - The month to check, formatted as YYYY-MM.
 * @returns `true` if the envelope should be visible for that month.
 *
 * @example
 * // Always shown – regular envelope
 * isEnvelopeActiveForMonth({ id: "1", isTemporary: false, ... }, "2025-03") // → true
 *
 * @example
 * // Temporary, and the month is in the list
 * isEnvelopeActiveForMonth({ id: "2", isTemporary: true, activeMonths: ["2025-03"] }, "2025-03") // → true
 *
 * @example
 * // Temporary, but the month is NOT in the list
 * isEnvelopeActiveForMonth({ id: "3", isTemporary: true, activeMonths: ["2025-01"] }, "2025-03") // → false
 */
export function isEnvelopeActiveForMonth(
  envelope: Pick<Envelope, "isTemporary" | "activeMonths">,
  selectedMonth: string,
): boolean {
  if (!envelope.isTemporary) {
    return true;
  }

  return Array.isArray(envelope.activeMonths) &&
    envelope.activeMonths.includes(selectedMonth);
}
