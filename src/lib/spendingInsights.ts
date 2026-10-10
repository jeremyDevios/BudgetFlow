import type { EnvelopeForecast } from "@/lib/forecasting";
import {
  addBudgetPeriods,
  budgetMonthKeyForDate,
  elapsedAndRemainingInBudgetPeriod,
  CustomMonthConfig,
  DEFAULT_CUSTOM_MONTH_CONFIG,
} from "@/lib/budgetMonth";

export interface SpendingInsightTransaction {
  id: string;
  amount: number;
  description: string;
  envelopeId: string;
  date: string;
  isReimbursement?: boolean;
}

export interface SpendingInsightEnvelope {
  id: string;
  name: string;
  budget: number;
}

export interface ExceptionalSpendingInsight {
  transactionId: string;
  transactionName: string;
  amount: number;
  envelopeId: string;
  envelopeName: string;
  envelopeBudget: number;
  budgetRatio: number;
}

export type SmartSpendingNotificationKind =
  | "exceptional_spending"
  | "rapid_spending"
  | "frequent_overspend"
  | "frequent_underspend"
  | "recurring_overspend";

export interface SmartSpendingNotification {
  id: string;
  kind: SmartSpendingNotificationKind;
  severity: "warning" | "info";
  scope: "global" | "envelope";
  title: string;
  description: string;
  envelopeId?: string;
  envelopeName?: string;
  suggestedBudget?: number;
  observedMonthCount?: number;
  matchCount?: number;
  recurringLabel?: string;
  averageRecurringAmount?: number;
}

export interface SmartSpendingNotificationsResult {
  globalNotifications: SmartSpendingNotification[];
  envelopeNotifications: Record<string, SmartSpendingNotification[]>;
}

const EXCEPTIONAL_TRANSACTION_RATIO_THRESHOLD = 1;
const DEFAULT_ANALYSIS_MONTH_COUNT = 3;
const RAPID_SPENDING_BUFFER_RATIO = 0.18;
const RAPID_SPENDING_IMPORTANCE_RATIO = 0.5;
const UNDERSHOOT_THRESHOLD_RATIO = 0.65;
const RECURRING_MONTH_THRESHOLD = 2;
const RECURRING_SHARE_OF_BUDGET_THRESHOLD = 0.2;
const OVERRUN_RECOMMENDED_BUDGET_BUFFER = 1.1;
const UNDERSHOOT_RECOMMENDED_BUDGET_BUFFER = 1.05;
const FALLBACK_TRANSACTION_LABEL = "Dépense sans libellé";

interface RecurringExpenseCandidate {
  label: string;
  normalizedLabel: string;
  monthKeys: Set<string>;
  totalAmount: number;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(roundCurrency(value));
}

function normalizeTransactionName(value: string): string {
  const normalized = value.trim();
  return normalized || FALLBACK_TRANSACTION_LABEL;
}

function normalizeRecurringLabel(value: string): string | null {
  const normalized = value
    .trim()
    .toLocaleLowerCase("fr-FR")
    .replace(/\s+/g, " ");

  return normalized ? normalized : null;
}

function getMonthKey(dateStr: string): string {
  if (dateStr.length >= 7) {
    const candidate = dateStr.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(candidate)) {
      return candidate;
    }
  }

  const parsed = new Date(dateStr);
  if (!Number.isFinite(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Clé du mois budgétaire d'une transaction (repli historique si malformée). */
function budgetKeyForTransaction(
  dateStr: string,
  config: CustomMonthConfig,
): string {
  const dayStr = dateStr.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayStr)) {
    return budgetMonthKeyForDate(dayStr, config);
  }
  return getMonthKey(dateStr);
}

/** Les N derniers mois budgétaires (le courant inclus), plus ancien d'abord. */
function getRecentMonthKeys(
  today: Date,
  count: number,
  config: CustomMonthConfig,
): string[] {
  const currentKey = budgetMonthKeyForDate(localDayKey(today), config);
  const monthKeys: string[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    monthKeys.push(addBudgetPeriods(currentKey, -offset, config));
  }

  return monthKeys;
}

function getMonthElapsedRatio(today: Date, config: CustomMonthConfig): number {
  const todayKey = localDayKey(today);
  const currentKey = budgetMonthKeyForDate(todayKey, config);
  const { elapsed, total } = elapsedAndRemainingInBudgetPeriod(
    currentKey,
    todayKey,
    config,
  );
  return total > 0 ? elapsed / total : 0;
}

