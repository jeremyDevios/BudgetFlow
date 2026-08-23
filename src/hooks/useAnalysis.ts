import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";

import {
  computeAnalysis,
  dateRangeFor,
  spendByEnvelope,
  type AnalysisEnvelope,
  type AnalysisPeriod,
  type AnalysisResult,
  type AnalysisTransaction,
} from "@/lib/analysisEngine";
import { db } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import { getMonthlyIncomes } from "@/lib/monthlyIncomeService";
import { resolveMonthlyIncome } from "@/lib/settingsService";

interface UseAnalysisParams {
  userId: string | null;
  period: AnalysisPeriod;
  /** Mois de référence quand `period === "month"` (défaut : mois courant). */
  monthDate?: Date;
}

interface UseAnalysisReturn {
  result: AnalysisResult | null;
  spendByEnvelope: { envelopeId: string; name: string; color: string; value: number }[];
  /** Revenu mensuel résolu (override mensuel inclus) — 0 tant qu'aucun revenu n'est configuré. */
  monthlyIncome: number;
  loading: boolean;
}

/** Local "YYYY-MM-DD" string of a date (Firestore string comparison). */
const formatDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Local "YYYY-MM" month key of a date. */
const monthKey = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Charge les données (settings, enveloppes, transactions bornées sur la
 * période courante ET la période précédente) et calcule l'analyse via le
 * moteur pur `src/lib/analysisEngine.ts`. Même pattern que
 * `useSpendingForecast`: pur → hook → UI.
 */
export function useAnalysis({ userId, period, monthDate }: UseAnalysisParams): UseAnalysisReturn {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [chartData, setChartData] = useState<UseAnalysisReturn["spendByEnvelope"]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [loading, setLoading] = useState(false);

  const today = useMemo(() => new Date(), []);
  const effectiveMonthDate = useMemo(() => (period === "month" ? monthDate ?? today : today), [period, monthDate, today]);

  const load = useCallback(async () => {
    if (!userId) {
      setResult(null);
      setChartData([]);
      setMonthlyIncome(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // ── 1. Settings (revenus, épargne, coûts fixes) ──
      let monthlyIncome = 0;
      let monthlySavings = 0;
      let fixedCosts = 0;

      try {
        const settingsRef = doc(db, "users", userId, "settings", "general");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          monthlyIncome = Number(data.monthlyIncome || 0);
          monthlySavings = Number(data.monthlySavings || 0);
          fixedCosts = Number(data.fixedCosts || 0);

          // Revenus variables : override par mois.
          if (data.isFixedIncome === false) {
            try {
              const incomes = await getMonthlyIncomes(userId);
              monthlyIncome = resolveMonthlyIncome(monthKey(effectiveMonthDate), incomes, monthlyIncome);
            } catch (e) {
              logger.warn("Monthly incomes read failed (useAnalysis)");
            }
          }
        }
      } catch (e) {
        logger.warn("Settings read failed (useAnalysis)");
      }

      // ── 2. Enveloppes ──
      const envelopes: AnalysisEnvelope[] = [];
      try {
        const envRef = collection(db, "users", userId, "envelopes");
        const envSnap = await getDocs(envRef);
        envSnap.forEach((doc) => {
          const data = doc.data();
          envelopes.push({
            id: doc.id,
            name: typeof data.name === "string" ? data.name : doc.id,
            color: typeof data.color === "string" ? data.color : "",
            budget: Number(data.budget || 0),
          });
        });
      } catch (e) {
        logger.warn("Envelopes read failed (useAnalysis)");
      }

      // ── 3. Transactions bornées : période courante + période précédente ──
      const range = dateRangeFor(period, today, effectiveMonthDate);
      const start = `${formatDate(range.previousStart)}T00:00:00`;
      const end = `${formatDate(range.end)}T23:59:59`;

      const transactions: AnalysisTransaction[] = [];
      try {
        const txRef = collection(db, "users", userId, "transactions");
        const q = query(txRef, where("date", ">=", start), where("date", "<=", end), limit(3000));
        const txSnap = await getDocs(q);

        const envById = new Map(envelopes.map((env) => [env.id, env]));
        txSnap.forEach((doc) => {
          const data = doc.data();
          const env = data.envelopeId ? envById.get(data.envelopeId) : undefined;
          transactions.push({
            amount: Number(data.amount || 0),
            date: typeof data.date === "string" ? data.date : "",
            envelopeId: typeof data.envelopeId === "string" ? data.envelopeId : "",
            envelopeName: env?.name ?? "",
            envelopeColor: env?.color ?? "",
            envelopeBudget: env?.budget ?? 0,
            type: data.type === "income" ? "income" : "expense",
            isReimbursement: data.isReimbursement === true,
          });
        });
      } catch (e) {
        logger.warn("Transactions read failed (useAnalysis)");
      }

      // ── 4. Calcul ──
      setMonthlyIncome(monthlyIncome);
      const analysis = computeAnalysis({
        transactions,
        envelopes,
        monthlyIncome,
        monthlySavings,
        fixedCosts,
        period,
        monthDate: effectiveMonthDate,
        today,
      });

      setResult(analysis);
      setChartData(
        spendByEnvelope(analysis, envelopes, transactions, period, today, effectiveMonthDate),
      );
    } catch (e) {
      logger.warn("useAnalysis failed");
      setResult(null);
      setChartData([]);
      setMonthlyIncome(0);
    } finally {
      setLoading(false);
    }
  }, [userId, period, today, effectiveMonthDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return { result, spendByEnvelope: chartData, monthlyIncome, loading };
}
