import {
  computeAnalysis,
  computeBilanScore,
  dateRangeFor,
  spendByEnvelope,
  type AnalysisEnvelope,
  type AnalysisTransaction,
  type BilanScoreDetails,
} from "@/lib/analysisEngine";

// Helpers ─────────────────────────────────────────────────────────────

const tx = (partial: Partial<AnalysisTransaction>): AnalysisTransaction => ({
  amount: 0,
  date: new Date(2026, 0, 5, 12).toISOString(), // 5 janvier 2026, 12:00 locale
  envelopeId: "",
  envelopeName: "",
  envelopeColor: "",
  envelopeBudget: 0,
  type: "expense",
  isReimbursement: false,
  ...partial,
});

const env = (partial: Partial<AnalysisEnvelope> & { id: string }): AnalysisEnvelope => ({
  name: partial.id,
  color: "bg-red-500",
  budget: 100,
  ...partial,
});

describe("dateRangeFor", () => {
  const today = new Date(2026, 0, 15); // 15 janvier 2026

  it("computes the month range and its previous month", () => {
    const range = dateRangeFor("month", today, new Date(2026, 0, 15));
    expect(range.start).toEqual(new Date(2026, 0, 1));
    expect(range.end).toEqual(new Date(2026, 0, 31, 23, 59, 59, 999));
    expect(range.previousStart).toEqual(new Date(2025, 11, 1));
    expect(range.previousEnd).toEqual(new Date(2025, 11, 31, 23, 59, 59, 999));
  });

  it("supports a monthDate different from today", () => {
    const range = dateRangeFor("month", today, new Date(2026, 6, 10));
    expect(range.start).toEqual(new Date(2026, 6, 1));
    expect(range.previousEnd).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999));
  });

  it("computes last7Days with the previous 7-day period", () => {
    const range = dateRangeFor("last7Days", today);
    expect(range.start).toEqual(new Date(2026, 0, 9));
    expect(range.end).toEqual(new Date(2026, 0, 15, 23, 59, 59, 999));
    expect(range.previousStart).toEqual(new Date(2025, 11, 27));
    expect(range.previousEnd).toEqual(new Date(2026, 0, 2, 23, 59, 59, 999));
  });

  it("computes last30Days with the previous 30-day period", () => {
    const range = dateRangeFor("last30Days", today);
    expect(range.start).toEqual(new Date(2025, 11, 17));
    expect(range.previousEnd).toEqual(new Date(2025, 10, 17, 23, 59, 59, 999));
    expect(range.previousStart).toEqual(new Date(2025, 9, 19));
  });

  it("computes last3Months and last6Months with their previous windows", () => {
    const r3 = dateRangeFor("last3Months", today);
    expect(r3.start).toEqual(new Date(2025, 9, 15));
    expect(r3.previousStart).toEqual(new Date(2025, 6, 14));

    const r6 = dateRangeFor("last6Months", today);
    expect(r6.start).toEqual(new Date(2025, 6, 15));
    expect(r6.previousStart).toEqual(new Date(2025, 0, 14));
  });
});

