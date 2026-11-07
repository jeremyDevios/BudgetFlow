import {
  budgetSettingsDocRef,
  budgetsCollectionRef,
  currentBudgetStateRef,
  deleteBudgetPermanently,
  envelopeCountField,
  envelopeDocRef,
  envelopesCollectionRef,
  loadBudgets,
  loadCurrentBudgetId,
  monthlyIncomeDocRef,
  monthlyIncomesCollectionRef,
  normalizeBudgetPayload,
  sanitizeBudgetDocument,
  saveBudget,
  switchBudget,
  transactionDocRef,
  transactionsCollectionRef,
} from "@/lib/budgetService";
import type { Budget } from "@/types/budget";

const docMock = jest.fn((...segments: unknown[]) => ({ type: "doc-ref", segments }));
const collectionMock = jest.fn((...segments: unknown[]) => ({ type: "col-ref", segments }));
const getDocMock = jest.fn();
const getDocsMock = jest.fn();
const setDocMock = jest.fn();
const updateDocMock = jest.fn();

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    sanitizedError: jest.fn(),
  },
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  doc: (...args: unknown[]) => docMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  deleteField: () => ({ type: "delete-field" }),
}));

/** Segments du callIndex-ième appel de collection()/doc(), sans l'instance db. */
function expectSegments(mockFn: jest.Mock, expected: string[], callIndex = 0) {
  expect(mockFn.mock.calls.length).toBeGreaterThan(callIndex);
  expect(mockFn.mock.calls[callIndex].slice(1)).toEqual(expected);
}

const LIVE_BUDGETS: Budget[] = [
  {
    id: "budget-1",
    name: "A",
    icon: "Wallet",
    color: "bg-slate-500",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "budget-2",
    name: "B",
    icon: "Wallet",
    color: "bg-slate-500",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    deletedAt: "2026-02-01T00:00:00Z",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  setDocMock.mockResolvedValue(undefined);
  updateDocMock.mockResolvedValue(undefined);
});

describe("résolution de chemins", () => {
  it("budget par défaut → collections legacy", () => {
    envelopesCollectionRef("user-1", "default");
    expectSegments(collectionMock, ["users", "user-1", "envelopes"], 0);

    transactionsCollectionRef("user-1", "default");
    expectSegments(collectionMock, ["users", "user-1", "transactions"], 1);

    monthlyIncomesCollectionRef("user-1", "default");
    expectSegments(collectionMock, ["users", "user-1", "monthlyIncomes"], 2);
  });

  it("budget slot → sous-collections dédiées", () => {
    envelopesCollectionRef("user-1", "budget-2");
    expectSegments(collectionMock, [
      "users",
      "user-1",
      "budgets",
      "budget-2",
      "envelopes",
    ], 0);

    transactionsCollectionRef("user-1", "budget-2");
    expectSegments(collectionMock, [
      "users",
      "user-1",
      "budgets",
      "budget-2",
      "transactions",
    ], 1);

    monthlyIncomesCollectionRef("user-1", "budget-2");
    expectSegments(collectionMock, [
      "users",
      "user-1",
      "budgets",
      "budget-2",
      "monthlyIncomes",
    ], 2);
  });

  it("settings : legacy vs budget", () => {
    budgetSettingsDocRef("user-1", "default");
    expectSegments(docMock, ["users", "user-1", "settings", "general"], 0);

    budgetSettingsDocRef("user-1", "budget-3");
    expectSegments(docMock, [
      "users",
      "user-1",
      "budgets",
      "budget-3",
      "settings",
      "general",
    ], 1);
  });

  it("state & champ compteur d'enveloppes", () => {
    currentBudgetStateRef("user-1");
    expectSegments(docMock, ["users", "user-1", "state", "currentBudget"]);

    expect(envelopeCountField("default")).toBe("envelopeCount");
    expect(envelopeCountField("budget-4")).toBe("envelopeCounts.budget-4");
  });

  it("resolveurs de documents : legacy vs budget", () => {
    envelopeDocRef("user-1", "default", "env-1");
    expectSegments(docMock, ["users", "user-1", "envelopes", "env-1"], 0);

    envelopeDocRef("user-1", "budget-2", "env-1");
    expectSegments(docMock, ["users", "user-1", "budgets", "budget-2", "envelopes", "env-1"], 1);

    transactionDocRef("user-1", "default", "tx-1");
    expectSegments(docMock, ["users", "user-1", "transactions", "tx-1"], 2);

    transactionDocRef("user-1", "budget-3", "tx-1");
    expectSegments(docMock, ["users", "user-1", "budgets", "budget-3", "transactions", "tx-1"], 3);

    monthlyIncomeDocRef("user-1", "default", "2026-11");
    expectSegments(docMock, ["users", "user-1", "monthlyIncomes", "2026-11"], 4);

    monthlyIncomeDocRef("user-1", "budget-4", "2026-11");
    expectSegments(docMock, ["users", "user-1", "budgets", "budget-4", "monthlyIncomes", "2026-11"], 5);
  });
});

