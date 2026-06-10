import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";

import type { EnvelopeForecast } from "@/lib/forecasting";
import { db } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import {
  buildSmartSpendingNotifications,
  type SmartSpendingNotification,
  type SpendingInsightEnvelope,
  type SpendingInsightTransaction,
} from "@/lib/spendingInsights";

interface UseSmartSpendingInsightsParams {
  userId: string | null;
  envelopes: SpendingInsightEnvelope[];
  currentMonthTransactions: SpendingInsightTransaction[];
  envelopeForecasts?: Record<string, EnvelopeForecast | undefined>;
  isCurrentMonth: boolean;
  analysisMonthCount?: number;
  currency?: string;
}

interface UseSmartSpendingInsightsReturn {
  globalNotifications: SmartSpendingNotification[];
  envelopeNotifications: Record<string, SmartSpendingNotification[]>;
  loading: boolean;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useSmartSpendingInsights(
  params: UseSmartSpendingInsightsParams
): UseSmartSpendingInsightsReturn {
  const {
    userId,
    envelopes,
    currentMonthTransactions,
    envelopeForecasts = {},
    isCurrentMonth,
    analysisMonthCount = 3,
    currency = "EUR",
  } = params;

  const [globalNotifications, setGlobalNotifications] = useState<
    SmartSpendingNotification[]
  >([]);
  const [envelopeNotifications, setEnvelopeNotifications] = useState<
    Record<string, SmartSpendingNotification[]>
  >({});
  const [loading, setLoading] = useState(false);

  const envelopeSignature = useMemo(
    () =>
      envelopes
        .map((envelope) => `${envelope.id}:${envelope.name}:${envelope.budget}`)
        .join("|"),
    [envelopes]
  );

  const transactionSignature = useMemo(
    () =>
      currentMonthTransactions
        .map(
          (transaction) =>
            `${transaction.id}:${transaction.envelopeId}:${transaction.amount}:${transaction.date}:${transaction.description}`
        )
        .join("|"),
    [currentMonthTransactions]
  );

  const forecastSignature = useMemo(
    () =>
      Object.entries(envelopeForecasts)
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
        .map(([envelopeId, forecast]) =>
          [
            envelopeId,
            forecast?.projectedSpend ?? "",
            forecast?.willExceed ?? "",
            forecast?.excessAmount ?? "",
            forecast?.hasData ?? "",
          ].join(":")
        )
        .join("|"),
    [envelopeForecasts]
  );

  useEffect(() => {
    let isCancelled = false;

    if (!isCurrentMonth || !userId || envelopes.length === 0) {
      return;
    }

    const loadInsights = async () => {
      setLoading(true);

      try {
        const today = new Date();
        const previousMonthCount = Math.max(analysisMonthCount - 1, 0);
        const rangeEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        const rangeStart = new Date(
          today.getFullYear(),
          today.getMonth() - previousMonthCount,
          1
        );

        const txRef = collection(db, "users", userId, "transactions");
        const pastTransactionsQuery = query(
          txRef,
          where("date", ">=", formatDate(rangeStart)),
          where("date", "<=", `${formatDate(rangeEnd)}T23:59:59`),
          limit(5000)
        );

        const snapshot = await getDocs(pastTransactionsQuery);
        if (isCancelled) {
          return;
        }

        const historicalTransactions: SpendingInsightTransaction[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          historicalTransactions.push({
            id: doc.id,
            envelopeId: typeof data.envelopeId === "string" ? data.envelopeId : "",
            amount: typeof data.amount === "number" ? data.amount : 0,
            date: typeof data.date === "string" ? data.date : "",
            description:
              typeof data.description === "string" ? data.description : "",
            isReimbursement:
              typeof data.isReimbursement === "boolean"
                ? data.isReimbursement
                : false,
          });
        });

        const result = buildSmartSpendingNotifications({
          transactions: [...historicalTransactions, ...currentMonthTransactions],
          envelopes,
          envelopeForecasts,
          today,
          analysisMonthCount,
          currency,
        });

        setGlobalNotifications(result.globalNotifications);
        setEnvelopeNotifications(result.envelopeNotifications);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        logger.sanitizedError(
          "Erreur lors du calcul des notifications intelligentes",
          error
        );
        setGlobalNotifications([]);
        setEnvelopeNotifications({});
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadInsights();

    return () => {
      isCancelled = true;
    };
  }, [
    analysisMonthCount,
    envelopeSignature,
    forecastSignature,
    isCurrentMonth,
    transactionSignature,
    userId,
  ]);

  if (!isCurrentMonth || !userId || envelopes.length === 0) {
    return { globalNotifications: [], envelopeNotifications: {}, loading: false };
  }

  return { globalNotifications, envelopeNotifications, loading };
}