function getRemainingDaysInMonth(today: Date, config: CustomMonthConfig): number {
  const todayKey = localDayKey(today);
  const currentKey = budgetMonthKeyForDate(todayKey, config);
  const { remaining } = elapsedAndRemainingInBudgetPeriod(
    currentKey,
    todayKey,
    config,
  );
  return Math.max(0, remaining);
}

function getEnvelopeNotificationStore(envelopeId: string) {
  return (store: Record<string, SmartSpendingNotification[]>) => {
    if (!store[envelopeId]) {
      store[envelopeId] = [];
    }

    return store[envelopeId];
  };
}

export function findExceptionalSpendingInsight(params: {
  transactions: SpendingInsightTransaction[];
  envelopes: SpendingInsightEnvelope[];
}): ExceptionalSpendingInsight | null {
  const { transactions, envelopes } = params;

  const envelopeById = new Map(
    envelopes.map((envelope) => [envelope.id, envelope] as const)
  );

  let bestMatch: ExceptionalSpendingInsight | null = null;

  for (const transaction of transactions) {
    const envelope = envelopeById.get(transaction.envelopeId);
    if (
      !envelope ||
      envelope.budget <= 0 ||
      transaction.amount <= 0 ||
      transaction.isReimbursement
    ) {
      continue;
    }

    const budgetRatio = transaction.amount / envelope.budget;
    if (budgetRatio < EXCEPTIONAL_TRANSACTION_RATIO_THRESHOLD) {
      continue;
    }

    const candidate: ExceptionalSpendingInsight = {
      transactionId: transaction.id,
      transactionName: normalizeTransactionName(transaction.description),
      amount: transaction.amount,
      envelopeId: envelope.id,
      envelopeName: envelope.name,
      envelopeBudget: envelope.budget,
      budgetRatio,
    };

    if (
      !bestMatch ||
      candidate.budgetRatio > bestMatch.budgetRatio ||
      (candidate.budgetRatio === bestMatch.budgetRatio &&
        candidate.amount > bestMatch.amount)
    ) {
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

export function buildSmartSpendingNotifications(params: {
  transactions: SpendingInsightTransaction[];
  envelopes: SpendingInsightEnvelope[];
  envelopeForecasts?: Record<string, EnvelopeForecast | undefined>;
  today?: Date;
  analysisMonthCount?: number;
  currency?: string;
  /** Config du mois budgétaire personnalisé (défaut : mois calendaires). */
  customMonthConfig?: CustomMonthConfig;
}): SmartSpendingNotificationsResult {
  const {
    transactions,
    envelopes,
    envelopeForecasts = {},
    today = new Date(),
    analysisMonthCount = DEFAULT_ANALYSIS_MONTH_COUNT,
    currency = "EUR",
    customMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
  } = params;

  if (envelopes.length === 0 || analysisMonthCount <= 0) {
    return { globalNotifications: [], envelopeNotifications: {} };
  }

  const currentMonthKey = budgetMonthKeyForDate(
    localDayKey(today),
    customMonthConfig,
  );
  const analysisMonthKeys = getRecentMonthKeys(
    today,
    analysisMonthCount,
    customMonthConfig,
  );
  const spendByEnvelopeByMonth: Record<string, Record<string, number>> = {};
  const recurringByEnvelope: Record<string, Record<string, RecurringExpenseCandidate>> =
    {};

  for (const transaction of transactions) {
    if (
      !transaction.envelopeId ||
      transaction.amount <= 0 ||
      transaction.isReimbursement
    ) {
      continue;
    }

    const monthKey = budgetKeyForTransaction(transaction.date, customMonthConfig);
    if (!monthKey || !analysisMonthKeys.includes(monthKey)) {
      continue;
    }

    if (!spendByEnvelopeByMonth[transaction.envelopeId]) {
      spendByEnvelopeByMonth[transaction.envelopeId] = {};
    }

    spendByEnvelopeByMonth[transaction.envelopeId][monthKey] =
      (spendByEnvelopeByMonth[transaction.envelopeId][monthKey] ?? 0) +
      transaction.amount;

    const recurringLabel = normalizeRecurringLabel(transaction.description);
    if (!recurringLabel) {
      continue;
    }

    if (!recurringByEnvelope[transaction.envelopeId]) {
      recurringByEnvelope[transaction.envelopeId] = {};
    }

    const existingCandidate =
      recurringByEnvelope[transaction.envelopeId][recurringLabel];

    if (existingCandidate) {
      existingCandidate.monthKeys.add(monthKey);
      existingCandidate.totalAmount += transaction.amount;
      continue;
    }

    recurringByEnvelope[transaction.envelopeId][recurringLabel] = {
      label: normalizeTransactionName(transaction.description),
      normalizedLabel: recurringLabel,
      monthKeys: new Set([monthKey]),
      totalAmount: transaction.amount,
    };
  }

  const currentMonthTransactions = transactions.filter(
    (transaction) =>
      budgetKeyForTransaction(transaction.date, customMonthConfig) ===
      currentMonthKey
  );

  const exceptionalInsight = findExceptionalSpendingInsight({
    transactions: currentMonthTransactions,
    envelopes,
  });

  const globalNotifications: SmartSpendingNotification[] = [];
  const envelopeNotifications: Record<string, SmartSpendingNotification[]> = {};

  if (exceptionalInsight) {
    globalNotifications.push({
      id: `exceptional:${exceptionalInsight.transactionId}`,
      kind: "exceptional_spending",
      severity: "warning",
      scope: "global",
      title: "Dépense exceptionnelle détectée",
      description: `"${exceptionalInsight.transactionName}" prend à lui seul ${Math.round(
        exceptionalInsight.budgetRatio * 100
      )}% de l'enveloppe ${exceptionalInsight.envelopeName} (${formatCurrency(
        exceptionalInsight.envelopeBudget, currency
      )}).`,
      envelopeId: exceptionalInsight.envelopeId,
      envelopeName: exceptionalInsight.envelopeName,
    });

    getEnvelopeNotificationStore(exceptionalInsight.envelopeId)(
      envelopeNotifications
    ).push({
      id: `exceptional:${exceptionalInsight.transactionId}`,
      kind: "exceptional_spending",
      severity: "warning",
      scope: "envelope",
      title: "Dépense exceptionnelle détectée",
      description: `"${exceptionalInsight.transactionName}" prend à lui seul ${Math.round(
        exceptionalInsight.budgetRatio * 100
      )}% de cette enveloppe.`,
      envelopeId: exceptionalInsight.envelopeId,
      envelopeName: exceptionalInsight.envelopeName,
    });
  }

  const elapsedMonthRatio = getMonthElapsedRatio(today, customMonthConfig);
  const remainingDaysInMonth = getRemainingDaysInMonth(today, customMonthConfig);

  for (const envelope of envelopes) {
    if (envelope.budget <= 0) {
      continue;
    }

    const monthSpendMap = spendByEnvelopeByMonth[envelope.id] ?? {};
    const currentSpent = monthSpendMap[currentMonthKey] ?? 0;
    const forecast = envelopeForecasts[envelope.id];
    const projectedCurrentMonthSpend =
      forecast?.hasData ? forecast.projectedSpend : currentSpent;

    const recentMonthSpends = analysisMonthKeys.map((monthKey) =>
      monthKey === currentMonthKey
        ? projectedCurrentMonthSpend
        : monthSpendMap[monthKey] ?? 0
    );

    const overspendCount = recentMonthSpends.filter(
      (value) => value > envelope.budget
    ).length;
    const underspendCount = recentMonthSpends.filter(
      (value) =>
        value > 0 && value <= envelope.budget * UNDERSHOOT_THRESHOLD_RATIO
    ).length;
    const averageMonthlySpend =
      recentMonthSpends.reduce((sum, value) => sum + value, 0) /
      recentMonthSpends.length;

    if (
      forecast?.hasData &&
      forecast.willExceed &&
      currentSpent >= envelope.budget * RAPID_SPENDING_IMPORTANCE_RATIO
    ) {
      const expectedSpendToDate = envelope.budget * elapsedMonthRatio;
      if (
        expectedSpendToDate > 0 &&
        currentSpent >
          expectedSpendToDate * (1 + RAPID_SPENDING_BUFFER_RATIO)
      ) {
        const notification: SmartSpendingNotification = {
          id: `rapid:${envelope.id}`,
          kind: "rapid_spending",
          severity: "warning",
          scope: "global",
          title: `Rythme trop rapide dans ${envelope.name}`,
          description: `${Math.round(
            (currentSpent / envelope.budget) * 100
          )}% du budget est déjà utilisé alors qu'il reste encore ${remainingDaysInMonth} jour${
            remainingDaysInMonth > 1 ? "s" : ""
          } avant la fin du mois. À ce rythme, un dépassement d'environ ${formatCurrency(
            forecast.excessAmount, currency
          )} est probable.`,
          envelopeId: envelope.id,
          envelopeName: envelope.name,
        };

        globalNotifications.push(notification);
        getEnvelopeNotificationStore(envelope.id)(envelopeNotifications).push({
          ...notification,
          scope: "envelope",
        });
      }
    }

    if (overspendCount >= 2 && averageMonthlySpend > envelope.budget) {
      const suggestedBudget = roundCurrency(
        averageMonthlySpend * OVERRUN_RECOMMENDED_BUDGET_BUFFER
      );

      const notification: SmartSpendingNotification = {
        id: `frequent-overspend:${envelope.id}`,
        kind: "frequent_overspend",
        severity: "warning",
        scope: "global",
        title: `${envelope.name} dépasse souvent son budget`,
        description: `Cette enveloppe a dépassé son budget ${overspendCount} mois sur ${analysisMonthCount}. Un budget d'environ ${formatCurrency(
          suggestedBudget, currency
        )} serait plus adapté à vos habitudes.`,
        envelopeId: envelope.id,
        envelopeName: envelope.name,
        suggestedBudget,
        observedMonthCount: analysisMonthCount,
        matchCount: overspendCount,
      };

      globalNotifications.push(notification);
      getEnvelopeNotificationStore(envelope.id)(envelopeNotifications).push({
        ...notification,
        scope: "envelope",
      });
    }

    if (
      underspendCount >= 2 &&
      averageMonthlySpend > 0 &&
      averageMonthlySpend <= envelope.budget * UNDERSHOOT_THRESHOLD_RATIO
    ) {
      const suggestedBudget = roundCurrency(
        averageMonthlySpend * UNDERSHOOT_RECOMMENDED_BUDGET_BUFFER
      );

      const notification: SmartSpendingNotification = {
        id: `frequent-underspend:${envelope.id}`,
        kind: "frequent_underspend",
        severity: "info",
        scope: "global",
        title: `${envelope.name} utilise rarement tout son budget`,
        description: `Cette enveloppe est restée bien en dessous de son budget ${underspendCount} mois sur ${analysisMonthCount}. Un budget d'environ ${formatCurrency(
          suggestedBudget, currency
        )} serait plus proche de vos dépenses habituelles.`,
        envelopeId: envelope.id,
        envelopeName: envelope.name,
        suggestedBudget,
        observedMonthCount: analysisMonthCount,
        matchCount: underspendCount,
      };

      globalNotifications.push(notification);
      getEnvelopeNotificationStore(envelope.id)(envelopeNotifications).push({
        ...notification,
        scope: "envelope",
      });
    }

    const recurringCandidates = Object.values(recurringByEnvelope[envelope.id] ?? {})
      .filter((candidate) => candidate.monthKeys.size >= RECURRING_MONTH_THRESHOLD)
      .sort((left, right) => {
        if (right.monthKeys.size !== left.monthKeys.size) {
          return right.monthKeys.size - left.monthKeys.size;
        }
        return right.totalAmount - left.totalAmount;
      });

    const topRecurringCandidate = recurringCandidates[0];
    const averageRecurringAmount = topRecurringCandidate
      ? topRecurringCandidate.totalAmount / topRecurringCandidate.monthKeys.size
      : 0;

    if (
      topRecurringCandidate &&
      (forecast?.willExceed || currentSpent > envelope.budget) &&
      averageRecurringAmount >=
        envelope.budget * RECURRING_SHARE_OF_BUDGET_THRESHOLD
    ) {
      const notification: SmartSpendingNotification = {
        id: `recurring:${envelope.id}:${topRecurringCandidate.normalizedLabel}`,
        kind: "recurring_overspend",
        severity: "warning",
        scope: "global",
        title: `Dépense récurrente à surveiller dans ${envelope.name}`,
        description: `"${topRecurringCandidate.label}" revient presque tous les mois pour environ ${formatCurrency(
          averageRecurringAmount, currency
        )} par mois. Cette dépense mérite votre attention.`,
        envelopeId: envelope.id,
        envelopeName: envelope.name,
        recurringLabel: topRecurringCandidate.label,
        averageRecurringAmount: roundCurrency(averageRecurringAmount),
        observedMonthCount: topRecurringCandidate.monthKeys.size,
      };

      globalNotifications.push(notification);
      getEnvelopeNotificationStore(envelope.id)(envelopeNotifications).push({
        ...notification,
        scope: "envelope",
      });
    }
  }

  return {
    globalNotifications,
    envelopeNotifications,
  };
}
