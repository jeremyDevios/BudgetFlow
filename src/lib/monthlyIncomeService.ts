/**
 * Firestore read/write helpers for the per-month income subcollection.
 *
 * Firestore paths :
 *  - budget par défaut : users/{uid}/monthlyIncomes/{YYYY-MM}
 *  - budgets 2-5        : users/{uid}/budgets/{budgetId}/monthlyIncomes/{YYYY-MM}
 *
 * Document shape: { amount: number }
 *
 * This subcollection is ONLY used when `isFixedIncome === false`.
 */

import { getDocs, setDoc } from "firebase/firestore";

import { logger } from "@/lib/logger";
import {
  monthlyIncomeDocRef,
  monthlyIncomesCollectionRef,
} from "@/lib/budgetService";
import { DEFAULT_BUDGET_ID, type BudgetId } from "@/types/budget";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches all per-month income entries for a user's budget.
 *
 * @returns A map of `YYYY-MM → amount`. Returns an empty object if no entries exist.
 */
export async function getMonthlyIncomes(
  uid: string,
  budgetId: BudgetId = DEFAULT_BUDGET_ID,
): Promise<Record<string, number>> {
  const colRef = monthlyIncomesCollectionRef(uid, budgetId);
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
 * Upserts a monthly income entry for a given month of a given budget.
 *
 * Uses `setDoc` so calling this for an existing month overwrites the previous
 * value without error.
 *
 * @param uid      - The user's Firebase UID.
 * @param month    - Month in `YYYY-MM` format.
 * @param amount   - Income amount for this month (must be ≥ 0).
 * @param budgetId - Budget concerné ('default' = collections legacy).
 */
export async function saveMonthlyIncome(
  uid: string,
  month: string,
  amount: number,
  budgetId: BudgetId = DEFAULT_BUDGET_ID,
): Promise<void> {
  logger.info(
    `monthlyIncomeService.saveMonthlyIncome: setting ${month} → ${amount} for uid ${uid}`,
  );
  const ref = monthlyIncomeDocRef(uid, budgetId, month);
  await setDoc(ref, { amount });
}
