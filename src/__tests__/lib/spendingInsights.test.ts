import type { EnvelopeForecast } from "@/lib/forecasting";
import {
  buildSmartSpendingNotifications,
  findExceptionalSpendingInsight,
} from "@/lib/spendingInsights";

describe("findExceptionalSpendingInsight", () => {
  it("returns null when no transaction is exceptional for its envelope budget", () => {
    const result = findExceptionalSpendingInsight({
      envelopes: [
        { id: "groceries", name: "Courses", budget: 500 },
        { id: "transport", name: "Transport", budget: 120 },
      ],
      transactions: [
        {
          id: "tx-1",
          amount: 200,
          description: "Grosse commande",
          envelopeId: "groceries",
          date: "2026-04-13T12:00:00",
        },
        {
          id: "tx-2",
          amount: 40,
          description: "Plein",
          envelopeId: "transport",
          date: "2026-04-13T12:00:00",
        },
      ],
    });

    expect(result).toBeNull();
  });

  it("returns the most exceptional transaction when one exceeds its envelope budget", () => {
    const result = findExceptionalSpendingInsight({
      envelopes: [
        { id: "groceries", name: "Courses", budget: 100 },
        { id: "transport", name: "Transport", budget: 80 },
      ],
      transactions: [
        {
          id: "tx-1",
          amount: 200,
          description: "Courses du mois",
          envelopeId: "groceries",
          date: "2026-04-13T12:00:00",
        },
        {
          id: "tx-2",
          amount: 90,
          description: "Réparation vélo",
          envelopeId: "transport",
          date: "2026-04-13T12:00:00",
        },
      ],
    });

    expect(result).toEqual({
      transactionId: "tx-1",
      transactionName: "Courses du mois",
      amount: 200,
      envelopeId: "groceries",
      envelopeName: "Courses",
      envelopeBudget: 100,
      budgetRatio: 2,
    });
  });

  it("falls back to a default label when the transaction has no description", () => {
    const result = findExceptionalSpendingInsight({
      envelopes: [{ id: "misc", name: "Divers", budget: 50 }],
      transactions: [
        {
          id: "tx-1",
          amount: 60,
          description: "   ",
          envelopeId: "misc",
          date: "2026-04-13T12:00:00",
        },
      ],
    });

    expect(result?.transactionName).toBe("Dépense sans libellé");
  });
});

