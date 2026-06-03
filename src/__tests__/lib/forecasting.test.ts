import { computeForecast } from "@/lib/forecasting";

describe("computeForecast", () => {
  it("returns an empty forecast when there are no envelopes", () => {
    const result = computeForecast({
      envelopes: [],
      pastTransactions: [],
      currentMonthTransactions: [],
      monthlyBudget: 1200,
      today: new Date(2026, 3, 10),
      pastMonthCount: 3,
    });

    expect(result).toEqual({
      globalForecast: {
        projectedTotal: 0,
        projectedRemaining: 1200,
        willExceed: false,
        excessAmount: 0,
        confidenceScore: 0,
        hasEnoughData: false,
      },
      envelopeForecasts: {},
    });
  });

  it("keeps current spend only when there is no usable history", () => {
    const result = computeForecast({
      envelopes: [{ id: "groceries", budget: 300, name: "Courses" }],
      pastTransactions: [{ envelopeId: "groceries", amount: 120, date: "invalid-date" }],
      currentMonthTransactions: [
        { envelopeId: "groceries", amount: 80, date: "2026-04-08T12:00:00" },
      ],
      monthlyBudget: 300,
      today: new Date(2026, 3, 10),
      pastMonthCount: 3,
    });

    expect(result.globalForecast).toEqual({
      projectedTotal: 80,
      projectedRemaining: 220,
      willExceed: false,
      excessAmount: 0,
      confidenceScore: 0,
      hasEnoughData: false,
    });
    expect(result.envelopeForecasts.groceries).toEqual({
      envelopeId: "groceries",
      projectedSpend: 80,
      projectedRemaining: 220,
      percentOfBudget: (80 / 300) * 100,
      willExceed: false,
      excessAmount: 0,
      hasData: false,
      confidenceScore: 0,
      monthsWithData: 0,
    });
  });

  it("projects future spending from the last observed months and computes confidence", () => {
    const result = computeForecast({
      envelopes: [
        { id: "groceries", budget: 300, name: "Courses" },
        { id: "fun", budget: 150, name: "Sorties" },
      ],
      pastTransactions: [
        { envelopeId: "groceries", amount: 120, date: "2026-01-15T12:00:00" },
        { envelopeId: "groceries", amount: 150, date: "2026-02-15T12:00:00" },
        { envelopeId: "groceries", amount: 90, date: "2026-03-15T12:00:00" },
        { envelopeId: "fun", amount: 60, date: "2026-01-08T12:00:00" },
        { envelopeId: "fun", amount: 90, date: "2026-03-08T12:00:00" },
      ],
      currentMonthTransactions: [
        { envelopeId: "groceries", amount: 100, date: "2026-04-01T12:00:00" },
        { envelopeId: "fun", amount: 40, date: "2026-04-02T12:00:00" },
      ],
      monthlyBudget: 450,
      today: new Date(2026, 3, 10),
      pastMonthCount: 3,
    });

    const groceriesForecast = result.envelopeForecasts.groceries;
    const funForecast = result.envelopeForecasts.fun;

    expect(groceriesForecast.projectedSpend).toBeCloseTo(184, 5);
    expect(groceriesForecast.projectedRemaining).toBeCloseTo(116, 5);
    expect(groceriesForecast.percentOfBudget).toBeCloseTo((184 / 300) * 100, 5);
    expect(groceriesForecast.hasData).toBe(true);
    expect(groceriesForecast.confidenceScore).toBe(1);
    expect(groceriesForecast.monthsWithData).toBe(3);

    expect(funForecast.projectedSpend).toBeCloseTo(75, 5);
    expect(funForecast.projectedRemaining).toBeCloseTo(75, 5);
    expect(funForecast.percentOfBudget).toBeCloseTo(50, 5);
    expect(funForecast.hasData).toBe(true);
    expect(funForecast.confidenceScore).toBeCloseTo(2 / 3, 5);
    expect(funForecast.monthsWithData).toBe(2);

    expect(result.globalForecast.projectedTotal).toBeCloseTo(259, 5);
    expect(result.globalForecast.projectedRemaining).toBeCloseTo(191, 5);
    expect(result.globalForecast.willExceed).toBe(false);
    expect(result.globalForecast.excessAmount).toBe(0);
    expect(result.globalForecast.confidenceScore).toBeCloseTo(5 / 6, 5);
    expect(result.globalForecast.hasEnoughData).toBe(true);
  });

  it("flags global and envelope overruns when the projected total exceeds budget", () => {
    const result = computeForecast({
      envelopes: [{ id: "rent", budget: 100, name: "Autres" }],
      pastTransactions: [
        { envelopeId: "rent", amount: 200, date: "2026-01-12T12:00:00" },
        { envelopeId: "rent", amount: 200, date: "2026-02-12T12:00:00" },
        { envelopeId: "rent", amount: 200, date: "2026-03-12T12:00:00" },
      ],
      currentMonthTransactions: [
        { envelopeId: "rent", amount: 90, date: "2026-04-02T12:00:00" },
      ],
      monthlyBudget: 100,
      today: new Date(2026, 3, 10),
      pastMonthCount: 3,
    });

    expect(result.envelopeForecasts.rent.willExceed).toBe(true);
    expect(result.envelopeForecasts.rent.excessAmount).toBeCloseTo(130, 5);
    expect(result.globalForecast.willExceed).toBe(true);
    expect(result.globalForecast.excessAmount).toBeCloseTo(130, 5);
  });

  it("subtracts reimbursement amounts from past and current month spending", () => {
    // A reimbursement should reduce net spending, not inflate it
    const result = computeForecast({
      envelopes: [{ id: "health", budget: 100, name: "Santé" }],
      pastTransactions: [
        { envelopeId: "health", amount: 905, date: "2026-01-10T12:00:00", isReimbursement: true },
        { envelopeId: "health", amount: 50, date: "2026-01-15T12:00:00" },
        { envelopeId: "health", amount: 60, date: "2026-02-10T12:00:00" },
        { envelopeId: "health", amount: 55, date: "2026-03-10T12:00:00" },
      ],
      currentMonthTransactions: [
        { envelopeId: "health", amount: 30, date: "2026-04-05T12:00:00" },
        { envelopeId: "health", amount: 200, date: "2026-04-08T12:00:00", isReimbursement: true },
      ],
      monthlyBudget: 100,
      today: new Date(2026, 3, 10),
      pastMonthCount: 3,
    });

    // With reimbursement negated:
    // Jan: 50 - 905 = -855, Feb: 60, Mar: 55 → avg = (-855+60+55)/3 = -246.67
    // Current: 30 - 200 = -170
    // projectedSpend clamped to currentSpent = -170, well under budget of 100
    const forecast = result.envelopeForecasts.health;
    expect(forecast.willExceed).toBe(false);
    expect(forecast.projectedSpend).toBeLessThan(100);
  });

  it("handles zero budget envelopes without dividing by zero", () => {
    const result = computeForecast({
      envelopes: [{ id: "misc", budget: 0, name: "Divers" }],
      pastTransactions: [
        { envelopeId: "misc", amount: 30, date: "2026-01-05T12:00:00" },
      ],
      currentMonthTransactions: [
        { envelopeId: "misc", amount: 10, date: "2026-04-05T12:00:00" },
      ],
      monthlyBudget: 0,
      today: new Date(2026, 3, 10),
      pastMonthCount: 1,
    });

    expect(result.envelopeForecasts.misc.percentOfBudget).toBe(0);
    expect(result.envelopeForecasts.misc.willExceed).toBe(false);
    expect(result.globalForecast.willExceed).toBe(false);
  });
});
