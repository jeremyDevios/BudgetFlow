import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import DashboardPage from "@/app/(protected)/dashboard/page";

const pushMock = jest.fn();
const signOutMock = jest.fn();
const getDocMock = jest.fn();
const getDocsMock = jest.fn();
const useSpendingForecastMock = jest.fn();
const findExceptionalSpendingInsightMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "user-1" },
  }),
}));

jest.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
}));

jest.mock("firebase/auth", () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
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
}));

jest.mock("@/hooks/useCalendarHeatmap", () => ({
  useCalendarHeatmap: () => ({
    loginDates: new Set<string>(),
    loading: false,
  }),
}));

jest.mock("@/hooks/useSpendingForecast", () => ({
  useSpendingForecast: (...args: unknown[]) => useSpendingForecastMock(...args),
}));

jest.mock("@/lib/spendingInsights", () => ({
  findExceptionalSpendingInsight: (...args: unknown[]) =>
    findExceptionalSpendingInsightMock(...args),
}));

jest.mock("@/components/dashboard/SearchDropdown", () => ({
  __esModule: true,
  default: () => <div data-testid="search-dropdown" />,
}));

jest.mock("@/components/dashboard/CalendarHeatmap", () => ({
  __esModule: true,
  default: () => <div data-testid="calendar-heatmap" />,
}));

jest.mock("@/components/dashboard/TransactionModal", () => ({
  __esModule: true,
  default: () => <div data-testid="transaction-modal" />,
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

describe("DashboardPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    signOutMock.mockReset();
    getDocMock.mockReset();
    getDocsMock.mockReset();
    useSpendingForecastMock.mockReset();
    findExceptionalSpendingInsightMock.mockReset();

    getDocMock
      .mockResolvedValueOnce(
        createDocSnapshot({
          notificationsEnabled: true,
        })
      )
      .mockResolvedValueOnce(
        createDocSnapshot({
          monthlyIncome: 3000,
          fixedCosts: 1200,
          monthlySavings: 300,
        })
      );

    getDocsMock
      .mockResolvedValueOnce(
        createCollectionSnapshot([
          {
            id: "env-1",
            data: {
              name: "Autres",
              budget: 400,
              icon: "ShoppingCart",
              color: "bg-blue-500",
              order: 0,
            },
          },
        ])
      )
      .mockResolvedValueOnce(
        createCollectionSnapshot([
          {
            id: "tx-1",
            data: {
              amount: 212.66,
              description: "Serveur Web",
              envelopeId: "env-1",
              date: "2026-04-14T12:00:00.000Z",
            },
          },
        ])
      );
  });

  it("shows the empty-estimate message when there is not enough forecast data", async () => {
    useSpendingForecastMock.mockReturnValue({
      globalForecast: null,
      envelopeForecasts: {},
      loading: false,
    });
    findExceptionalSpendingInsightMock.mockReturnValue(null);

    render(<DashboardPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/Pas assez de données pour une estimation/i)
      ).toBeInTheDocument()
    );
    expect(screen.getByText(/Reste disponible/i)).toBeInTheDocument();
    expect(screen.getByTestId("calendar-heatmap")).toBeInTheDocument();
  });

  it("shows the month-end estimate with the exceptional spending warning", async () => {
    useSpendingForecastMock.mockReturnValue({
      globalForecast: {
        projectedTotal: 266.8,
        projectedRemaining: 1233.2,
        willExceed: false,
        excessAmount: 0,
        confidenceScore: 1,
        hasEnoughData: true,
      },
      envelopeForecasts: {},
      loading: false,
    });
    findExceptionalSpendingInsightMock.mockReturnValue({
      transactionId: "tx-1",
      transactionName: "Serveur Web",
      amount: 212.66,
      envelopeId: "env-1",
      envelopeName: "Autres",
      envelopeBudget: 100,
      budgetRatio: 2.1266,
    });

    render(<DashboardPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/Reste: 1233.20 €/i)
      ).toBeInTheDocument()
    );

    expect(
      screen.getByText(/Projection dépenses totales : 266.80 €/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/"Serveur Web"/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Autres/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/213% de l'enveloppe/i)
    ).toBeInTheDocument();
  });

  it("shows the overrun warning when the forecast exceeds the monthly budget", async () => {
    useSpendingForecastMock.mockReturnValue({
      globalForecast: {
        projectedTotal: 1900.38,
        projectedRemaining: -400.38,
        willExceed: true,
        excessAmount: 400.38,
        confidenceScore: 1,
        hasEnoughData: true,
      },
      envelopeForecasts: {},
      loading: false,
    });
    findExceptionalSpendingInsightMock.mockReturnValue(null);

    render(<DashboardPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/Surcoût: 400.38 €/i)
      ).toBeInTheDocument()
    );
    expect(
      screen.getByText(/Projection fin de mois : 1900.38 € de dépenses/i)
    ).toBeInTheDocument();
  });
});