describe("sanitizeBudgetDocument", () => {
  it("passe les champs valides et trime le nom", () => {
    const result = sanitizeBudgetDocument(
      {
        name: "  Compte joint  ",
        icon: "Users",
        color: "bg-emerald-500",
        createdAt: "2026-11-03T00:00:00Z",
        updatedAt: "2026-11-03T00:00:00Z",
      },
      "budget-1"
    );

    expect(result).toEqual({
      id: "budget-1",
      name: "Compte joint",
      icon: "Users",
      color: "bg-emerald-500",
      createdAt: "2026-11-03T00:00:00Z",
      updatedAt: "2026-11-03T00:00:00Z",
      deletedAt: undefined,
    });
  });

  it("nom manquant/vide → repli 'Budget N'", () => {
    expect(
      sanitizeBudgetDocument({ icon: "Users", color: "bg-red-500" }, "budget-2")
        ?.name
    ).toBe("Budget 2");
  });

  it("nom > 50 caractères → tronqué", () => {
    const result = sanitizeBudgetDocument(
      { name: "x".repeat(60), icon: "Users", color: "bg-red-500" },
      "budget-1"
    );
    expect(result?.name).toHaveLength(50);
  });

  it("deletedAt présent → soft-deleté", () => {
    const result = sanitizeBudgetDocument(
      {
        name: "A",
        icon: "Users",
        color: "bg-red-500",
        deletedAt: "2026-11-01T00:00:00Z",
      },
      "budget-1"
    );
    expect(result?.deletedAt).toBe("2026-11-01T00:00:00Z");
  });

  it("dates manquantes → repli déterministe", () => {
    const result = sanitizeBudgetDocument(
      { name: "A", icon: "Users", color: "bg-red-500" },
      "budget-1"
    );
    expect(result?.createdAt).toBe(new Date(0).toISOString());
    expect(result?.updatedAt).toBe(new Date(0).toISOString());
  });

  it("doc inexploitable → null", () => {
    expect(sanitizeBudgetDocument(null as never, "budget-1")).toBeNull();
    expect(sanitizeBudgetDocument("nope" as never, "budget-1")).toBeNull();
  });
});

describe("normalizeBudgetPayload", () => {
  it("valide et trime", () => {
    expect(
      normalizeBudgetPayload({ name: "  Maison ", icon: "Home", color: "bg-blue-500" })
    ).toEqual({ name: "Maison", icon: "Home", color: "bg-blue-500" });
  });

  it("rejette nom vide / > 50 / icône vide / couleur manquante", () => {
    expect(
      normalizeBudgetPayload({ name: "   ", icon: "Home", color: "bg-blue-500" })
    ).toBeNull();
    expect(
      normalizeBudgetPayload({
        name: "x".repeat(51),
        icon: "Home",
        color: "bg-blue-500",
      })
    ).toBeNull();
    expect(
      normalizeBudgetPayload({ name: "Maison", icon: "", color: "bg-blue-500" })
    ).toBeNull();
    expect(normalizeBudgetPayload({ name: "Maison", icon: "Home" })).toBeNull();
  });
});