describe("computeAnalysis", () => {
  const baseInput = {
    monthlyIncome: 2000,
    monthlySavings: 300,
    fixedCosts: 500,
    temporaryBudget: 0,
    period: "month" as const,
    monthDate: new Date(2026, 0, 15),
    today: new Date(2026, 0, 15),
  };

  it("computes totals, averages, median and savings rate for the month", () => {
    const result = computeAnalysis({
      ...baseInput,
      transactions: [
        tx({ amount: 100, date: new Date(2026, 0, 5, 12).toISOString(), envelopeId: "courses" }),
        tx({ amount: 50, date: new Date(2026, 0, 10, 12).toISOString(), envelopeId: "transport" }),
        tx({ amount: 2000, date: new Date(2026, 0, 3, 12).toISOString(), type: "income" }),
      ],
      envelopes: [
        env({ id: "courses", budget: 300 }),
        env({ id: "transport", budget: 100 }),
      ],
    });

    expect(result.totalDepenses).toBe(150);
    expect(result.totalRevenus).toBe(2000);
    expect(result.nombreDepenses).toBe(2);
    expect(result.nombreRevenus).toBe(1);
    expect(result.dayCount).toBe(31);
    expect(result.moyenneJourDepense).toBeCloseTo(150 / 31);
    // Médiane des jours non nuls : [50, 100] → 75
    expect(result.medianeJourDepense).toBe(75);
    expect(result.joursSansDepense).toBe(29);
    // Revenus réels = max(2000, 2000 × 31/30) = 2066.67
    const revenusReels = Math.max(2000, (2000 * 31) / 30);
    expect(result.tauxEpargne).toBeCloseTo(((revenusReels - 150) / revenusReels) * 100);
    // Période précédente : aucune transaction hors janvier → 0, 31 jours.
    expect(result.previousPeriodSpend).toBe(0);
    expect(result.previousDayCount).toBe(31);
  });

  it("computes the top envelopes by amount and frequency", () => {
    const result = computeAnalysis({
      ...baseInput,
      transactions: [
        tx({ amount: 100, date: new Date(2026, 0, 5, 12).toISOString(), envelopeId: "courses" }),
        tx({ amount: 20, date: new Date(2026, 0, 6, 12).toISOString(), envelopeId: "courses" }),
        tx({ amount: 50, date: new Date(2026, 0, 7, 12).toISOString(), envelopeId: "transport" }),
      ],
      envelopes: [
        env({ id: "courses", budget: 300, name: "Courses" }),
        env({ id: "transport", budget: 100, name: "Transport" }),
      ],
    });

    expect(result.enveloppePlusDepenses).toEqual({
      envelopeId: "courses",
      name: "Courses",
      color: "bg-red-500",
      value: 120,
    });
    expect(result.enveloppePlusFrequente).toEqual({
      envelopeId: "courses",
      name: "Courses",
      color: "bg-red-500",
      value: 2,
    });
  });

  it("subtracts reimbursements from expenses", () => {
    const result = computeAnalysis({
      ...baseInput,
      transactions: [
        tx({ amount: 100, date: new Date(2026, 0, 5, 12).toISOString(), envelopeId: "courses" }),
        tx({ amount: 30, date: new Date(2026, 0, 6, 12).toISOString(), envelopeId: "courses", isReimbursement: true }),
      ],
      envelopes: [env({ id: "courses", budget: 300 })],
    });

    expect(result.totalDepenses).toBe(70);
    expect(result.nombreDepenses).toBe(2);
    // Le jour du remboursement (-30) est exclu, mais le jour à +100 reste → [100]
    expect(result.medianeJourDepense).toBe(100);
    expect(result.joursSansDepense).toBe(29);
  });

  it("filters transactions outside the selected month", () => {
    const result = computeAnalysis({
      ...baseInput,
      transactions: [
        tx({ amount: 100, date: new Date(2025, 11, 20, 12).toISOString(), envelopeId: "courses" }), // décembre
        tx({ amount: 50, date: new Date(2026, 0, 10, 12).toISOString(), envelopeId: "courses" }), // janvier
      ],
      envelopes: [env({ id: "courses", budget: 300 })],
    });

    expect(result.totalDepenses).toBe(50);
    expect(result.nombreDepenses).toBe(1);
  });

  it("returns zero metrics for an empty month", () => {
    const result = computeAnalysis({
      ...baseInput,
      transactions: [],
      envelopes: [],
    });

    expect(result.totalDepenses).toBe(0);
    expect(result.nombreDepenses).toBe(0);
    expect(result.medianeJourDepense).toBe(0);
    expect(result.tauxEpargne).toBeGreaterThan(0); // aucun revenu réel → 0, mais revenus réels > 0 via monthlyIncome
    expect(result.enveloppePlusDepenses).toBeNull();
    expect(result.enveloppePlusFrequente).toBeNull();
  });
});

