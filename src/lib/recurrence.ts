/**
 * Pure recurrence helpers for the web app — the counterpart of the iOS
 * `RecurrenceEngine`. No Firebase dependency; every function is unit-tested.
 *
 * A recurring expense series is a set of `transactions` documents sharing the
 * same `recurrenceId`. Each occurrence carries its own `recurrenceAnchorDay`
 * (nominal day of month in effect for the series) and, once the series is
 * stopped, a `recurrenceEndDate` marking the last allowed month.
 *
 * Dates are ISO-8601 strings ("YYYY-MM-DDTHH:mm:ss.sssZ") as stored by the
 * rest of the app. Month keys are "YYYY-MM" strings. All date math runs in UTC
 * so generated occurrences are unambiguous and match the dashboard's
 * month-boundary filters.
 */

/**
 * Horizon de matérialisation : les occurrences des `MATERIALIZED_MONTHS_AHEAD`
 * mois au-delà du mois courant sont créées dès l'activation de la série
 * (décision produit, alignée sur l'iOS) — les mois à venir sont visibles
 * dans l'UI sans attendre le rattrapage.
 */
export const MATERIALIZED_MONTHS_AHEAD = 3;

// ── Month keys ───────────────────────────────────────────────────────

const MONTH_KEY_REGEX = /^(\d{4})-(\d{2})/;

/** "YYYY-MM" key of a date string or Date — "2026-08-23T…" → "2026-08". */
export function monthKey(date: string | Date): string {
  if (typeof date === "string") {
    const match = MONTH_KEY_REGEX.exec(date);
    if (match) return match[0];
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The month key immediately preceding `monthKey` — "2026-01" → "2025-12". */
export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (month <= 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

/**
 * The `count` month keys strictly following `fromMonthKey`, ascending —
 * "2026-11" + 3 → ["2026-12", "2027-01", "2027-02"].
 */
export function nextMonthKeys(fromMonthKey: string, count: number): string[] {
  const [yearStr, monthStr] = fromMonthKey.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    result.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return result;
}

// ── Occurrence math ──────────────────────────────────────────────────

/** Nominal day of month (1…31) of a date — the anchor of a new series. */
export function nominalAnchorDay(date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getDate();
}

/**
 * ISO date of the occurrence inside `monthKey`: day =
 * min(anchorDay, last real day of the month), in UTC.
 * 31 Jan → 28/29 Feb → back to 31 Mar.
 */
export function occurrenceDate(anchorDay: number, monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // day 0 = last day of `month`
  const day = Math.max(1, Math.min(anchorDay, lastDay));
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

/** Last millisecond of `monthKey`, as an ISO string — stamps `recurrenceEndDate`. */
export function endOfMonthIso(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1) - 1).toISOString();
}

/**
 * Deterministic Firestore document id for a recurring occurrence:
 * "<recurrenceId>_<YYYY-MM>". Two devices generating the same occurrence
 * write the same document → last-write-wins convergence, no duplicates.
 */
export function firestoreDocumentId(recurrenceId: string, monthKey: string): string {
  return `${recurrenceId}_${monthKey}`;
}

// ── Generation planning ──────────────────────────────────────────────

/**
 * Missing months to generate for a new series whose first expense sits in
 * `tailMonthKey`: strictly after the tail month, up to and including
 * `upToMonthKey` (default: current month + MATERIALIZED_MONTHS_AHEAD).
 * Empty when the tail month is not before `upToMonthKey` (no retroactivity).
 */
export function missingMonthKeys(
  tailMonthKey: string,
  upToMonthKey: string,
): string[] {
  if (tailMonthKey >= upToMonthKey) return [];
  const months = nextMonthKeys(tailMonthKey, 120); // safety bound
  const result: string[] = [];
  for (const month of months) {
    if (month > upToMonthKey) break;
    result.push(month);
  }
  return result;
}

// ── Deletion policy ──────────────────────────────────────────────────

/**
 * Deletion of a recurring occurrence requires a confirmation popup when the
 * occurrence belongs to the current month or a future month: deleting it also
 * deletes the following occurrences. Past occurrences delete individually.
 */
export function requiresDeletionConfirmation(
  occurrenceDate: string,
  isRecurring: boolean,
  now: Date = new Date(),
): boolean {
  if (!isRecurring) return false;
  return monthKey(occurrenceDate) >= monthKey(now);
}
