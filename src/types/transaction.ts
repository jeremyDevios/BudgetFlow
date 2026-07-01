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
 *                    `envelopes` sub-collection.
 *  - `date`        – ISO-8601 string (e.g. "2026-07-03T12:00:00.000Z").
 *  - `isReimbursement` – when true the amount is a credit that reduces `spent`.
 */
export interface Transaction {
  /** Firestore document id. */
  id: string;

  /** Transaction amount in the user's currency. */
  amount: number;

  /** Short description / label for the transaction. */
  description: string;

  /** Firestore document id of the parent envelope. */
  envelopeId: string;

  /** ISO-8601 date string. */
  date: string;

  /** When true the amount is subtracted from spent (a credit/refund). */
  isReimbursement?: boolean;

  /** ISO-8601 creation timestamp. */
  createdAt?: string;

  /** ISO-8601 last-update timestamp. */
  updatedAt?: string;
}
