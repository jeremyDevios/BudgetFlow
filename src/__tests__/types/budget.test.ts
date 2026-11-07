import {
  BUDGET_SLOT_IDS,
  DEFAULT_BUDGET_ID,
  MAX_BUDGETS,
  findAvailableSlotId,
  isBudgetActive,
  isValidBudgetId,
  resolveCurrentBudgetId,
  type Budget,
} from "@/types/budget";

function makeBudget(id: string, overrides: Partial<Budget> = {}): Budget {
  return {
    id: id as Budget["id"],
    name: "Test",
    icon: "Wallet",
    color: "bg-amber-500",
    createdAt: "2026-11-03T00:00:00.000Z",
    updatedAt: "2026-11-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("isValidBudgetId", () => {
  it.each(["budget-1", "budget-2", "budget-3", "budget-4", "budget-5"])(
    "accepte le slot %s",
    (slot) => {
      expect(isValidBudgetId(slot)).toBe(true);
    }
  );

  it.each([
    "budget-6",
    "budget-0",
    "budget",
    "default",
    "",
    1,
    null,
    undefined,
    {},
  ])("rejette %p", (value) => {
    expect(isValidBudgetId(value)).toBe(false);
  });
});

describe("slots & limite", () => {
  it("expose exactement 5 slots fixes (miroir des règles Firestore)", () => {
    expect(BUDGET_SLOT_IDS).toHaveLength(5);
    expect(MAX_BUDGETS).toBe(5);
  });
});

describe("isBudgetActive", () => {
  it("est actif sans deletedAt", () => {
    expect(isBudgetActive(makeBudget("budget-1"))).toBe(true);
  });

  it("est inactif avec deletedAt (soft-delete)", () => {
    expect(
      isBudgetActive(makeBudget("budget-1", { deletedAt: "2026-11-01T00:00:00Z" }))
    ).toBe(false);
  });
});

describe("findAvailableSlotId", () => {
  it("retourne budget-1 quand aucun budget n'existe", () => {
    expect(findAvailableSlotId([])).toBe("budget-1");
  });

  it("retourne le premier slot libre dans l'ordre", () => {
    expect(findAvailableSlotId([makeBudget("budget-1"), makeBudget("budget-3")])).toBe(
      "budget-2"
    );
  });

  it("un budget soft-deleté occupe toujours son slot (restaurable)", () => {
    const deleted = makeBudget("budget-1", { deletedAt: "2026-11-01T00:00:00Z" });
    expect(findAvailableSlotId([deleted])).toBe("budget-2");
  });

  it("retourne null quand les 5 slots sont occupés (y compris soft-deletés)", () => {
    const budgets = BUDGET_SLOT_IDS.map((id, index) =>
      makeBudget(id, index === 4 ? { deletedAt: "2026-11-01T00:00:00Z" } : {})
    );
    expect(findAvailableSlotId(budgets)).toBeNull();
  });
});

describe("resolveCurrentBudgetId", () => {
  const liveBudget = makeBudget("budget-1");
  const deletedBudget = makeBudget("budget-2", {
    deletedAt: "2026-11-01T00:00:00Z",
  });

  it("'default' → budget par défaut", () => {
    expect(resolveCurrentBudgetId(DEFAULT_BUDGET_ID, [liveBudget])).toBe(
      DEFAULT_BUDGET_ID
    );
  });

  it("slot vivant → lui-même", () => {
    expect(resolveCurrentBudgetId("budget-1", [liveBudget])).toBe("budget-1");
  });

  it("slot soft-deleté → repli défaut", () => {
    expect(resolveCurrentBudgetId("budget-2", [deletedBudget])).toBe(
      DEFAULT_BUDGET_ID
    );
  });

  it.each(["budget-9", "foo", "", 42, null, undefined, {}])(
    "valeur inconnue/invalide %p → repli défaut",
    (value) => {
      expect(resolveCurrentBudgetId(value, [liveBudget])).toBe(DEFAULT_BUDGET_ID);
    }
  );
});
