import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BudgetSwitcher from "@/components/dashboard/BudgetSwitcher";
import { DEFAULT_BUDGET_LABEL } from "@/lib/budgetPresentation";

const useBudgetMock = jest.fn();
const switchBudgetMock = jest.fn();

jest.mock("@/context/BudgetContext", () => ({
  useBudget: () => useBudgetMock(),
}));

const BUDGET_A = {
  id: "budget-1",
  name: "Maison",
  icon: "Home",
  color: "bg-blue-500",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function mockContext(overrides: Record<string, unknown> = {}) {
  useBudgetMock.mockReturnValue({
    budgets: [BUDGET_A],
    currentBudgetId: "default",
    loading: false,
    switchBudget: switchBudgetMock,
    refreshBudgets: jest.fn(),
    ...overrides,
  });
}

describe("BudgetSwitcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("est masqué quand aucun budget supplémentaire n'existe (UI mono-budget identique)", () => {
    useBudgetMock.mockReturnValue({
      budgets: [],
      currentBudgetId: "default",
      loading: false,
      switchBudget: switchBudgetMock,
      refreshBudgets: jest.fn(),
    });

    const { container } = render(<BudgetSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("affiche le budget par défaut et les budgets avec leur état actif", () => {
    mockContext({ currentBudgetId: "budget-1" });

    render(<BudgetSwitcher />);

    expect(screen.getByTestId("budget-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("budget-chip-default")).toHaveTextContent(
      DEFAULT_BUDGET_LABEL,
    );
    expect(screen.getByTestId("budget-chip-budget-1")).toHaveTextContent("Maison");
    expect(screen.getByTestId("budget-chip-budget-1")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("budget-chip-default")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("bascule vers un budget au clic", async () => {
    mockContext();

    render(<BudgetSwitcher />);
    await userEvent.click(screen.getByTestId("budget-chip-budget-1"));

    expect(switchBudgetMock).toHaveBeenCalledWith("budget-1");
  });

  it("bascule vers le budget par défaut au clic", async () => {
    mockContext({ currentBudgetId: "budget-1" });

    render(<BudgetSwitcher />);
    await userEvent.click(screen.getByTestId("budget-chip-default"));

    expect(switchBudgetMock).toHaveBeenCalledWith("default");
  });
});
