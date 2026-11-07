"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import {
  loadBudgets,
  loadCurrentBudgetId,
  switchBudget as persistSwitchBudget,
} from "@/lib/budgetService";
import { logger } from "@/lib/logger";
import { DEFAULT_BUDGET_ID, type Budget, type BudgetId } from "@/types/budget";

interface BudgetContextValue {
  /** Budgets 2-5 existants (le budget par défaut n'a pas de document). */
  budgets: Budget[];
  /** Budget courant : 'default' ou un slot vivant. */
  currentBudgetId: BudgetId;
  /** Vrai pendant le chargement initial. */
  loading: boolean;
  /** Change le budget courant (persisté dans users/{uid}/state/currentBudget). */
  switchBudget: (budgetId: BudgetId) => Promise<void>;
  /** Recharge la liste des budgets (après création/suppression/restauration). */
  refreshBudgets: () => Promise<void>;
}

const BudgetContext = createContext<BudgetContextValue>({
  budgets: [],
  currentBudgetId: DEFAULT_BUDGET_ID,
  loading: true,
  switchBudget: async () => {},
  refreshBudgets: async () => {},
});

export const useBudget = () => useContext(BudgetContext);

/**
 * État multi-budget partagé des pages protégées.
 *
 * - Charge les budgets (≤ 5 docs) et le budget courant (state/currentBudget)
 *   au login — le repli sûr vers 'default' est intégré à
 *   `loadCurrentBudgetId` (doc absent, id inconnu ou budget soft-deleté).
 * - `switchBudget` est optimiste : l'UI bascule immédiatement, la persistance
 *   échouée est simplement loguée (le prochain chargement repliera l'état).
 */
export const BudgetProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [currentBudgetId, setCurrentBudgetId] =
    useState<BudgetId>(DEFAULT_BUDGET_ID);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (uid: string) => {
    try {
      const loaded = await loadBudgets(uid);
      setBudgets(loaded);
      const current = await loadCurrentBudgetId(uid, loaded);
      setCurrentBudgetId(current);
    } catch (error) {
      logger.sanitizedError("BudgetContext: échec du chargement", error);
      setBudgets([]);
      setCurrentBudgetId(DEFAULT_BUDGET_ID);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setBudgets([]);
      setCurrentBudgetId(DEFAULT_BUDGET_ID);
      setLoading(false);
      return;
    }
    setLoading(true);
    void load(user.uid);
  }, [user, load]);

  const switchBudget = useCallback(
    async (budgetId: BudgetId) => {
      if (!user) return;
      setCurrentBudgetId(budgetId);
      try {
        await persistSwitchBudget(user.uid, budgetId);
      } catch (error) {
        logger.sanitizedError("BudgetContext: échec du switch", error);
      }
    },
    [user],
  );

  const refreshBudgets = useCallback(async () => {
    if (!user) return;
    await load(user.uid);
  }, [user, load]);

  return (
    <BudgetContext.Provider
      value={{ budgets, currentBudgetId, loading, switchBudget, refreshBudgets }}
    >
      {children}
    </BudgetContext.Provider>
  );
};
