import { findExceptionalSpendingInsight } from "@/lib/spendingInsights";

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
