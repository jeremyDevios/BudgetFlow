import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import EnvelopeDetailClient from "@/app/(protected)/envelopes/[id]/EnvelopeDetailClient";

const pushMock = jest.fn();
const backMock = jest.fn();
const getDocMock = jest.fn();
const getDocsMock = jest.fn();
const useSpendingForecastMock = jest.fn();
const useSmartSpendingInsightsMock = jest.fn();
let getDocsCallIndex = 0;

jest.mock("react", () => {
  const actual = jest.requireActual("react") as typeof import("react");

  return {
    ...actual,
    use: (value: unknown) => value,
  };
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    back: backMock,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "user-1" },
  }),
}));

jest.mock("@/context/AnonymousModeContext", () => ({
  useAnonymousMode: () => ({
    anonymousMode: false,
  }),
}));

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("@/hooks/useSpendingForecast", () => ({
  useSpendingForecast: (...args: unknown[]) => useSpendingForecastMock(...args),
}));

jest.mock("@/hooks/useSmartSpendingInsights", () => ({
  useSmartSpendingInsights: (...args: unknown[]) =>
    useSmartSpendingInsightsMock(...args),
}));

jest.mock("@/components/dashboard/TransactionModal", () => ({
  __esModule: true,
  default: () => <div data-testid="transaction-modal" />,
}));

jest.mock("@/components/dashboard/RotatingSmartInsight", () => ({
  __esModule: true,
  default: () => <div data-testid="rotating-smart-insight" />,
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ type: "collection" })),
  query: jest.fn(() => ({ type: "query" })),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  doc: jest.fn(() => ({ type: "doc" })),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  orderBy: jest.fn(() => ({ type: "orderBy" })),
  limit: jest.fn(() => ({ type: "limit" })),
  where: jest.fn(() => ({ type: "where" })),
  deleteDoc: jest.fn(),
}));

jest.mock("framer-motion", () => {
  const React = require("react") as typeof import("react");
  const motionProps = new Set([
    "animate",
    "exit",
    "initial",
    "layout",
    "transition",
    "variants",
    "whileHover",
    "whileTap",
  ]);

  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        React.forwardRef(({ children, ...props }: any, ref) => {
          const domProps = Object.fromEntries(
            Object.entries(props).filter(([key]) => !motionProps.has(key))
          );

          return React.createElement(tag, { ...domProps, ref }, children);
        }),
    }
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

function createDocSnapshot(data: Record<string, unknown>) {
  return {
    id: "env-1",
    exists: () => true,
    data: () => data,
  };
}

function createCollectionSnapshot(items: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    forEach: (
      callback: (doc: { id: string; data: () => Record<string, unknown> }) => void
    ) => {
      items.forEach((item) => {
        callback({
          id: item.id,
          data: () => item.data,
        });
      });
    },
  };
}

function renderClient() {
  render(
    <EnvelopeDetailClient
      params={{ id: "env-1" } as unknown as Promise<{ id: string }>}
    />
  );
}

describe("EnvelopeDetailClient", () => {
  const now = new Date();
  const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  beforeEach(() => {
    getDocsCallIndex = 0;
    pushMock.mockReset();
    backMock.mockReset();
    getDocMock.mockReset();
    getDocsMock.mockReset();
    useSpendingForecastMock.mockReset();
    useSmartSpendingInsightsMock.mockReset();

    useSmartSpendingInsightsMock.mockReturnValue({
      envelopeNotifications: {},
      loading: false,
    });

    getDocMock.mockResolvedValue(
      createDocSnapshot({
        name: "Courses",
        budget: 150,
        icon: "ShoppingCart",
        color: "bg-blue-500",
      })
    );

    const allEnvelopesSnapshot = createCollectionSnapshot([
      {
        id: "env-1",
        data: {
          name: "Courses",
          budget: 150,
          icon: "ShoppingCart",
          color: "bg-blue-500",
        },
      },
    ]);

    const transactionsSnapshot = createCollectionSnapshot([
      {
        id: "tx-1",
        data: {
          amount: 40,
          description: "Marché",
          envelopeId: "env-1",
          date: `${currentMonthIso}-03T12:00:00.000Z`,
        },
      },
      {
        id: "tx-2",
        data: {
          amount: 50,
          description: "Supermarché",
          envelopeId: "env-1",
          date: `${currentMonthIso}-05T12:00:00.000Z`,
        },
      },
    ]);

    getDocsMock.mockImplementation(async () => {
      const nextSnapshot =
        getDocsCallIndex % 2 === 0 ? allEnvelopesSnapshot : transactionsSnapshot;
      getDocsCallIndex += 1;
      return nextSnapshot;
    });
  });

  it("shows both the real current-month progress bar and the projected progress bar", async () => {
    useSpendingForecastMock.mockReturnValue({
      envelopeForecasts: {
        "env-1": {
          envelopeId: "env-1",
          projectedSpend: 160,
          projectedRemaining: -10,
          percentOfBudget: 106.67,
          willExceed: true,
          excessAmount: 10,
          hasData: true,
          confidenceScore: 1,
          monthsWithData: 3,
        },
      },
      loading: false,
    });

    renderClient();

    await waitFor(() =>
      expect(screen.getByText(/Progression réelle du mois/i)).toBeInTheDocument()
    );

    expect(screen.getByText(/90.00 € \/ 150.00 €/i)).toBeInTheDocument();
    expect(screen.getByText(/60% du budget consommé à date/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Progression réelle du mois/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Risque de dépassement : \+10.00 €/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Progression estimée fin de mois/i)
    ).toBeInTheDocument();
  });

  it("keeps the real current-month progress bar visible even without forecast history", async () => {
    useSpendingForecastMock.mockReturnValue({
      envelopeForecasts: {},
      loading: false,
    });

    renderClient();

    await waitFor(() =>
      expect(screen.getByText(/Progression réelle du mois/i)).toBeInTheDocument()
    );

    expect(screen.getByText(/90.00 € \/ 150.00 €/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Pas assez d'historique pour estimer cette enveloppe/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Progression estimée fin de mois/i)
    ).not.toBeInTheDocument();
  });
});
