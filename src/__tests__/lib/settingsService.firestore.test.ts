import { loadSettings, saveSettings } from "@/lib/settingsService";
import { DEFAULT_USER_SETTINGS } from "@/types/settings";

const getDocMock = jest.fn();
const setDocMock = jest.fn();

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
  },
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => ({ type: "doc-ref" })),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
}));

describe("settingsService Firestore persistence", () => {
  beforeEach(() => {
    getDocMock.mockReset();
    setDocMock.mockReset();
    setDocMock.mockResolvedValue(undefined);
  });

  it("creates a valid settings document when none exists yet", async () => {
    getDocMock.mockResolvedValue({
      exists: () => false,
    });

    await saveSettings("user-1", {
      fixedCostsDetailedEnabled: true,
      fixedCostsItems: [{ id: "line-1", name: "", amount: 0 }],
    });

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        monthlyIncome: 0,
        fixedCosts: 0,
        monthlySavings: 0,
        bentoPreset: "balanced",
        anonymousMode: false,
        isOnboarded: true,
        fixedCostsDetailedEnabled: true,
        fixedCostsItems: [{ id: "line-1", name: "", amount: 0 }],
        savingsDetailedEnabled: false,
        savingsItems: [],
      }),
    );
  });

  it("rewrites legacy settings docs to an allowed canonical shape", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        monthlyIncome: 3200,
        fixedCosts: 900,
        monthlySavings: 400,
        currency: "EUR",
        createdAt: "2026-01-10T10:00:00.000Z",
        anonymousMode: false,
        legacyFlag: "deprecated",
      }),
    });

    await saveSettings("user-1", {
      savingsDetailedEnabled: true,
      savingsItems: [{ id: "save-1", name: "Livret A", amount: 200 }],
    });

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        monthlyIncome: 3200,
        fixedCosts: 900,
        monthlySavings: 400,
        currency: "EUR",
        createdAt: "2026-01-10T10:00:00.000Z",
        anonymousMode: false,
        isOnboarded: true,
        savingsDetailedEnabled: true,
        savingsItems: [{ id: "save-1", name: "Livret A", amount: 200 }],
      }),
    );

    expect(setDocMock.mock.calls[0][1]).not.toHaveProperty("legacyFlag");
  });

  it("returns the default anonymousMode value when the settings document is absent", async () => {
    getDocMock.mockResolvedValue({
      exists: () => false,
    });

    await expect(loadSettings("user-1")).resolves.toEqual({
      ...DEFAULT_USER_SETTINGS,
    });
  });

  it("loads a persisted anonymousMode value from Firestore", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        monthlyIncome: 3200,
        fixedCosts: 900,
        monthlySavings: 400,
        bentoPreset: "compact",
        anonymousMode: true,
        fixedCostsDetailedEnabled: false,
        savingsDetailedEnabled: false,
        fixedCostsItems: [],
        savingsItems: [],
        isOnboarded: true,
      }),
    });

    await expect(loadSettings("user-1")).resolves.toEqual({
      monthlyIncome: 3200,
      isFixedIncome: true,
      fixedCosts: 900,
      monthlySavings: 400,
      currency: "EUR",
      bentoPreset: "compact",
      anonymousMode: true,
      fixedCostsDetailedEnabled: false,
      savingsDetailedEnabled: false,
      fixedCostsItems: [],
      savingsItems: [],
    });
  });

  it("preserves an existing anonymousMode value when saving another field", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        monthlyIncome: 3200,
        fixedCosts: 900,
        monthlySavings: 400,
        bentoPreset: "balanced",
        anonymousMode: true,
        fixedCostsDetailedEnabled: false,
        savingsDetailedEnabled: false,
        fixedCostsItems: [],
        savingsItems: [],
        isOnboarded: true,
      }),
    });

    await saveSettings("user-1", {
      monthlyIncome: 3500,
    });

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        monthlyIncome: 3500,
        anonymousMode: true,
      }),
    );
  });

  it("persists anonymousMode when explicitly updated", async () => {
    getDocMock.mockResolvedValue({
      exists: () => false,
    });

    await saveSettings("user-1", {
      anonymousMode: true,
    });

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        anonymousMode: true,
      }),
    );
  });

  it("preserves income/fixedCosts/savingsHistory arrays when saving a partial update", async () => {
    // Regression: the legacy sanitizer rebuilt an explicit object and wiped
    // unknown keys, so a web write would silently delete the version
    // histories written by iOS 1.05. They must survive any web save.
    const incomeHistory = [
      {
        id: "inc-1",
        startDate: "2026-01-01",
        endDate: "2026-06-30",
        amount: 3200,
        updatedAt: "2026-09-23T10:00:00Z",
      },
    ];
    const fixedCostsHistory = [
      {
        id: "fix-1",
        startDate: "2026-01-01",
        endDate: null,
        total: 1200,
        detailedEnabled: true,
        items: [{ id: "loyer", name: "Loyer", amount: 800, order: 0 }],
        updatedAt: "2026-09-23T10:00:00Z",
      },
    ];
    const savingsHistory = [
      {
        id: "sav-1",
        startDate: "2026-03-01",
        endDate: null,
        total: 500,
        updatedAt: "2026-09-23T10:00:00Z",
      },
    ];

    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        monthlyIncome: 3200,
        fixedCosts: 1200,
        monthlySavings: 500,
        isOnboarded: true,
        incomeHistory,
        fixedCostsHistory,
        savingsHistory,
      }),
    });

    await saveSettings("user-1", {
      monthlyIncome: 3500,
    });

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        monthlyIncome: 3500,
        incomeHistory,
        fixedCostsHistory,
        savingsHistory,
      }),
    );
  });

  it("drops history keys when the stored histories are empty", async () => {
    // Legacy documents keep their exact shape (no empty keys written).
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        monthlyIncome: 3200,
        fixedCosts: 1200,
        monthlySavings: 500,
        isOnboarded: true,
      }),
    });

    await saveSettings("user-1", {
      monthlyIncome: 3500,
    });

    expect(setDocMock.mock.calls[0][1]).not.toHaveProperty("incomeHistory");
    expect(setDocMock.mock.calls[0][1]).not.toHaveProperty("fixedCostsHistory");
    expect(setDocMock.mock.calls[0][1]).not.toHaveProperty("savingsHistory");
  });

  it("loadSettings returns sanitized histories", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        monthlyIncome: 3200,
        fixedCosts: 1200,
        monthlySavings: 500,
        isOnboarded: true,
        incomeHistory: [
          {
            id: "inc-1",
            startDate: "2026-01-01",
            endDate: "2026-06-30",
            amount: 3200,
            updatedAt: "2026-09-23T10:00:00Z",
          },
          { id: "bad", startDate: "01/01/2026", amount: 1, updatedAt: "x" },
        ],
        fixedCostsHistory: [],
        savingsHistory: [],
      }),
    });

    await expect(loadSettings("user-1")).resolves.toEqual(
      expect.objectContaining({
        incomeHistory: [
          {
            id: "inc-1",
            startDate: "2026-01-01",
            endDate: "2026-06-30",
            amount: 3200,
            updatedAt: "2026-09-23T10:00:00Z",
          },
        ],
      }),
    );
  });
});

