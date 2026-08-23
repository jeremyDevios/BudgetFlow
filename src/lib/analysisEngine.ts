/**
 * Pure analysis engine for the web app — the counterpart of the iOS
 * `AnalysisEngine`. Stateless: takes data in, returns results. No Firebase
 * dependency; every function is unit-tested.
 *
 * Periods mirror the iOS view: month / last 7 days / last 30 days /
 * last 3 months / last 6 months, each with an equivalent previous period used
 * for trend comparison. The 0-100 budget score ("score de bilan") aggregates
 * five signals, exactly like the iOS `computeBilanScore`.
 */

export type AnalysisPeriod = "month" | "last7Days" | "last30Days" | "last3Months" | "last6Months";

export interface AnalysisTransaction {
  amount: number;
  /** ISO-8601 date string. */
  date: string;
  envelopeId: string;
  envelopeName: string;
  envelopeColor: string;
  envelopeBudget: number;
  type: "expense" | "income";
  isReimbursement?: boolean;
}

export interface AnalysisEnvelope {
  id: string;
  name: string;
  color: string;
  budget: number;
}

export interface EnvelopeMetric {
  envelopeId: string;
  name: string;
  color: string;
  value: number;
}

export interface BilanScoreDetails {
  /** Up to 30 points: progressive score based on deficit relative to planned budget. */
  depensesVsRevenus: number;
  /** 20 points if the spend trend is stable or decreasing vs previous period. */
  evolutionStable: number;
  /** Up to 20 points: proportion of envelopes where spent ≤ budget. */
  budgetRespecte: number;
  /** Up to 20 points: regularity based on coefficient of variation of daily spending. */
  regulariteDepenses: number;
  /** 10 points if no single transaction exceeds 50% of its envelope's budget. */
  sansDepensesImpulsives: number;
  /** Sum of the above (0–100). */
  total: number;
}

export interface AnalysisResult {
  totalDepenses: number;
  totalRevenus: number;
  moyenneJourDepense: number;
  nombreDepenses: number;
  nombreRevenus: number;
  medianeJourDepense: number;
  tauxEpargne: number;
  joursSansDepense: number;
  enveloppePlusDepenses: EnvelopeMetric | null;
  enveloppePlusFrequente: EnvelopeMetric | null;
  scoreBilan: number;
  scoreDetails: BilanScoreDetails;
  dayCount: number;
  /** Dépenses nettes de la période précédente équivalente (tendance). */
  previousPeriodSpend: number;
  previousDayCount: number;
}

export interface DateRange {
  start: Date;
  end: Date;
  /** The equivalent previous period, used for trend comparison. */
  previousStart: Date;
  previousEnd: Date;
}

// ── Helpers ──────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Local "YYYY-MM-DD" key of a date — used to bucket daily spending. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Number of days in the inclusive range [start, end]. */
function daysBetween(start: Date, end: Date): number {
  const s = startOfDay(start);
  const e = startOfDay(end);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

/** Impact d'une transaction de dépense sur les totaux (remboursement déduit). */
function effectiveAmount(tx: AnalysisTransaction): number {
  if (tx.type === "income") return tx.amount;
  return tx.isReimbursement ? -tx.amount : tx.amount;
}

// ── Date ranges ──────────────────────────────────────────────────────

/**
 * Returns the date range (and previous equivalent range) for the given
 * period. `monthDate` is used when `period === "month"`.
 */
export function dateRangeFor(
  period: AnalysisPeriod,
  today: Date,
  monthDate: Date = today,
): DateRange {
  switch (period) {
    case "month": {
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const prevDate = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
      return {
        start,
        end,
        previousStart: startOfMonth(prevDate),
        previousEnd: endOfMonth(prevDate),
      };
    }
    case "last7Days": {
      const end = endOfDay(today);
      const start = startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
      const prevEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7, 23, 59, 59, 999);
      const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - 6);
      return { start, end, previousStart: startOfDay(prevStart), previousEnd: prevEnd };
    }
    case "last30Days": {
      const end = endOfDay(today);
      const start = startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29));
      const prevEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 30, 23, 59, 59, 999);
      const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - 29);
      return { start, end, previousStart: startOfDay(prevStart), previousEnd: prevEnd };
    }
    case "last3Months": {
      const end = endOfDay(today);
      const start = startOfDay(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()));
      const prevEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1, 23, 59, 59, 999);
      const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth() - 3, prevEnd.getDate());
      return { start, end, previousStart: startOfDay(prevStart), previousEnd: prevEnd };
    }
    case "last6Months": {
      const end = endOfDay(today);
      const start = startOfDay(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()));
      const prevEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1, 23, 59, 59, 999);
      const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth() - 6, prevEnd.getDate());
      return { start, end, previousStart: startOfDay(prevStart), previousEnd: prevEnd };
    }
  }
}

