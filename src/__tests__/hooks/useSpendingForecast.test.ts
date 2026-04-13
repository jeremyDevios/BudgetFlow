import { renderHook, waitFor } from "@testing-library/react";

import { useSpendingForecast } from "@/hooks/useSpendingForecast";

const getDocsMock = jest.fn();

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ type: "collection" })),
  query: jest.fn(() => ({ type: "query" })),
  where: jest.fn(() => ({ type: "where" })),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
}));

function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}T12:00:00`;
}

function createSnapshot(
  transactions: Array<{ envelopeId: string; amount: number; date: string }>
) {
  return {
    forEach: (
      callback: (doc: { data: () => { envelopeId: string; amount: number; date: string } }) => void
    ) => {
      transactions.forEach((transaction) => {
        callback({
          data: () => transaction,
        });
      });
    },
  };
}

describe("useSpendingForecast", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
  });

  it("recomputes the forecast when current month transactions change", async () => {
    const today = new Date();
    const currentMonthDate = formatLocalIsoDate(today);
    const previousMonthDate = formatLocalIsoDate(
      new Date(today.getFullYear(), today.getMonth() - 1, 10)
    );

    getDocsMock.mockResolvedValue(
      createSnapshot([
        {
          envelopeId: "groceries",
          amount: 90,
          date: previousMonthDate,
        },
      ])
    );

    const { result, rerender } = renderHook(
      (props: {
        currentMonthTransactions: Array<{
          envelopeId: string;
          amount: number;
          date: string;
        }>;
      }) =>
        useSpendingForecast({
          userId: "user-1",
          envelopes: [{ id: "groceries", budget: 300, name: "Courses" }],
          currentMonthTransactions: props.currentMonthTransactions,
          monthlyBudget: 300,
          isCurrentMonth: true,
        }),
      {
        initialProps: {
          currentMonthTransactions: [
            {
              envelopeId: "groceries",
              amount: 40,
              date: currentMonthDate,
            },
          ],
        },
      }
    );

    await waitFor(() =>
      expect(result.current.globalForecast?.projectedTotal).toBeDefined()
    );

    const firstProjectedTotal = result.current.globalForecast?.projectedTotal;
    expect(firstProjectedTotal).toBeDefined();

    rerender({
      currentMonthTransactions: [
        {
          envelopeId: "groceries",
          amount: 140,
          date: currentMonthDate,
        },
      ],
    });

    await waitFor(() =>
      expect(result.current.globalForecast?.projectedTotal).toBe(
        (firstProjectedTotal ?? 0) + 100
      )
    );
  });
});
