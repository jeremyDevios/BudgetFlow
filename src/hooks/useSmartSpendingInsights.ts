import { useEffect, useMemo, useState } from "react";
import { getDocs, query, where, limit } from "firebase/firestore";

import type { EnvelopeForecast } from "@/lib/forecasting";
import { transactionsCollectionRef } from "@/lib/budgetService";
import { DEFAULT_BUDGET_ID, type BudgetId } from "@/types/budget";
import { logger } from "@/lib/logger";
import {
  buildSmartSpendingNotifications,
  type SmartSpendingNotification,
  type SpendingInsightEnvelope,
  type SpendingInsightTransaction,
} from "@/lib/spendingInsights";
import {
  addBudgetPeriods,
  budgetMonthKeyForDate,
  budgetPeriod,
  CustomMonthConfig,
  DEFAULT_CUSTOM_MONTH_CONFIG,
} from "@/lib/budgetMonth";

interface UseSmartSpendingInsightsParams {
  userId: string | null;
  envelopes: SpendingInsightEnvelope[];
  currentMonthTransactions: SpendingInsightTransaction[];
  envelopeForecasts?: Record<string, EnvelopeForecast | undefined>;
  isCurrentMonth: boolean;
  analysisMonthCount?: number;
  currency?: string;
  /** Config du mois budgétaire personnalisé (défaut : mois calendaires). */
  customMonthConfig?: CustomMonthConfig;
  /** Budget concerné ('default' = collections legacy). */
  budgetId?: BudgetId;
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
    customMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
    budgetId = DEFAULT_BUDGET_ID,
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
        // Fenêtre historique : les mois budgétaires précédents, se
        // terminant la veille du début de la période courante. Identique
        // aux anciennes bornes calendaires quand l'option est désactivée.
        const currentKey = budgetMonthKeyForDate(formatDate(today), customMonthConfig);
        const rangeStart = budgetPeriod(
          addBudgetPeriods(currentKey, -previousMonthCount, customMonthConfig),
          customMonthConfig,
        ).start;
        const rangeEnd = budgetPeriod(
          addBudgetPeriods(currentKey, -1, customMonthConfig),
          customMonthConfig,
        ).end;

        const txRef = transactionsCollectionRef(userId, budgetId);
        const pastTransactionsQuery = query(
          txRef,
          where("date", ">=", rangeStart),
          where("date", "<=", rangeEnd),
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
          customMonthConfig,
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
    budgetId,
    customMonthConfig,
  ]);

  if (!isCurrentMonth || !userId || envelopes.length === 0) {
    return { globalNotifications: [], envelopeNotifications: {}, loading: false };
  }

  return { globalNotifications, envelopeNotifications, loading };
}
