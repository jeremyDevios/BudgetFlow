/**
 * Envelope service — Firestore batch operations for envelope deletion
 * with transaction migration.
 *
 * Centralises all multi-document Firestore writes so that the three
 * deletion options (migrate-to-existing, create-and-migrate, delete-all)
 * are atomic where possible and consistent across call sites.
 */

import {
  doc,
  getDocs,
  query,
  where,
  collection,
  writeBatch,
  increment,
  addDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getMonthKey } from "@/lib/validation";
import { type Transaction } from "@/types/transaction";

// ── Helpers ──────────────────────────────────────────────────────────

/** Maximum number of operations per Firestore writeBatch (hard limit). */
const BATCH_LIMIT = 500;

/**
 * Splits an array into chunks of at most `size` elements.
 * Used to stay under the 500-operation Firestore batch limit.
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Fetches every transaction linked to a given envelope.
 *
 * @returns An array of transactions sorted by date descending (newest first).
 */
export async function fetchLinkedTransactions(
  userId: string,
  envelopeId: string,
): Promise<Transaction[]> {
  const txsRef = collection(db, "users", userId, "transactions");
  const q = query(txsRef, where("envelopeId", "==", envelopeId));
  const snapshot = await getDocs(q);

  const transactions: Transaction[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    transactions.push({
      id: docSnap.id,
      amount: data.amount,
      description: data.description,
      envelopeId: data.envelopeId,
      date: data.date,
      isReimbursement: data.isReimbursement ?? false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      // Recurrence fields (iOS feature) — must survive envelope migration
      // so the series stays intact when the envelope is deleted/merged.
      recurrenceId: typeof data.recurrenceId === "string" ? data.recurrenceId : undefined,
      recurrenceAnchorDay:
        typeof data.recurrenceAnchorDay === "number" ? data.recurrenceAnchorDay : undefined,
      recurrenceEndDate:
        typeof data.recurrenceEndDate === "string" ? data.recurrenceEndDate : undefined,
    });
  });

  // Newest first
  transactions.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return transactions;
}

/**
 * Groups transactions by month (YYYY-MM) and returns a sorted list of
 * { month, count } entries. Used by the UI to display the impact summary.
 */
export function groupTransactionsByMonth(
  transactions: Transaction[],
): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7); // "YYYY-MM"
    map.set(month, (map.get(month) ?? 0) + 1);
  }
  // Sorted chronologically (oldest first)
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

// ── Option A: Migrate transactions to an existing envelope ───────────

/**
 * Reassigns every transaction from `sourceEnvelopeId` to `targetEnvelopeId`,
 * then deletes the source envelope.  Decrements `envelopeCount` by 1.
 *
 * Batched in chunks of 500 to respect the Firestore writeBatch limit.
 */
export async function migrateTransactionsToExisting(
  userId: string,
  sourceEnvelopeId: string,
  targetEnvelopeId: string,
): Promise<void> {
  const transactions = await fetchLinkedTransactions(
    userId,
    sourceEnvelopeId,
  );

  const sourceRef = doc(db, "users", userId, "envelopes", sourceEnvelopeId);
  const counterRef = doc(db, "counters", userId);

  // Edge case: envelope had 0 transactions — still need to delete it
  if (transactions.length === 0) {
    const batch = writeBatch(db);
    batch.delete(sourceRef);
    batch.update(counterRef, { envelopeCount: increment(-1) });
    await batch.commit();
    return;
  }

  // Batch 1: update all transactions + delete source envelope
  const chunks = chunkArray(transactions, BATCH_LIMIT - 2); // room for delete + counter

  for (const chunk of chunks) {
    const batch = writeBatch(db);

    for (const tx of chunk) {
      const txRef = doc(db, "users", userId, "transactions", tx.id);
      batch.update(txRef, {
        envelopeId: targetEnvelopeId,
        updatedAt: new Date().toISOString(),
      });
    }

    // Only delete the source envelope in the last chunk
    if (chunk === chunks[chunks.length - 1]) {
      batch.delete(sourceRef);
      batch.update(counterRef, { envelopeCount: increment(-1) });
    }

    await batch.commit();
  }
}