// ── Main analysis ────────────────────────────────────────────────────

export interface AnalysisInput {
  transactions: AnalysisTransaction[];
  envelopes: AnalysisEnvelope[];
  monthlySavings: number;
  monthlyIncome: number;
  fixedCosts?: number;
  temporaryBudget?: number;
  period: AnalysisPeriod;
  /** Mois de référence quand `period === "month"`. */
  monthDate?: Date;
  today?: Date;
}

export function computeAnalysis(input: AnalysisInput): AnalysisResult {
  const {
    transactions,
    envelopes,
    monthlySavings,
    monthlyIncome,
    fixedCosts = 0,
    temporaryBudget = 0,
    period,
    monthDate,
    today = new Date(),
  } = input;

  const range = dateRangeFor(period, today, monthDate ?? today);

  // ── Filter transactions for the current / previous period ──
  const periodTransactions = transactions.filter(
    (tx) => new Date(tx.date) >= range.start && new Date(tx.date) <= range.end,
  );
  const previousTransactions = transactions.filter(
    (tx) => new Date(tx.date) >= range.previousStart && new Date(tx.date) <= range.previousEnd,
  );

  // ── Separate income vs expense ──
  const incomeTransactions = periodTransactions.filter((tx) => tx.type === "income");
  const expenseTransactions = periodTransactions.filter((tx) => tx.type !== "income");

  const totalDepenses = expenseTransactions.reduce((sum, tx) => sum + effectiveAmount(tx), 0);
  const totalRevenus = incomeTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const nombreDepenses = expenseTransactions.length;
  const nombreRevenus = incomeTransactions.length;

  // ── Daily breakdown ──
  const dayCount = Math.max(daysBetween(range.start, range.end), 1);

  // Real revenue: max of transaction income and prorated monthly income.
  const revenusReels = Math.max(totalRevenus, (monthlyIncome * dayCount) / 30.0);

  const dailySpend = new Map<string, number>();
  for (const tx of expenseTransactions) {
    const key = dayKey(new Date(tx.date));
    dailySpend.set(key, (dailySpend.get(key) ?? 0) + effectiveAmount(tx));
  }

  // Days with zero or negative spend (no real spending).
  const joursSansDepense = dayCount - dailySpend.size;
  const nonZeroSpends = Array.from(dailySpend.values()).filter((v) => v > 0).sort((a, b) => a - b);

  const moyenneJourDepense = totalDepenses / dayCount;

  const medianeJourDepense =
    nonZeroSpends.length === 0
      ? 0
      : nonZeroSpends.length % 2 === 0
        ? (nonZeroSpends[nonZeroSpends.length / 2 - 1] + nonZeroSpends[nonZeroSpends.length / 2]) / 2
        : nonZeroSpends[Math.floor(nonZeroSpends.length / 2)];

  // ── Savings rate ──
  const tauxEpargne = revenusReels > 0 ? ((revenusReels - totalDepenses) / revenusReels) * 100 : 0;

  // ── Per-envelope aggregation ──
  const envelopeSpend = new Map<string, number>();
  const envelopeTxCount = new Map<string, number>();
  for (const tx of expenseTransactions) {
    if (!tx.envelopeId) continue;
    envelopeSpend.set(tx.envelopeId, (envelopeSpend.get(tx.envelopeId) ?? 0) + effectiveAmount(tx));
    envelopeTxCount.set(tx.envelopeId, (envelopeTxCount.get(tx.envelopeId) ?? 0) + 1);
  }

  const envById = new Map(envelopes.map((env) => [env.id, env]));

  // Envelope with most spending.
  let enveloppePlusDepenses: EnvelopeMetric | null = null;
  if (envelopeSpend.size > 0) {
    let topId = "";
    let topValue = -Infinity;
    for (const [id, value] of envelopeSpend) {
      if (value > topValue) {
        topValue = value;
        topId = id;
      }
    }
    const env = envById.get(topId);
    if (env) enveloppePlusDepenses = { envelopeId: topId, name: env.name, color: env.color, value: topValue };
  }

  // Most frequently used envelope.
  let enveloppePlusFrequente: EnvelopeMetric | null = null;
  if (envelopeTxCount.size > 0) {
    let topId = "";
    let topValue = -Infinity;
    for (const [id, value] of envelopeTxCount) {
      if (value > topValue) {
        topValue = value;
        topId = id;
      }
    }
    const env = envById.get(topId);
    if (env) enveloppePlusFrequente = { envelopeId: topId, name: env.name, color: env.color, value: topValue };
  }

  // ── Bilan Score ──
  const previousPeriodSpend = previousTransactions
    .filter((tx) => tx.type !== "income")
    .reduce((sum, tx) => sum + effectiveAmount(tx), 0);
  const previousDayCount = Math.max(daysBetween(range.previousStart, range.previousEnd), 1);

  const scoreDetails = computeBilanScore({
    totalDepenses,
    totalRevenus,
    revenusReels,
    monthlyIncome,
    fixedCosts,
    monthlySavings,
    temporaryBudget,
    currentPeriodSpend: totalDepenses,
    previousPeriodSpend,
    dayCount,
    previousDayCount,
    expenseTransactions,
    envelopes,
    envelopeSpend,
    dailySpend,
  });

  return {
    totalDepenses,
    totalRevenus,
    moyenneJourDepense,
    nombreDepenses,
    nombreRevenus,
    medianeJourDepense,
    tauxEpargne,
    joursSansDepense,
    enveloppePlusDepenses,
    enveloppePlusFrequente,
    scoreBilan: scoreDetails.total,
    scoreDetails,
    dayCount,
    previousPeriodSpend,
    previousDayCount,
  };
}

