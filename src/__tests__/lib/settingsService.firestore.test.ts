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
});