describe("computeBilanScore", () => {
  const baseScore: Omit<Parameters<typeof computeBilanScore>[0], "envelopeSpend" | "dailySpend" | "expenseTransactions" | "envelopes"> = {
    totalDepenses: 0,
    totalRevenus: 0,
    revenusReels: 0,
    monthlyIncome: 2000,
    fixedCosts: 500,
    monthlySavings: 300,
    temporaryBudget: 0,
    currentPeriodSpend: 0,
    previousPeriodSpend: 0,
    dayCount: 31,
    previousDayCount: 31,
  };

  const score = (partial: Partial<Parameters<typeof computeBilanScore>[0]>): BilanScoreDetails =>
    computeBilanScore({
      ...baseScore,
      expenseTransactions: [],
      envelopes: [],
      envelopeSpend: new Map(),
      dailySpend: new Map(),
      ...partial,
    });

  it("awards full marks when the budget is balanced and spending is stable", () => {
    // plannedBudget = 2000 - 500 - 300 = 1200 ; balance = 1200 - 0 + 0 ≥ 0 → 30 pts.
    const details = score({});
    expect(details).toEqual({
      depensesVsRevenus: 30,
      evolutionStable: 20,
      budgetRespecte: 20,
      regulariteDepenses: 20,
      sansDepensesImpulsives: 10,
      total: 100,
    });
  });

  it("scales depensesVsRevenus down with the deficit ratio", () => {
    // plannedBudget = 1200, balance = 1200 - 1320 + 0 = -120 → ratio 0.1 → 7 pts.
    const details = score({ totalDepenses: 1320, currentPeriodSpend: 1320 });
    expect(details.depensesVsRevenus).toBe(7);

    // ratio 0.02 (balance = -24) → 15 pts
    const details2 = score({ totalDepenses: 1224, currentPeriodSpend: 1224 });
    expect(details2.depensesVsRevenus).toBe(15);

    // ratio 0.5 → 0 pts
    const severe = score({ totalDepenses: 1800, currentPeriodSpend: 1800 });
    expect(severe.depensesVsRevenus).toBe(0);
  });

  it("falls back to real income when there is no planned budget", () => {
    const details = score({
      monthlyIncome: 0,
      totalDepenses: 50,
      revenusReels: 100,
    });
    expect(details.depensesVsRevenus).toBe(30); // dépenses ≤ revenus réels

    const details2 = score({
      monthlyIncome: 0,
      totalDepenses: 200,
      revenusReels: 100,
    });
    expect(details2.depensesVsRevenus).toBe(0);
  });

  it("penalizes an increasing daily spend trend", () => {
    // current 100/31 ≈ 3.23, previous 100/31 → ratio 1.0 → increase 0 → 20 pts
    const stable = score({ currentPeriodSpend: 100, previousPeriodSpend: 100 });
    expect(stable.evolutionStable).toBe(20);

    // previous 100/31 vs current 124/31 → increase 0.24 → 5 pts
    const rising = score({ currentPeriodSpend: 124, previousPeriodSpend: 100 });
    expect(rising.evolutionStable).toBe(5);

    // increase > 0.3 → 0 pts
    const sharp = score({ currentPeriodSpend: 200, previousPeriodSpend: 100 });
    expect(sharp.evolutionStable).toBe(0);
  });

  it("scores budgetRespecte by the proportion of envelopes within budget", () => {
    const envelopes = [env({ id: "a", budget: 100 }), env({ id: "b", budget: 100 })];
    const details = score({
      envelopes,
      envelopeSpend: new Map([["a", 150], ["b", 80]]),
    });
    expect(details.budgetRespecte).toBe(10); // 1/2 × 20

    const detailsAll = score({
      envelopes,
      envelopeSpend: new Map([["a", 100], ["b", 80]]),
    });
    expect(detailsAll.budgetRespecte).toBe(20);
  });

  it("scores regularity from the coefficient of variation of daily spending", () => {
    const regular = score({
      dailySpend: new Map([
        ["2026-01-01", 10], ["2026-01-02", 10], ["2026-01-03", 10], ["2026-01-04", 10],
      ]),
    });
    expect(regular.regulariteDepenses).toBe(20); // cv = 0

    // cv = 0.9 → fairly regular (15 pts)
    const chaotic = score({
      dailySpend: new Map([
        ["2026-01-01", 5], ["2026-01-02", 95], ["2026-01-03", 5], ["2026-01-04", 95],
      ]),
    });
    expect(chaotic.regulariteDepenses).toBe(15);

    // cv ≈ 2.97 → very chaotic (0 pts)
    const veryChaotic = score({
      dailySpend: new Map([
        ["2026-01-01", 1000],
        ["2026-01-02", 1], ["2026-01-03", 1], ["2026-01-04", 1], ["2026-01-05", 1],
        ["2026-01-06", 1], ["2026-01-07", 1], ["2026-01-08", 1], ["2026-01-09", 1],
        ["2026-01-10", 1],
      ]),
    });
    expect(veryChaotic.regulariteDepenses).toBe(0);
  });

  it("penalizes single transactions that dwarf their envelope budget", () => {
    const envelopes = [env({ id: "a", budget: 100 })];
    const impulse = score({
      envelopes,
      expenseTransactions: [tx({ amount: 300, envelopeId: "a" })],
    });
    expect(impulse.sansDepensesImpulsives).toBe(0); // ratio 3

    const moderate = score({
      envelopes,
      expenseTransactions: [tx({ amount: 60, envelopeId: "a" })],
    });
    expect(moderate.sansDepensesImpulsives).toBe(5); // ratio 0.6 ∈ (0.5, 0.75]

    const reasonable = score({
      envelopes,
      expenseTransactions: [tx({ amount: 20, envelopeId: "a" })],
    });
    expect(reasonable.sansDepensesImpulsives).toBe(10); // ratio 0.2
  });

  it("computes the total as the sum of the five signals", () => {
    const details = score({
      totalDepenses: 1320,
      currentPeriodSpend: 1320,
      envelopes: [env({ id: "a", budget: 100 })],
      envelopeSpend: new Map([["a", 150]]),
      expenseTransactions: [tx({ amount: 200, envelopeId: "a" })],
    });
    expect(details.total).toBe(details.depensesVsRevenus + details.evolutionStable + details.budgetRespecte + details.regulariteDepenses + details.sansDepensesImpulsives);
  });
});

