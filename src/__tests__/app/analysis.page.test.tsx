import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AnalysisPage from "@/app/(protected)/analysis/page";
import type { AnalysisPeriod, AnalysisResult } from "@/lib/analysisEngine";

const backMock = jest.fn();
const pushMock = jest.fn();
const useAnalysisMock = jest.fn();
const useAuthMock = jest.fn();
const useAnonymousModeMock = jest.fn();
const formatAmountMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    back: backMock,
    push: pushMock,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

jest.mock("@/context/AnonymousModeContext", () => ({
  useAnonymousMode: () => useAnonymousModeMock(),
}));

jest.mock("@/hooks/useCurrencyFormatting", () => ({
  useCurrencyFormatting: () => ({
    formatAmount: (...args: unknown[]) => formatAmountMock(...args),
    formatAmountNoDecimals: jest.fn(),
    symbol: "€",
    currency: "EUR",
  }),
}));

jest.mock("@/hooks/useAnalysis", () => ({
  useAnalysis: (...args: unknown[]) => useAnalysisMock(...args),
}));

// Déterminisme du rendu : recharts est remplacé par des conteneurs simples.
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Cell: () => null,
}));

jest.mock("framer-motion", () => {
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
      get: (_target, tag: string) => {
        const MockMotionComponent = React.forwardRef<
          HTMLElement,
          React.HTMLAttributes<HTMLElement> & {
            children?: React.ReactNode;
            [key: string]: unknown;
          }
        >(({ children, ...props }, ref) => {
          const domProps = Object.fromEntries(
            Object.entries(props).filter(([key]) => !motionProps.has(key))
          ) as Record<string, unknown>;
          return (React.createElement as any)(tag, { ...domProps, ref }, children);
        });
        MockMotionComponent.displayName = `MockMotion(${tag})`;
        return MockMotionComponent;
      },
    }
  );
  return { motion, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

const fullResult: AnalysisResult = {
  totalDepenses: 900,
  totalRevenus: 300,
  moyenneJourDepense: 30,
  nombreDepenses: 12,
  nombreRevenus: 2,
  medianeJourDepense: 25,
  tauxEpargne: 55.5,
  joursSansDepense: 18,
  enveloppePlusDepenses: {
    envelopeId: "a",
    name: "Courses",
    color: "bg-blue-500",
    value: 400,
  },
  enveloppePlusFrequente: {
    envelopeId: "a",
    name: "Courses",
    color: "bg-blue-500",
    value: 6,
  },
  scoreBilan: 87,
  scoreDetails: {
    depensesVsRevenus: 22,
    evolutionStable: 20,
    budgetRespecte: 15,
    regulariteDepenses: 20,
    sansDepensesImpulsives: 10,
    total: 87,
  },
  dayCount: 30,
  previousPeriodSpend: 800,
  previousDayCount: 30,
};

const chartData = [
  { envelopeId: "a", name: "Courses", color: "bg-blue-500", value: 400 },
  { envelopeId: "b", name: "Transport", color: "bg-red-500", value: 300 },
];

const lastParams: { period?: AnalysisPeriod } = {};
useAnalysisMock.mockImplementation((params: { period: AnalysisPeriod }) => {
  lastParams.period = params.period;
  return {
    result: fullResult,
    spendByEnvelope: chartData,
    monthlyIncome: 4200,
    loading: false,
  };
});

beforeEach(() => {
  backMock.mockReset();
  pushMock.mockReset();
  useAuthMock.mockReset().mockReturnValue({ user: { uid: "u1" } });
  useAnonymousModeMock.mockReset().mockReturnValue({ anonymousMode: false });
  formatAmountMock.mockReset().mockImplementation((v: number) => `${v} €`);
});

describe("AnalysisPage", () => {
  it("renders the score card with the five iOS signals", async () => {
    render(<AnalysisPage />);

    expect(screen.getByText("Analyse")).toBeInTheDocument();
    expect(screen.getByText("Score du budget")).toBeInTheDocument();
    expect(screen.getByText("87")).toBeInTheDocument();

    // Les cinq signaux, libellés iOS réutilisés.
    expect(screen.getByText("Équilibre du budget")).toBeInTheDocument();
    expect(screen.getByText("Variation du rythme de dépense")).toBeInTheDocument();
    expect(screen.getByText("Enveloppes dans les clous")).toBeInTheDocument();
    expect(screen.getByText("Rythme sans écart")).toBeInTheDocument();
    expect(screen.getByText("Peu d'achat démesuré")).toBeInTheDocument();

    // Tendance vs période précédente (800/30 vs 900/30 → +12.5 %).
    expect(screen.getByText(/vs période précédente/i)).toBeInTheDocument();
    expect(screen.getByText(/12\.5 %/)).toBeInTheDocument();
  });

  it("renders the key metrics grid", () => {
    render(<AnalysisPage />);

    expect(screen.getByText("Dépenses")).toBeInTheDocument();
    expect(screen.getByText("Revenus supplémentaires")).toBeInTheDocument();
    expect(screen.getByText("Moy. / jour")).toBeInTheDocument();
    expect(screen.getByText("Médiane / jour")).toBeInTheDocument();
    expect(screen.getByText("Nb dépenses")).toBeInTheDocument();
    expect(screen.getByText("Nb transac revenus")).toBeInTheDocument();
    expect(screen.getByText("Taux d'épargne")).toBeInTheDocument();
    expect(screen.getByText("Jours sans dépense")).toBeInTheDocument();
    expect(screen.getByText("55.5 %")).toBeInTheDocument();
    expect(screen.getByText("18 j")).toBeInTheDocument();
  });

  it("renders the top envelopes and the per-envelope chart", () => {
    render(<AnalysisPage />);

    expect(screen.getByText("Enveloppe la plus dépensée")).toBeInTheDocument();
    expect(screen.getByText("Enveloppe la plus utilisée")).toBeInTheDocument();
    expect(screen.getAllByText("Courses").length).toBeGreaterThan(0);
    expect(screen.getByText("Répartition par enveloppe")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByText("Transport")).toBeInTheDocument();
  });

  it("switches period and forwards it to the hook", async () => {
    const user = userEvent.setup();
    render(<AnalysisPage />);

    expect(lastParams.period).toBe("month");
    await user.click(screen.getByRole("button", { name: "30J" }));
    await waitFor(() => expect(lastParams.period).toBe("last30Days"));

    await user.click(screen.getByRole("button", { name: "6M" }));
    await waitFor(() => expect(lastParams.period).toBe("last6Months"));
  });

  it("shows the empty state when no income is configured", () => {
    useAnalysisMock.mockReturnValueOnce({
      result: null,
      spendByEnvelope: [],
      monthlyIncome: 0,
      loading: false,
    });
    render(<AnalysisPage />);

    expect(
      screen.getByText(/Renseignez vos revenus dans l'onboarding ou les réglages pour accéder aux analyses\./i)
    ).toBeInTheDocument();
    expect(screen.queryByText("Score du budget")).not.toBeInTheDocument();
  });

  it("shows a loader while data is being fetched", () => {
    useAnalysisMock.mockReturnValueOnce({
      result: null,
      spendByEnvelope: [],
      monthlyIncome: 0,
      loading: true,
    });
    render(<AnalysisPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
