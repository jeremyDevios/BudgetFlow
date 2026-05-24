/**
 * calendarSeverity.ts
 *
 * Pure severity computation for calendar heatmap cells.
 * Must stay in sync with the iOS/widget implementation exactly.
 *
 * Rule:
 *   ratio = totalDaySpend / totalMonthlyBudget
 *   - no spend             → "login-only"
 *   - budget = 0, spend > 0 → "heavy-spend"
 *   - ratio <= 0.20        → "low-spend"
 *   - ratio <= 0.50        → "moderate-spend"
 *   - ratio > 0.50         → "heavy-spend"
 */

export type SpendSeverity =
  | "login-only"
  | "low-spend"
  | "moderate-spend"
  | "heavy-spend";

/**
 * Computes the spend severity for a single day.
 *
 * @param totalDaySpend     - Sum of all transaction amounts on that day (>= 0).
 * @param totalMonthlyBudget - Total visible monthly budget (sum of envelope budgets).
 * @returns The severity for that day.
 */
export function computeSpendSeverity(
  totalDaySpend: number,
  totalMonthlyBudget: number
): SpendSeverity {
  if (totalDaySpend <= 0) return "login-only";
  if (totalMonthlyBudget <= 0) return "heavy-spend";

  const ratio = totalDaySpend / totalMonthlyBudget;
  if (ratio <= 0.20) return "low-spend";
  if (ratio <= 0.50) return "moderate-spend";
  return "heavy-spend";
}

export interface EnvelopeSpendEntry {
  spend: number;
  budget: number;
}

/**
 * Computes severity from the worst (highest) ratio across all envelopes
 * that have spend on the day. Entries with spend <= 0 are ignored.
 * Falls back to "login-only" when no entry has spend > 0.
 */
export function computeSpendSeverityFromEnvelopes(
  entries: EnvelopeSpendEntry[]
): SpendSeverity {
  const active = entries.filter(e => e.spend > 0);
  if (active.length === 0) return "login-only";
  if (active.some(e => e.budget <= 0)) return "heavy-spend";
  const maxRatio = Math.max(...active.map(e => e.spend / e.budget));
  if (maxRatio <= 0.20) return "low-spend";
  if (maxRatio <= 0.50) return "moderate-spend";
  return "heavy-spend";
}
