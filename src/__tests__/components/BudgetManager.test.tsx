import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BudgetManager from "@/components/settings/BudgetManager";
import { MAX_BUDGETS } from "@/types/budget";

const useAuthMock = jest.fn();
const useBudgetMock = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

jest.mock("@/context/BudgetContext", () => ({
  useBudget: () => useBudgetMock(),
}));

const saveBudgetMock = jest.fn();
const deleteBudgetPermanentlyMock = jest.fn();

jest.mock("@/lib/budgetService", () => ({
  saveBudget: (...args: unknown[]) => saveBudgetMock(...args),
  deleteBudgetPermanently: (...args: unknown[]) => deleteBudgetPermanentlyMock(...args),
}));

const refreshBudgetsMock = jest.fn();

const BUDGET_A = {
  id: "budget-1",
  name: "Maison",
  icon: "Home",
  color: "bg-blue-500",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function mockContext(budgets: unknown[] = [BUDGET_A]) {
  useBudgetMock.mockReturnValue({
    budgets,
    currentBudgetId: "default",
    loading: false,
    switchBudget: jest.fn(),
    refreshBudgets: refreshBudgetsMock,
  });
}

async function openCreateForm() {
  await userEvent.click(screen.getByTestId("budget-create"));
  expect(screen.getByTestId("budget-form")).toBeInTheDocument();
}

describe("BudgetManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { uid: "user-1" }, loading: false });
    refreshBudgetsMock.mockResolvedValue(undefined);
    saveBudgetMock.mockResolvedValue({
      id: "budget-1",
      name: "Maison",
      icon: "Home",
      color: "bg-blue-500",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    deleteBudgetPermanentlyMock.mockResolvedValue(undefined);
  });

  it("affiche la section, le budget par défaut, la liste et le compteur", () => {
    mockContext();

    render(<BudgetManager />);

    expect(screen.getByTestId("budget-manager")).toBeInTheDocument();
    expect(screen.getByText("Budget par défaut")).toBeInTheDocument();
    expect(screen.getByTestId("budget-row-budget-1")).toHaveTextContent("Maison");
    expect(screen.getByText(`1/${MAX_BUDGETS} budgets`)).toBeInTheDocument();
  });

  it("crée un budget sur le premier slot libre", async () => {
    mockContext([]);

    render(<BudgetManager />);
    await openCreateForm();

    await userEvent.type(screen.getByTestId("budget-form-name"), "Compte joint");
    await userEvent.click(screen.getByTestId("budget-form-save"));

    await waitFor(() =>
      expect(saveBudgetMock).toHaveBeenCalledWith("user-1", "budget-1", {
        name: "Compte joint",
        icon: "Wallet",
        color: "bg-amber-500",
      }),
    );
    await waitFor(() => expect(refreshBudgetsMock).toHaveBeenCalled());
  });

  it("rejette un nom vide avec un message français", async () => {
    mockContext([]);

    render(<BudgetManager />);
    await openCreateForm();

    await userEvent.click(screen.getByTestId("budget-form-save"));

    expect(await screen.findByTestId("budget-form-error")).toHaveTextContent(
      "nom",
    );
    expect(saveBudgetMock).not.toHaveBeenCalled();
  });

  it("édite un budget existant (slot conservé)", async () => {
    mockContext();

    render(<BudgetManager />);
    await userEvent.click(screen.getByTestId("budget-edit-budget-1"));

    const nameInput = screen.getByTestId("budget-form-name") as HTMLInputElement;
    expect(nameInput.value).toBe("Maison");

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Résidence");
    await userEvent.click(screen.getByTestId("budget-form-save"));

    await waitFor(() =>
      expect(saveBudgetMock).toHaveBeenCalledWith("user-1", "budget-1", {
        name: "Résidence",
        icon: "Home",
        color: "bg-blue-500",
      }),
    );
  });

  it("supprime définitivement après confirmation", async () => {
    mockContext([BUDGET_A]);

    render(<BudgetManager />);
    await userEvent.click(screen.getByTestId("budget-delete-budget-1"));
    expect(
      screen.getByTestId("budget-delete-confirm-budget-1"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("budget-delete-confirm-budget-1"));

    await waitFor(() =>
      expect(deleteBudgetPermanentlyMock).toHaveBeenCalledWith(
        expect.any(Function),
        "budget-1",
      ),
    );
    await waitFor(() => expect(refreshBudgetsMock).toHaveBeenCalled());
  });

  it("désactive la création quand les 5 slots sont occupés", () => {
    const five = ["budget-1", "budget-2", "budget-3", "budget-4", "budget-5"].map(
      (id) => ({ ...BUDGET_A, id }),
    );
    mockContext(five);

    render(<BudgetManager />);

    expect(screen.getByTestId("budget-create")).toBeDisabled();
    expect(screen.getByText(`5/${MAX_BUDGETS} budgets`)).toBeInTheDocument();
  });
});
