/**
 * Canonical web transaction type.
 *
 * Used by: TransactionModal, EnvelopeDetailClient, Dashboard, SearchDropdown,
 * envelopeService, and any surface that reads from the Firestore `transactions`
 * sub-collection.
 *
 * Firestore stores transactions under:
 *   users/{uid}/transactions/{transactionId}
 *
 * Field notes:
 *  - `envelopeId`  – foreign key referencing an envelope document in the
 *                    `envelopes` sub-collection. Absent for income transactions.
 *  - `date`        – ISO-8601 string (e.g. "2026-07-03T12:00:00.000Z").
 *  - `isReimbursement` – when true the amount is a credit that reduces `spent`.
 *                        Only meaningful for expense transactions.
 *  - `type`        – "expense" (default) or "income". Absent = expense
 *                    for backward compatibility.
 *  - `source`      – income category label. Only present when type === "income".
 */

/** Allowed income source categories. */
export const INCOME_SOURCES = [
  "Prime",
  "Freelance",
  "Vente",
  "Cadeau",
  "Bonus",
  "Autre",
] as const;

export type IncomeSource = (typeof INCOME_SOURCES)[number];

export interface Transaction {
  /** Firestore document id. */
  id: string;

  /** Transaction amount in the user's currency. */
  amount: number;

  /** Short description / label for the transaction. */
  description: string;

  /** Firestore document id of the parent envelope. Absent for income. */
  envelopeId?: string;

  /** ISO-8601 date string. */
  date: string;

  /** Transaction kind. "expense" (default) or "income". */
  type?: "expense" | "income";

  /** Income category. Only meaningful when type === "income". */
  source?: IncomeSource;

  /** When true the amount is subtracted from spent (a credit/refund). */
  isReimbursement?: boolean;

  /** ISO-8601 creation timestamp. */
  createdAt?: string;

  /** ISO-8601 last-update timestamp. */
  updatedAt?: string;

  /**
   * Recurring series id (iOS feature). Shared by all monthly occurrences of
   * the same series. Absent for plain transactions. Optional so old documents
   * and old clients keep working.
   */
  recurrenceId?: string;

  /** Nominal day of month (1..31) in effect for the series. Optional. */
  recurrenceAnchorDay?: number;

  /**
   * ISO-8601 end date: last month allowed for the series. Set on kept
   * occurrences when the series is stopped. Absent = series active.
   */
  recurrenceEndDate?: string;
}