// ── Bilan score ──────────────────────────────────────────────────────

export interface BilanScoreInput {
  totalDepenses: number;
  totalRevenus: number;
  revenusReels: number;
  monthlyIncome: number;
  fixedCosts: number;
  monthlySavings: number;
  temporaryBudget: number;
  currentPeriodSpend: number;
  previousPeriodSpend: number;
  dayCount: number;
  previousDayCount: number;
  expenseTransactions: AnalysisTransaction[];
  envelopes: AnalysisEnvelope[];
  envelopeSpend: Map<string, number>;
  dailySpend: Map<string, number>;
}

export function computeBilanScore(input: BilanScoreInput): BilanScoreDetails {
  const {
    totalDepenses,
    totalRevenus,
    revenusReels,
    monthlyIncome,
    fixedCosts,
    monthlySavings,
    temporaryBudget,
    currentPeriodSpend,
    previousPeriodSpend,
    dayCount,
    previousDayCount,
    expenseTransactions,
    envelopes,
    envelopeSpend,
    dailySpend,
  } = input;

  // ── Planned budget (aligned with Dashboard / Evolution) ──
  const plannedBudget = monthlyIncome - fixedCosts - monthlySavings + temporaryBudget;

  // 1. Dépenses vs Revenus (30 points) — progressive based on deficit vs planned budget.
  const balance = plannedBudget - totalDepenses + totalRevenus;
  let depensesVsRevenus: number;
  if (balance >= 0) {
    depensesVsRevenus = 30;
  } else if (plannedBudget > 0) {
    const deficitRatio = Math.abs(balance) / plannedBudget;
    if (deficitRatio <= 0.01) depensesVsRevenus = 22;
    else if (deficitRatio <= 0.04) depensesVsRevenus = 15;
    else if (deficitRatio <= 0.1) depensesVsRevenus = 7;
    else depensesVsRevenus = 0;
  } else {
    depensesVsRevenus = totalDepenses <= revenusReels ? 30 : 0;
  }

  // 2. Évolution stable ou en baisse (20 points) — progressive thresholds.
  const currentDailyRate = dayCount > 0 ? currentPeriodSpend / dayCount : 0;
  const previousDailyRate = previousDayCount > 0 ? previousPeriodSpend / previousDayCount : 0;
  let evolutionStable: number;
  if (previousDailyRate <= 0) {
    evolutionStable = 20; // pas de données précédentes → stable
  } else {
    const increase = currentDailyRate / previousDailyRate - 1;
    if (increase <= 0.05) evolutionStable = 20;
    else if (increase <= 0.1) evolutionStable = 15;
    else if (increase <= 0.2) evolutionStable = 10;
    else if (increase <= 0.3) evolutionStable = 5;
    else evolutionStable = 0;
  }

  // 3. Budget enveloppes respecté (up to 20 points).
  let budgetRespecte: number;
  if (envelopes.length === 0) {
    budgetRespecte = 20;
  } else {
    let withinBudget = 0;
    for (const env of envelopes) {
      const spent = envelopeSpend.get(env.id) ?? 0;
      if (env.budget <= 0 || spent <= env.budget) withinBudget += 1;
    }
    budgetRespecte = Math.round((withinBudget / envelopes.length) * 20);
  }

  // 4. Régularité des dépenses (20 points) — coefficient of variation.
  const spendValues = Array.from(dailySpend.values()).filter((v) => v > 0);
  let regulariteDepenses: number;
  if (spendValues.length >= 3) {
    const mean = spendValues.reduce((a, b) => a + b, 0) / spendValues.length;
    if (mean > 0) {
      const variance =
        spendValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / spendValues.length;
      const cv = Math.sqrt(variance) / mean;
      if (cv <= 0.5) regulariteDepenses = 20;
      else if (cv <= 1.0) regulariteDepenses = 15;
      else if (cv <= 1.5) regulariteDepenses = 10;
      else if (cv <= 2.0) regulariteDepenses = 5;
      else regulariteDepenses = 0;
    } else {
      regulariteDepenses = 20;
    }
  } else {
    regulariteDepenses = 20; // pas assez de données → régulier
  }

  // 5. Pas de dépenses impulsives (10 points) — max ratio amount / envelope budget.
  let maxImpulseRatio = 0;
  for (const tx of expenseTransactions) {
    if (!tx.envelopeId) continue;
    const budget = envelopes.find((env) => env.id === tx.envelopeId)?.budget ?? 0;
    if (budget <= 0) continue;
    maxImpulseRatio = Math.max(maxImpulseRatio, tx.amount / budget);
  }
  let sansDepensesImpulsives: number;
  if (maxImpulseRatio <= 0.25) sansDepensesImpulsives = 10;
  else if (maxImpulseRatio <= 0.5) sansDepensesImpulsives = 7;
  else if (maxImpulseRatio <= 0.75) sansDepensesImpulsives = 5;
  else if (maxImpulseRatio <= 1.0) sansDepensesImpulsives = 2;
  else sansDepensesImpulsives = 0;

  const total =
    depensesVsRevenus + evolutionStable + budgetRespecte + regulariteDepenses + sansDepensesImpulsives;

  return {
    depensesVsRevenus,
    evolutionStable,
    budgetRespecte,
    regulariteDepenses,
    sansDepensesImpulsives,
    total,
  };
}

// ── Per-envelope breakdown (web UI chart) ────────────────────────────

/**
 * Dépenses agrégées par enveloppe pour la période — triées décroissantes,
 * enveloppes sans dépense exclues. Alimente le graphique de la page Analyse.
 */
export function spendByEnvelope(
  result: AnalysisResult,
  envelopes: AnalysisEnvelope[],
  transactions: AnalysisTransaction[],
  period: AnalysisPeriod,
  today: Date,
  monthDate?: Date,
): { envelopeId: string; name: string; color: string; value: number }[] {
  const range = dateRangeFor(period, today, monthDate ?? today);
  const envById = new Map(envelopes.map((env) => [env.id, env]));
  const totals = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.type === "income" || !tx.envelopeId) continue;
    const d = new Date(tx.date);
    if (d < range.start || d > range.end) continue;
    totals.set(tx.envelopeId, (totals.get(tx.envelopeId) ?? 0) + effectiveAmount(tx));
  }

  return Array.from(totals.entries())
    .map(([id, value]) => {
      const env = envById.get(id);
      return { envelopeId: id, name: env?.name ?? "Enveloppe supprimée", color: env?.color ?? "", value };
    })
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
}