describe("spendByEnvelope", () => {
  it("aggregates and sorts expenses per envelope, excluding income", () => {
    const today = new Date(2026, 0, 15);
    const transactions = [
      tx({ amount: 100, date: new Date(2026, 0, 5, 12).toISOString(), envelopeId: "a" }),
      tx({ amount: 30, date: new Date(2026, 0, 6, 12).toISOString(), envelopeId: "b" }),
      tx({ amount: 20, date: new Date(2026, 0, 7, 12).toISOString(), envelopeId: "a" }),
      tx({ amount: 500, date: new Date(2026, 0, 8, 12).toISOString(), type: "income" }),
      tx({ amount: 999, date: new Date(2025, 11, 5, 12).toISOString(), envelopeId: "a" }), // hors période
    ];
    const result = spendByEnvelope(
      computeAnalysis({ monthlyIncome: 2000, monthlySavings: 0, period: "month", monthDate: today, today, transactions, envelopes: [] }),
      [env({ id: "a", budget: 300, name: "Courses" }), env({ id: "b", budget: 100, name: "Transport" })],
      transactions,
      "month",
      today,
      today,
    );

    expect(result).toEqual([
      { envelopeId: "a", name: "Courses", color: "bg-red-500", value: 120 },
      { envelopeId: "b", name: "Transport", color: "bg-red-500", value: 30 },
    ]);
  });
});