describe("saveBudget", () => {
  it("crée avec createdAt du jour quand le doc n'existe pas", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });

    const budget = await saveBudget("user-1", "budget-1", {
      name: "Maison",
      icon: "Home",
      color: "bg-blue-500",
    });

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: "Maison",
        icon: "Home",
        color: "bg-blue-500",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    );
    expect(budget?.id).toBe("budget-1");
    expect(budget?.createdAt).toBeDefined();
  });

  it("préserve le createdAt existant (immuable dans les règles)", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ createdAt: "2026-01-01T00:00:00Z" }),
    });

    await saveBudget("user-1", "budget-2", {
      name: "Vacances",
      icon: "Plane",
      color: "bg-rose-500",
    });

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ createdAt: "2026-01-01T00:00:00Z" })
    );
  });

  it("payload invalide → null sans écriture", async () => {
    const result = await saveBudget("user-1", "budget-1", {
      name: "",
      icon: "Home",
      color: "bg-blue-500",
    });

    expect(result).toBeNull();
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it("échec de lecture du doc existant → création sûre (createdAt du jour)", async () => {
    getDocMock.mockRejectedValue(new Error("boom"));

    await saveBudget("user-1", "budget-1", {
      name: "A",
      icon: "B",
      color: "C",
    });

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ createdAt: expect.any(String) })
    );
  });
});

describe("deleteBudgetPermanently", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("appelle la route API admin avec le token et le slot", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as never;

    await deleteBudgetPermanently(async () => "token-123", "budget-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/delete",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
        body: JSON.stringify({ budgetId: "budget-1" }),
      }),
    );
  });

  it("lève l'erreur serveur si la suppression échoue", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server boom" }),
    }) as never;

    await expect(
      deleteBudgetPermanently(async () => "token", "budget-2"),
    ).rejects.toThrow("Server boom");
  });
});

describe("loadBudgets", () => {
  it("trie par ordre de slot et ignore les ids inconnus", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "budget-3",
          data: () => ({
            name: "C",
            icon: "Wallet",
            color: "bg-slate-500",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          }),
        },
        {
          id: "inconnu",
          data: () => ({ name: "X", icon: "Wallet", color: "bg-slate-500" }),
        },
        {
          id: "budget-1",
          data: () => ({
            name: "A",
            icon: "Wallet",
            color: "bg-slate-500",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          }),
        },
      ],
    });

    const budgets = await loadBudgets("user-1");
    expect(budgets.map((budget) => budget.id)).toEqual(["budget-1", "budget-3"]);
  });

  it("retourne [] si la lecture échoue", async () => {
    getDocsMock.mockRejectedValue(new Error("boom"));
    await expect(loadBudgets("user-1")).resolves.toEqual([]);
  });
});

describe("loadCurrentBudgetId", () => {
  it("doc absent → default", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    await expect(loadCurrentBudgetId("user-1", LIVE_BUDGETS)).resolves.toBe(
      "default"
    );
  });

  it("slot vivant → lui-même", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ budgetId: "budget-1" }),
    });
    await expect(loadCurrentBudgetId("user-1", LIVE_BUDGETS)).resolves.toBe(
      "budget-1"
    );
  });

  it("slot soft-deleté → repli défaut", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ budgetId: "budget-2" }),
    });
    await expect(loadCurrentBudgetId("user-1", LIVE_BUDGETS)).resolves.toBe(
      "default"
    );
  });

  it("id inconnu → repli défaut", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ budgetId: "budget-9" }),
    });
    await expect(loadCurrentBudgetId("user-1", LIVE_BUDGETS)).resolves.toBe(
      "default"
    );
  });

  it("lecture en échec → repli défaut", async () => {
    getDocMock.mockRejectedValue(new Error("boom"));
    await expect(loadCurrentBudgetId("user-1", LIVE_BUDGETS)).resolves.toBe(
      "default"
    );
  });
});

describe("switchBudget", () => {
  it("persiste le budget courant avec updatedAt", async () => {
    await switchBudget("user-1", "budget-1");

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        budgetId: "budget-1",
        updatedAt: expect.any(String),
      })
    );
  });

  it("accepte 'default'", async () => {
    await switchBudget("user-1", "default");

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ budgetId: "default" })
    );
  });

  it("rejette un id invalide sans écrire", async () => {
    await expect(switchBudget("user-1", "budget-9" as never)).rejects.toThrow(
      "Invalid budget id"
    );
    expect(setDocMock).not.toHaveBeenCalled();
  });
});