describe("buildSmartSpendingNotifications", () => {
  const today = new Date("2026-03-10T12:00:00.000Z");

  function forecast(
    envelopeId: string,
    overrides: Partial<EnvelopeForecast>
  ): EnvelopeForecast {
    return {
      envelopeId,
      projectedSpend: 0,
      projectedRemaining: 0,
      percentOfBudget: 0,
      willExceed: false,
      excessAmount: 0,
      hasData: true,
      confidenceScore: 1,
      monthsWithData: 3,
      ...overrides,
    };
  }

  it("returns an exceptional-spending notification for the dashboard and the envelope", () => {
    const result = buildSmartSpendingNotifications({
      today,
      envelopes: [{ id: "leisure", name: "Loisirs", budget: 120 }],
      transactions: [
        {
          id: "tx-exceptional",
          amount: 145,
          description: "Concert",
          envelopeId: "leisure",
          date: "2026-03-08T18:30:00",
        },
      ],
      envelopeForecasts: {
        leisure: forecast("leisure", {
          projectedSpend: 150,
          projectedRemaining: -30,
          percentOfBudget: 125,
          willExceed: true,
          excessAmount: 30,
        }),
      },
    });

    expect(result.globalNotifications[0]).toMatchObject({
      kind: "exceptional_spending",
      envelopeId: "leisure",
      title: "Dépense exceptionnelle détectée",
    });
    expect(result.globalNotifications[0]?.description).toMatch(/Concert/);
    expect(result.envelopeNotifications.leisure?.[0]).toMatchObject({
      kind: "exceptional_spending",
      scope: "envelope",
    });
  });

  it("detects a rapid spending rhythm that risks overrunning the envelope", () => {
    const result = buildSmartSpendingNotifications({
      today,
      envelopes: [{ id: "groceries", name: "Courses", budget: 300 }],
      transactions: [
        {
          id: "tx-1",
          amount: 240,
          description: "Courses hebdo",
          envelopeId: "groceries",
          date: "2026-03-09T12:00:00",
        },
        {
          id: "tx-2",
          amount: 110,
          description: "Courses février",
          envelopeId: "groceries",
          date: "2026-02-10T12:00:00",
        },
        {
          id: "tx-3",
          amount: 120,
          description: "Courses janvier",
          envelopeId: "groceries",
          date: "2026-01-10T12:00:00",
        },
      ],
      envelopeForecasts: {
        groceries: forecast("groceries", {
          projectedSpend: 360,
          projectedRemaining: -60,
          percentOfBudget: 120,
          willExceed: true,
          excessAmount: 60,
        }),
      },
    });

    const notification = result.globalNotifications.find(
      (entry) => entry.kind === "rapid_spending"
    );

    expect(notification).toMatchObject({
      envelopeId: "groceries",
      title: "Rythme trop rapide dans Courses",
      severity: "warning",
    });
    expect(notification?.description).toMatch(/jours/);
    expect(notification?.description).toMatch(/60.00 €/);
    expect(
      result.envelopeNotifications.groceries?.some(
        (entry) => entry.kind === "rapid_spending"
      )
    ).toBe(true);
  });

  it("detects an envelope that is frequently exceeded across three months", () => {
    const result = buildSmartSpendingNotifications({
      today,
      envelopes: [{ id: "transport", name: "Transport", budget: 100 }],
      transactions: [
        {
          id: "tx-jan",
          amount: 120,
          description: "Essence",
          envelopeId: "transport",
          date: "2026-01-05T09:00:00",
        },
        {
          id: "tx-feb",
          amount: 130,
          description: "Essence",
          envelopeId: "transport",
          date: "2026-02-06T09:00:00",
        },
        {
          id: "tx-mar",
          amount: 70,
          description: "Essence",
          envelopeId: "transport",
          date: "2026-03-06T09:00:00",
        },
      ],
      envelopeForecasts: {
        transport: forecast("transport", {
          projectedSpend: 140,
          projectedRemaining: -40,
          percentOfBudget: 140,
          willExceed: true,
          excessAmount: 40,
        }),
      },
    });

    const notification = result.globalNotifications.find(
      (entry) => entry.kind === "frequent_overspend"
    );

    expect(notification).toMatchObject({
      envelopeId: "transport",
      matchCount: 3,
      observedMonthCount: 3,
      suggestedBudget: 143,
    });
    expect(notification?.description).toMatch(/143.00 €/);
    expect(
      result.envelopeNotifications.transport?.some(
        (entry) => entry.kind === "frequent_overspend"
      )
    ).toBe(true);
  });

  it("detects an envelope that stays far below budget for three months", () => {
    const result = buildSmartSpendingNotifications({
      today,
      envelopes: [{ id: "shopping", name: "Shopping", budget: 200 }],
      transactions: [
        {
          id: "tx-jan",
          amount: 50,
          description: "Vêtements",
          envelopeId: "shopping",
          date: "2026-01-05T09:00:00",
        },
        {
          id: "tx-feb",
          amount: 60,
          description: "Chaussures",
          envelopeId: "shopping",
          date: "2026-02-06T09:00:00",
        },
        {
          id: "tx-mar",
          amount: 20,
          description: "Accessoires",
          envelopeId: "shopping",
          date: "2026-03-03T09:00:00",
        },
      ],
      envelopeForecasts: {
        shopping: forecast("shopping", {
          projectedSpend: 70,
          projectedRemaining: 130,
          percentOfBudget: 35,
          willExceed: false,
          excessAmount: 0,
        }),
      },
    });

    const notification = result.globalNotifications.find(
      (entry) => entry.kind === "frequent_underspend"
    );

    expect(notification).toMatchObject({
      envelopeId: "shopping",
      matchCount: 3,
      suggestedBudget: 63,
      severity: "info",
    });
    expect(notification?.description).toMatch(/63.00 €/);
  });

  it("detects recurring expenses that contribute to an overrun", () => {
    const result = buildSmartSpendingNotifications({
      today,
      envelopes: [{ id: "subscriptions", name: "Abonnements", budget: 120 }],
      transactions: [
        {
          id: "tx-jan",
          amount: 50,
          description: "Netflix",
          envelopeId: "subscriptions",
          date: "2026-01-02T09:00:00",
        },
        {
          id: "tx-feb",
          amount: 55,
          description: "Netflix",
          envelopeId: "subscriptions",
          date: "2026-02-02T09:00:00",
        },
        {
          id: "tx-mar",
          amount: 60,
          description: "Netflix",
          envelopeId: "subscriptions",
          date: "2026-03-02T09:00:00",
        },
        {
          id: "tx-mar-2",
          amount: 70,
          description: "Spotify famille",
          envelopeId: "subscriptions",
          date: "2026-03-03T09:00:00",
        },
      ],
      envelopeForecasts: {
        subscriptions: forecast("subscriptions", {
          projectedSpend: 160,
          projectedRemaining: -40,
          percentOfBudget: 133.33,
          willExceed: true,
          excessAmount: 40,
        }),
      },
    });

    const notification = result.globalNotifications.find(
      (entry) => entry.kind === "recurring_overspend"
    );

    expect(notification).toMatchObject({
      envelopeId: "subscriptions",
      recurringLabel: "Netflix",
      averageRecurringAmount: 55,
      observedMonthCount: 3,
    });
    expect(notification?.description).toMatch(/Netflix/);
    expect(notification?.description).toMatch(/55.00 €/);
  });

  it("returns no smart notifications when spending stays healthy", () => {
    const result = buildSmartSpendingNotifications({
      today,
      envelopes: [{ id: "food", name: "Alimentation", budget: 200 }],
      transactions: [
        {
          id: "tx-jan",
          amount: 140,
          description: "Courses",
          envelopeId: "food",
          date: "2026-01-05T09:00:00",
        },
        {
          id: "tx-feb",
          amount: 145,
          description: "Courses",
          envelopeId: "food",
          date: "2026-02-05T09:00:00",
        },
        {
          id: "tx-mar",
          amount: 60,
          description: "Courses",
          envelopeId: "food",
          date: "2026-03-05T09:00:00",
        },
      ],
      envelopeForecasts: {
        food: forecast("food", {
          projectedSpend: 150,
          projectedRemaining: 50,
          percentOfBudget: 75,
          willExceed: false,
          excessAmount: 0,
        }),
      },
    });

    expect(result.globalNotifications).toEqual([]);
    expect(result.envelopeNotifications).toEqual({});
  });
});
