/**
 * Firestore read/write helpers for the per-month income subcollection.
 *
 * Firestore path: users/{uid}/monthlyIncomes/{YYYY-MM}
 * Document shape: { amount: number }
 *
 * This subcollection is ONLY used when `isFixedIncome === false`.
 */

import { collection, doc, getDocs, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the Firestore CollectionReference for a user's monthly incomes. */
function monthlyIncomesColRef(uid: string) {
  return collection(db, "users", uid, "monthlyIncomes");
}

/** Returns the Firestore DocumentReference for a specific month. */
function monthlyIncomeDocRef(uid: string, month: string) {
  return doc(db, "users", uid, "monthlyIncomes", month);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches all per-month income entries for a user.
 *
 * @returns A map of `YYYY-MM → amount`. Returns an empty object if no entries exist.
 */
export async function getMonthlyIncomes(
  uid: string,
): Promise<Record<string, number>> {
  const colRef = monthlyIncomesColRef(uid);
  const snap = await getDocs(colRef);

  const result: Record<string, number> = {};
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (typeof data.amount === "number") {
      result[docSnap.id] = data.amount;
    }
  });

  return result;
}

/**
 * Upserts a monthly income entry for a given month.
 *
 * Uses `setDoc` so calling this for an existing month overwrites the previous
 * value without error.
 *
 * @param uid    - The user's Firebase UID.
 * @param month  - Month in `YYYY-MM` format.
 * @param amount - Income amount for this month (must be ≥ 0).
 */
export async function saveMonthlyIncome(
  uid: string,
  month: string,
  amount: number,
): Promise<void> {
  logger.info(
    `monthlyIncomeService.saveMonthlyIncome: setting ${month} → ${amount} for uid ${uid}`,
  );
  const ref = monthlyIncomeDocRef(uid, month);
  await setDoc(ref, { amount });
}