// ── Option B: Create a new envelope and migrate transactions ─────────

export interface NewEnvelopeData {
  name: string;
  budget: number;
  icon: string;
  color: string;
}

/**
 * Creates a new envelope, migrates all transactions from `sourceEnvelopeId`
 * to the new envelope, then deletes the source envelope.
 *
 * Net envelopeCount is unchanged (one created, one deleted).
 *
 * @returns The Firestore document id of the newly created envelope.
 */
export async function createEnvelopeAndMigrate(
  userId: string,
  sourceEnvelopeId: string,
  newEnvelopeData: NewEnvelopeData,
): Promise<string> {
  const transactions = await fetchLinkedTransactions(
    userId,
    sourceEnvelopeId,
  );

  // 1. Create the new envelope
  const envsRef = collection(db, "users", userId, "envelopes");
  const newEnvRef = await addDoc(envsRef, {
    name: newEnvelopeData.name,
    budget: newEnvelopeData.budget,
    icon: newEnvelopeData.icon,
    color: newEnvelopeData.color,
    spent: 0,
    order: Date.now(), // place at end
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const newEnvelopeId = newEnvRef.id;

  const sourceRef = doc(db, "users", userId, "envelopes", sourceEnvelopeId);

  // Edge case: 0 transactions — just delete the source
  if (transactions.length === 0) {
    const batch = writeBatch(db);
    batch.delete(sourceRef);
    await batch.commit();
    return newEnvelopeId;
  }

  // 2. Migrate all transactions to the new envelope
  const chunks = chunkArray(transactions, BATCH_LIMIT - 1); // room for delete

  for (const chunk of chunks) {
    const batch = writeBatch(db);

    for (const tx of chunk) {
      const txRef = doc(db, "users", userId, "transactions", tx.id);
      batch.update(txRef, {
        envelopeId: newEnvelopeId,
        updatedAt: new Date().toISOString(),
      });
    }

    // Delete source envelope in the last chunk
    if (chunk === chunks[chunks.length - 1]) {
      batch.delete(sourceRef);
    }

    await batch.commit();
  }

  return newEnvelopeId;
}

// ── Option C: Delete envelope and all linked transactions ────────────

/**
 * Deletes the envelope AND every linked transaction, then updates counters.
 *
 * Decrements `envelopeCount` by 1 and decrements the monthly `tx_YYYY_MM`
 * counter for each month that contained deleted transactions.
 */
export async function deleteEnvelopeAndTransactions(
  userId: string,
  envelopeId: string,
  transactions: Transaction[],
): Promise<void> {
  const envelopeRef = doc(db, "users", userId, "envelopes", envelopeId);
  const counterRef = doc(db, "counters", userId);

  // Edge case: 0 transactions — just delete the envelope
  if (transactions.length === 0) {
    const batch = writeBatch(db);
    batch.delete(envelopeRef);
    batch.update(counterRef, { envelopeCount: increment(-1) });
    await batch.commit();
    return;
  }

  // Aggregate monthly transaction counts for counter update
  const monthlyCounts: Record<string, number> = {};
  for (const tx of transactions) {
    const key = getMonthKey(tx.date);
    monthlyCounts[key] = (monthlyCounts[key] ?? 0) + 1;
  }

  const allDocs = [
    envelopeRef,
    ...transactions.map((tx) =>
      doc(db, "users", userId, "transactions", tx.id),
    ),
  ];

  const chunks = chunkArray(allDocs, BATCH_LIMIT - 1); // room for counter

  for (const chunk of chunks) {
    const batch = writeBatch(db);

    for (const docRef of chunk) {
      batch.delete(docRef);
    }

    // Update counters in the last chunk
    if (chunk === chunks[chunks.length - 1]) {
      const counterUpdates: Record<string, ReturnType<typeof increment>> = {
        envelopeCount: increment(-1),
      };
      for (const [monthKey, count] of Object.entries(monthlyCounts)) {
        counterUpdates[monthKey] = increment(-count);
      }
      batch.update(counterRef, counterUpdates);
    }

    await batch.commit();
  }
}
