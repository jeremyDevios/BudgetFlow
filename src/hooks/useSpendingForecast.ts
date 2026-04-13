import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";

import {
  computeForecast,
  EnvelopeForecast,
  ForecastEnvelope,
  ForecastTransaction,
  GlobalForecast,
} from "@/lib/forecasting";
import { db } from "@/lib/firebase";

interface UseSpendingForecastParams {
  userId: string | null;
  envelopes: ForecastEnvelope[];
  currentMonthTransactions: ForecastTransaction[];
  monthlyBudget: number;
  isCurrentMonth: boolean;
  pastMonthCount?: number;
}

interface UseSpendingForecastReturn {
  globalForecast: GlobalForecast | null;
  envelopeForecasts: Record<string, EnvelopeForecast>;
  loading: boolean;
}

const formatDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function useSpendingForecast(
  params: UseSpendingForecastParams
): UseSpendingForecastReturn {
  const {
    userId,
    envelopes,
    currentMonthTransactions,
    monthlyBudget,
    isCurrentMonth,
    pastMonthCount = 3,
  } = params;

  const [globalForecast, setGlobalForecast] = useState<GlobalForecast | null>(
    null
  );
  const [envelopeForecasts, setEnvelopeForecasts] = useState<
    Record<string, EnvelopeForecast>
  >({});
  const [loading, setLoading] = useState(false);

  const envelopeSignature = useMemo(
    () =>
      envelopes
        .map((envelope) => `${envelope.id}:${envelope.budget}:${envelope.name}`)
        .join("|"),
    [envelopes]
  );

  const currentMonthTransactionSignature = useMemo(
    () =>
      currentMonthTransactions
        .map(
          (transaction) =>
            `${transaction.envelopeId}:${transaction.amount}:${transaction.date}`
        )
        .join("|"),
    [currentMonthTransactions]
  );

  useEffect(() => {
    let isCancelled = false;

    if (!isCurrentMonth || !userId) {
      setGlobalForecast(null);
      setEnvelopeForecasts({});
      setLoading(false);
      return;
    }

    const loadForecast = async () => {
      setLoading(true);

      try {
        const today = new Date();
        const rangeEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        const rangeStart = new Date(
          today.getFullYear(),
          today.getMonth() - pastMonthCount,
          1
        );

        const txRef = collection(db, "users", userId, "transactions");
        const q = query(
          txRef,
          where("date", ">=", formatDate(rangeStart)),
          where("date", "<=", `${formatDate(rangeEnd)}T23:59:59`)
        );

        const snapshot = await getDocs(q);
        if (isCancelled) {
          return;
        }

        const pastTransactions: ForecastTransaction[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          pastTransactions.push({
            envelopeId: data.envelopeId,
            amount: data.amount || 0,
            date: data.date,
          });
        });

        const result = computeForecast({
          envelopes,
          pastTransactions,
          currentMonthTransactions,
          monthlyBudget,
          today,
          pastMonthCount,
        });

        setGlobalForecast(result.globalForecast);
        setEnvelopeForecasts(result.envelopeForecasts);
      } catch {
        if (isCancelled) {
          return;
        }
        setGlobalForecast(null);
        setEnvelopeForecasts({});
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadForecast();

    return () => {
      isCancelled = true;
    };
  }, [
    userId,
    isCurrentMonth,
    pastMonthCount,
    monthlyBudget,
    envelopeSignature,
    currentMonthTransactionSignature,
  ]);

  if (!isCurrentMonth || !userId) {
    return { globalForecast: null, envelopeForecasts: {}, loading: false };
  }

  return { globalForecast, envelopeForecasts, loading };
}
