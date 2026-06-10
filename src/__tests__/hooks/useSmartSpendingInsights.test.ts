import { renderHook } from "@testing-library/react";

import { useSmartSpendingInsights } from "@/hooks/useSmartSpendingInsights";

const getDocsMock = jest.fn();

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ type: "collection" })),
  query: jest.fn(() => ({ type: "query" })),
  where: jest.fn(() => ({ type: "where" })),
  limit: jest.fn(() => ({ type: "limit" })),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
}));

describe("useSmartSpendingInsights", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
  });

  it("returns an empty state without fetching when the hook is inactive", () => {
    const { result, rerender } = renderHook(
      (props: { envelopes: Array<{ id: string; name: string; budget: number }> }) =>
        useSmartSpendingInsights({
          userId: null,
          envelopes: props.envelopes,
          currentMonthTransactions: [],
          envelopeForecasts: {},
          isCurrentMonth: true,
        }),
      {
        initialProps: {
          envelopes: [{ id: "env-1", name: "Courses", budget: 120 }],
        },
      }
    );

    expect(result.current).toEqual({
      globalNotifications: [],
      envelopeNotifications: {},
      loading: false,
    });
    expect(getDocsMock).not.toHaveBeenCalled();

    rerender({
      envelopes: [{ id: "env-1", name: "Courses", budget: 120 }],
    });

    expect(result.current).toEqual({
      globalNotifications: [],
      envelopeNotifications: {},
      loading: false,
    });
    expect(getDocsMock).not.toHaveBeenCalled();
  });
});
