import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";

import { BudgetProvider, useBudget } from "@/context/BudgetContext";

const useAuthMock = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

const loadBudgetsMock = jest.fn();
const loadCurrentBudgetIdMock = jest.fn();
const switchBudgetMock = jest.fn();

jest.mock("@/lib/budgetService", () => ({
  loadBudgets: (...args: unknown[]) => loadBudgetsMock(...args),
  loadCurrentBudgetId: (...args: unknown[]) => loadCurrentBudgetIdMock(...args),
  switchBudget: (...args: unknown[]) => switchBudgetMock(...args),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BudgetProvider>{children}</BudgetProvider>
);

describe("BudgetContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadBudgetsMock.mockResolvedValue([]);
    loadCurrentBudgetIdMock.mockResolvedValue("default");
    switchBudgetMock.mockResolvedValue(undefined);
  });

  it("charge les budgets et le budget courant au login", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "user-1" }, loading: false });
    loadBudgetsMock.mockResolvedValue([
      {
        id: "budget-1",
        name: "Maison",
        icon: "Home",
        color: "bg-blue-500",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    loadCurrentBudgetIdMock.mockResolvedValue("budget-1");

    const { result } = renderHook(() => useBudget(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.budgets).toHaveLength(1);
    expect(result.current.budgets[0].name).toBe("Maison");
    expect(result.current.currentBudgetId).toBe("budget-1");
    expect(loadBudgetsMock).toHaveBeenCalledWith("user-1");
    expect(loadCurrentBudgetIdMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Array),
    );
  });

  it("sans utilisateur : état vide, budget par défaut, aucune lecture", async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });

    const { result } = renderHook(() => useBudget(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.budgets).toEqual([]);
    expect(result.current.currentBudgetId).toBe("default");
    expect(loadBudgetsMock).not.toHaveBeenCalled();
  });

  it("échec de chargement → repli sûr sur le budget par défaut", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "user-1" }, loading: false });
    loadBudgetsMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useBudget(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.budgets).toEqual([]);
    expect(result.current.currentBudgetId).toBe("default");
  });

  it("switchBudget : bascule optimiste puis persistance", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "user-1" }, loading: false });

    const { result } = renderHook(() => useBudget(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.switchBudget("budget-2");
    });

    expect(result.current.currentBudgetId).toBe("budget-2");
    expect(switchBudgetMock).toHaveBeenCalledWith("user-1", "budget-2");
  });

  it("switchBudget échoué : l'état local reste, la persistance est loguée", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "user-1" }, loading: false });
    switchBudgetMock.mockRejectedValue(new Error("permission denied"));

    const { result } = renderHook(() => useBudget(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.switchBudget("budget-1");
    });

    // Optimiste : l'UI reste sur le budget demandé ; le repli se fera au
    // prochain chargement (loadCurrentBudgetId).
    expect(result.current.currentBudgetId).toBe("budget-1");
  });
});
