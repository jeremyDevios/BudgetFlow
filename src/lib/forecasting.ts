import {
  budgetMonthKeyForDate,
  elapsedAndRemainingInBudgetPeriod,
  CustomMonthConfig,
  DEFAULT_CUSTOM_MONTH_CONFIG,
} from "@/lib/budgetMonth";

export interface ForecastTransaction {
  envelopeId: string;
  amount: number;
  date: string; // ISO "YYYY-MM-DD..."
  isReimbursement?: boolean;
}

export interface ForecastEnvelope {
  id: string;
  budget: number;
  name: string;
}

export interface EnvelopeForecast {
  envelopeId: string;
  projectedSpend: number; // currentSpent + (dailyRate × remainingDays)
  projectedRemaining: number; // budget - projectedSpend
  percentOfBudget: number; // projectedSpend / budget × 100
  willExceed: boolean;
  excessAmount: number; // max(0, projectedSpend - budget)
  hasData: boolean; // false when no past months data
  confidenceScore: number; // 0.0–1.0
  monthsWithData: number; // raw count for display
}

export interface GlobalForecast {
  projectedTotal: number;
  projectedRemaining: number;
  willExceed: boolean;
  excessAmount: number;
  confidenceScore: number;
  hasEnoughData: boolean; // true if at least 1 envelope has past data
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

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Clé du mois budgétaire d'une transaction. Dates valides → moteur
 * `budgetMonthKeyForDate` (calendaire par défaut) ; dates malformées →
 * repli historique sur le parsing `Date`.
 */
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

const pad2 = (n: number) => String(n).padStart(2, "0");

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Jours restants de la période courante (aujourd'hui inclus), aligné sur
 * l'ancienne sémantique `remainingDaysInMonth` (clamp ≥ 1) pour préserver
 * l'identité calendaire quand l'option est désactivée.
 */
function remainingDaysInCurrentPeriod(
  today: Date,
  config: CustomMonthConfig,
): number {
  const todayKey = localDayKey(today);
  const currentKey = budgetMonthKeyForDate(todayKey, config);
  const { elapsed, total } = elapsedAndRemainingInBudgetPeriod(
    currentKey,
    todayKey,
    config,
  );
  return Math.max(1, total - elapsed + 1);
}

export function computeForecast(params: {
  envelopes: ForecastEnvelope[];
  pastTransactions: ForecastTransaction[];
  currentMonthTransactions: ForecastTransaction[];
  monthlyBudget: number;
  today: Date;
  pastMonthCount: number;
  /** Config du mois budgétaire personnalisé (défaut : mois calendaires). */
  customMonthConfig?: CustomMonthConfig;
}): {
  globalForecast: GlobalForecast;
  envelopeForecasts: Record<string, EnvelopeForecast>;
} {
  const {
    envelopes,
    pastTransactions,
    currentMonthTransactions,
    monthlyBudget,
    today,
    pastMonthCount,
    customMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
  } = params;

  if (envelopes.length === 0) {
    return {
      globalForecast: {
        projectedTotal: 0,
        projectedRemaining: monthlyBudget,
        willExceed: false,
        excessAmount: 0,
        confidenceScore: 0,
        hasEnoughData: false,
      },
      envelopeForecasts: {},
    };
  }

  const safePastMonthCount = Math.max(0, pastMonthCount);

  const pastByEnvByMonth: Record<string, Record<string, number>> = {};
  const pastTxCountByEnvByMonth: Record<string, Record<string, number>> = {};
  const observedMonthKeys = new Set<string>();

  for (const tx of pastTransactions) {
    // Skip income transactions — they have no envelope
    if (!tx.envelopeId) continue;

    const monthKey = budgetKeyForTransaction(tx.date, customMonthConfig);
    if (!monthKey) {
      continue;
    }

    observedMonthKeys.add(monthKey);

    if (!pastByEnvByMonth[tx.envelopeId]) {
      pastByEnvByMonth[tx.envelopeId] = {};
    }
    if (!pastTxCountByEnvByMonth[tx.envelopeId]) {
      pastTxCountByEnvByMonth[tx.envelopeId] = {};
    }

    const contribution = tx.isReimbursement ? -tx.amount : tx.amount;
    const currentAmount = pastByEnvByMonth[tx.envelopeId][monthKey] ?? 0;
    pastByEnvByMonth[tx.envelopeId][monthKey] = currentAmount + contribution;

    const currentCount = pastTxCountByEnvByMonth[tx.envelopeId][monthKey] ?? 0;
    pastTxCountByEnvByMonth[tx.envelopeId][monthKey] = currentCount + 1;
  }

  let monthKeysForRange: string[] = [];
  if (safePastMonthCount > 0) {
    const sortedObserved = Array.from(observedMonthKeys).sort();
    monthKeysForRange = sortedObserved.slice(-safePastMonthCount);
  }

  const currentSpentByEnvelope: Record<string, number> = {};
  for (const tx of currentMonthTransactions) {
    const contribution = tx.isReimbursement ? -tx.amount : tx.amount;
    const current = currentSpentByEnvelope[tx.envelopeId] ?? 0;
    currentSpentByEnvelope[tx.envelopeId] = current + contribution;
  }

  const todayKey = localDayKey(today);
  const currentMonthKey = budgetMonthKeyForDate(todayKey, customMonthConfig);
  const currentPeriod = elapsedAndRemainingInBudgetPeriod(
    currentMonthKey,
    todayKey,
    customMonthConfig,
  );
  const currentMonthDays = currentPeriod.total;
  const remainingDays = remainingDaysInCurrentPeriod(today, customMonthConfig);

  const envelopeForecasts: Record<string, EnvelopeForecast> = {};
  let projectedTotal = 0;
  let hasEnoughData = false;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const envelope of envelopes) {
    const envMonthSpendMap = pastByEnvByMonth[envelope.id] ?? {};
    const envMonthTxCountMap = pastTxCountByEnvByMonth[envelope.id] ?? {};

    const monthlySpends: number[] = [];
    for (const monthKey of monthKeysForRange) {
      monthlySpends.push(envMonthSpendMap[monthKey] ?? 0);
    }

    while (monthlySpends.length < safePastMonthCount) {
      monthlySpends.push(0);
    }

    let monthsWithData = 0;
    for (const monthKey of monthKeysForRange) {
      if ((envMonthTxCountMap[monthKey] ?? 0) > 0) {
        monthsWithData += 1;
      }
    }

    const currentSpent = currentSpentByEnvelope[envelope.id] ?? 0;
    const hasData = safePastMonthCount > 0 && monthsWithData > 0;

    let confidenceScore = 0;
    if (hasData) {
      confidenceScore = Math.min(monthsWithData / safePastMonthCount, 1);
    }

    let projectedSpend = currentSpent;

    if (hasData) {
      const totalPastSpend = monthlySpends.reduce((sum, value) => sum + value, 0);
      const avgMonthlySpend = totalPastSpend / safePastMonthCount;

      let dailyRate = avgMonthlySpend / currentMonthDays;
      if (!Number.isFinite(dailyRate)) {
        dailyRate = 0;
      }

      projectedSpend = currentSpent + dailyRate * remainingDays;
      if (projectedSpend < currentSpent) {
        projectedSpend = currentSpent;
      }
    }

    const budget = envelope.budget;
    const projectedRemaining = budget - projectedSpend;
    const percentOfBudget = budget > 0 ? (projectedSpend / budget) * 100 : 0;
    const willExceed = budget > 0 && projectedSpend > budget;
    const excessAmount = Math.max(0, projectedSpend - budget);

    envelopeForecasts[envelope.id] = {
      envelopeId: envelope.id,
      projectedSpend,
      projectedRemaining,
      percentOfBudget,
      willExceed,
      excessAmount,
      hasData,
      confidenceScore,
      monthsWithData,
    };

    projectedTotal += projectedSpend;

    if (monthsWithData >= 1) {
      hasEnoughData = true;
    }
    if (hasData) {
      confidenceSum += confidenceScore;
      confidenceCount += 1;
    }
  }

  const globalConfidenceScore =
    confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
  const projectedRemaining = monthlyBudget - projectedTotal;
  const willExceed = monthlyBudget > 0 && projectedTotal > monthlyBudget;
  const excessAmount = Math.max(0, projectedTotal - monthlyBudget);

  return {
    globalForecast: {
      projectedTotal,
      projectedRemaining,
      willExceed,
      excessAmount,
      confidenceScore: globalConfidenceScore,
      hasEnoughData,
    },
    envelopeForecasts,
  };
}
