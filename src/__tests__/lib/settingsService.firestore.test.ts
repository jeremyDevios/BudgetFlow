import { saveSettings } from "@/lib/settingsService";

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
        isOnboarded: true,
        savingsDetailedEnabled: true,
        savingsItems: [{ id: "save-1", name: "Livret A", amount: 200 }],
      }),
    );

    expect(setDocMock.mock.calls[0][1]).not.toHaveProperty("legacyFlag");
  });
});