describe("settingsService custom budget month persistence", () => {
  beforeEach(() => {
    getDocMock.mockReset();
    setDocMock.mockReset();
    setDocMock.mockResolvedValue(undefined);
  });

  it("preserves customMonth fields written by iOS when saving a partial update", async () => {
    // Regression: a web save must never wipe the custom-month fields written
    // by a newer iOS client (same guarantee as the version histories).
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        monthlyIncome: 3200,
        fixedCosts: 1200,
        monthlySavings: 500,
        isOnboarded: true,
        customMonthEnabled: true,
        customMonthStartDay: 25,
        customMonthStartOverrides: { "2026-10": 5 },
      }),
    });

    await saveSettings("user-1", {
      monthlyIncome: 3500,
    });

    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        monthlyIncome: 3500,
        customMonthEnabled: true,
        customMonthStartDay: 25,
        customMonthStartOverrides: { "2026-10": 5 },
      }),
    );
  });

  it("omits customMonth keys for legacy documents (exact shape preserved)", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        monthlyIncome: 3200,
        fixedCosts: 1200,
        monthlySavings: 500,
        isOnboarded: true,
      }),
    });

    await saveSettings("user-1", { monthlyIncome: 3500 });

    expect(setDocMock.mock.calls[0][1]).not.toHaveProperty("customMonthEnabled");
    expect(setDocMock.mock.calls[0][1]).not.toHaveProperty("customMonthStartDay");
    expect(setDocMock.mock.calls[0][1]).not.toHaveProperty("customMonthStartOverrides");
  });

  it("loadSettings returns sanitized custom-month fields", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        monthlyIncome: 3200,
        fixedCosts: 1200,
        monthlySavings: 500,
        isOnboarded: true,
        customMonthEnabled: true,
        customMonthStartDay: 25,
        customMonthStartOverrides: { "2026-10": 5, bad: 9, "2026-11": 31 },
      }),
    });

    await expect(loadSettings("user-1")).resolves.toEqual(
      expect.objectContaining({
        customMonthEnabled: true,
        customMonthStartDay: 25,
        customMonthStartOverrides: { "2026-10": 5 },
      }),
    );
  });

  it("legacy documents load without custom-month fields (defaults apply)", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        monthlyIncome: 3200,
        fixedCosts: 1200,
        monthlySavings: 500,
        isOnboarded: true,
      }),
    });

    await expect(loadSettings("user-1")).resolves.toEqual(
      expect.objectContaining({
        monthlyIncome: 3200,
        fixedCosts: 1200,
      }),
    );
  });
});
