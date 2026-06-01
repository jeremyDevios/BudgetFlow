/**
 * Unit tests for pure helpers exported by settingsService.
 *
 * Firestore functions (loadSettings / saveSettings) are not tested here because
 * they require an emulator or mock — they are covered by integration tests.
 */

// Mock Firebase to prevent initialization errors in the test environment.
// The pure helpers under test do not use Firestore at all.
jest.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
  app: {},
}));

import {
  resolveBentoPreset,
  sanitizeSubItems,
  computeDetailedTotal,
  resolveDetailedEnabled,
  normalizeSettingsPayload,
} from "@/lib/settingsService";
import { BudgetSubItem } from "@/types/settings";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validItem: BudgetSubItem = { id: "1", name: "Loyer", amount: 800 };
const anotherItem: BudgetSubItem = { id: "2", name: "Électricité", amount: 120.5 };

// ---------------------------------------------------------------------------
// resolveBentoPreset
// ---------------------------------------------------------------------------

describe("resolveBentoPreset", () => {
  it('returns "compact" for the string "compact"', () => {
    expect(resolveBentoPreset("compact")).toBe("compact");
  });

  it('returns "balanced" for the string "balanced"', () => {
    expect(resolveBentoPreset("balanced")).toBe("balanced");
  });

  it('returns "airy" for the string "airy"', () => {
    expect(resolveBentoPreset("airy")).toBe("airy");
  });

  it('falls back to "balanced" for an unknown string', () => {
    expect(resolveBentoPreset("unknown")).toBe("balanced");
  });

  it('falls back to "balanced" for undefined', () => {
    expect(resolveBentoPreset(undefined)).toBe("balanced");
  });

  it('falls back to "balanced" for null', () => {
    expect(resolveBentoPreset(null)).toBe("balanced");
  });

  it('falls back to "balanced" for a number', () => {
    expect(resolveBentoPreset(42)).toBe("balanced");
  });
});

// ---------------------------------------------------------------------------
// sanitizeSubItems
// ---------------------------------------------------------------------------

describe("sanitizeSubItems", () => {
  it("returns an empty array for a non-array input", () => {
    expect(sanitizeSubItems(null)).toEqual([]);
    expect(sanitizeSubItems(undefined)).toEqual([]);
    expect(sanitizeSubItems("string")).toEqual([]);
    expect(sanitizeSubItems(42)).toEqual([]);
    expect(sanitizeSubItems({})).toEqual([]);
  });

  it("returns an empty array for an empty array input", () => {
    expect(sanitizeSubItems([])).toEqual([]);
  });

  it("accepts a well-formed BudgetSubItem", () => {
    expect(sanitizeSubItems([validItem])).toEqual([validItem]);
  });

  it("accepts multiple well-formed items", () => {
    expect(sanitizeSubItems([validItem, anotherItem])).toEqual([validItem, anotherItem]);
  });

  it("accepts an item with amount = 0", () => {
    const zeroItem = { id: "z", name: "Zéro", amount: 0 };
    expect(sanitizeSubItems([zeroItem])).toEqual([zeroItem]);
  });

  it("drops items with a missing id", () => {
    const bad = { name: "No id", amount: 100 };
    expect(sanitizeSubItems([bad])).toEqual([]);
  });

  it("drops items with an empty id string", () => {
    const bad = { id: "", name: "Empty id", amount: 100 };
    expect(sanitizeSubItems([bad])).toEqual([]);
  });

  it("drops items with a missing name", () => {
    const bad = { id: "x", amount: 100 };
    expect(sanitizeSubItems([bad])).toEqual([]);
  });

  it("drops items with a non-numeric amount", () => {
    const bad = { id: "x", name: "Bad amount", amount: "100" };
    expect(sanitizeSubItems([bad])).toEqual([]);
  });

  it("drops items with a negative amount", () => {
    const bad = { id: "x", name: "Negative", amount: -10 };
    expect(sanitizeSubItems([bad])).toEqual([]);
  });

  it("drops null entries inside the array", () => {
    expect(sanitizeSubItems([null, validItem])).toEqual([validItem]);
  });

  it("keeps valid items and drops invalid ones in the same array", () => {
    const bad = { id: "", name: "Invalid", amount: -1 };
    expect(sanitizeSubItems([validItem, bad, anotherItem])).toEqual([validItem, anotherItem]);
  });
});

// ---------------------------------------------------------------------------
// computeDetailedTotal
// ---------------------------------------------------------------------------

describe("computeDetailedTotal", () => {
  it("returns 0 for an empty array", () => {
    expect(computeDetailedTotal([])).toBe(0);
  });

  it("returns the amount of a single item", () => {
    expect(computeDetailedTotal([validItem])).toBe(800);
  });

  it("sums multiple items correctly", () => {
    expect(computeDetailedTotal([validItem, anotherItem])).toBeCloseTo(920.5);
  });

  it("handles items with amount = 0", () => {
    const zeroItem: BudgetSubItem = { id: "z", name: "Zéro", amount: 0 };
    expect(computeDetailedTotal([validItem, zeroItem])).toBe(800);
  });

  it("handles decimal precision", () => {
    const items: BudgetSubItem[] = [
      { id: "a", name: "A", amount: 33.33 },
      { id: "b", name: "B", amount: 33.33 },
      { id: "c", name: "C", amount: 33.34 },
    ];
    expect(computeDetailedTotal(items)).toBeCloseTo(100);
  });
});

// ---------------------------------------------------------------------------
// resolveDetailedEnabled
// ---------------------------------------------------------------------------

describe("resolveDetailedEnabled", () => {
  it("returns false when enabled is false and items is empty", () => {
    expect(resolveDetailedEnabled(false, [])).toBe(false);
  });

  it("returns false when enabled is false even if items are present", () => {
    // User explicitly disabled the mode — respect the choice.
    expect(resolveDetailedEnabled(false, [validItem])).toBe(false);
  });

  it("returns false when enabled is true but items is empty (invariant enforcement)", () => {
    expect(resolveDetailedEnabled(true, [])).toBe(false);
  });

  it("returns true when enabled is true and at least one item exists", () => {
    expect(resolveDetailedEnabled(true, [validItem])).toBe(true);
  });

  it("returns true when enabled is true and multiple items exist", () => {
    expect(resolveDetailedEnabled(true, [validItem, anotherItem])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeSettingsPayload
// ---------------------------------------------------------------------------

describe("normalizeSettingsPayload", () => {
  // ── Passthrough when items keys are absent ────────────────────────────────

  it("returns the payload unchanged when neither items key is present", () => {
    const partial = { monthlyIncome: 3000, fixedCosts: 800, anonymousMode: true };
    expect(normalizeSettingsPayload(partial)).toEqual(partial);
  });

  it("does not inject fixedCostsDetailedEnabled when fixedCostsItems is absent", () => {
    const partial = { fixedCostsDetailedEnabled: true };
    const result = normalizeSettingsPayload(partial);
    // Flag must not be overridden because items were not part of the payload.
    expect(result.fixedCostsDetailedEnabled).toBe(true);
    expect("fixedCostsItems" in result).toBe(false);
  });

  it("does not inject savingsDetailedEnabled when savingsItems is absent", () => {
    const partial = { savingsDetailedEnabled: true };
    const result = normalizeSettingsPayload(partial);
    expect(result.savingsDetailedEnabled).toBe(true);
    expect("savingsItems" in result).toBe(false);
  });

  // ── fixedCostsItems sanitization and flag enforcement ────────────────────

  it("sanitizes fixedCostsItems and keeps valid items", () => {
    const result = normalizeSettingsPayload({ fixedCostsItems: [validItem, anotherItem] });
    expect(result.fixedCostsItems).toEqual([validItem, anotherItem]);
  });

  it("drops malformed entries from fixedCostsItems", () => {
    const malformed = { id: "", name: "Bad", amount: -5 };
    const result = normalizeSettingsPayload({
      fixedCostsItems: [validItem, malformed as unknown as BudgetSubItem],
    });
    expect(result.fixedCostsItems).toEqual([validItem]);
  });

  it("forces fixedCostsDetailedEnabled to false when fixedCostsItems becomes empty after sanitization", () => {
    const malformed = { id: "", name: "Bad", amount: -1 };
    const result = normalizeSettingsPayload({
      fixedCostsItems: [malformed as unknown as BudgetSubItem],
      fixedCostsDetailedEnabled: true,
    });
    expect(result.fixedCostsItems).toEqual([]);
    // Invariant: flag must be false when no items remain.
    expect(result.fixedCostsDetailedEnabled).toBe(false);
  });

  it("forces fixedCostsDetailedEnabled to false when an empty array is passed explicitly", () => {
    const result = normalizeSettingsPayload({
      fixedCostsItems: [],
      fixedCostsDetailedEnabled: true,
    });
    expect(result.fixedCostsDetailedEnabled).toBe(false);
  });

  it("does NOT force fixedCostsDetailedEnabled to false when items are valid and non-empty", () => {
    // The flag should remain as supplied when items survive sanitization.
    const result = normalizeSettingsPayload({
      fixedCostsItems: [validItem],
      fixedCostsDetailedEnabled: true,
    });
    expect(result.fixedCostsDetailedEnabled).toBe(true);
  });

  it("preserves fixedCostsItems when fixedCostsDetailedEnabled is false (no data destruction)", () => {
    // Disabling the mode must NOT wipe the items — they are kept for future re-enable.
    const result = normalizeSettingsPayload({
      fixedCostsItems: [validItem, anotherItem],
      fixedCostsDetailedEnabled: false,
    });
    expect(result.fixedCostsItems).toEqual([validItem, anotherItem]);
    expect(result.fixedCostsDetailedEnabled).toBe(false);
  });

  // ── savingsItems sanitization and flag enforcement ────────────────────────

  it("sanitizes savingsItems and keeps valid items", () => {
    const savingsItem: BudgetSubItem = { id: "s1", name: "Livret A", amount: 200 };
    const result = normalizeSettingsPayload({ savingsItems: [savingsItem] });
    expect(result.savingsItems).toEqual([savingsItem]);
  });

  it("forces savingsDetailedEnabled to false when savingsItems becomes empty after sanitization", () => {
    const malformed = { id: "", name: "Bad", amount: -1 };
    const result = normalizeSettingsPayload({
      savingsItems: [malformed as unknown as BudgetSubItem],
      savingsDetailedEnabled: true,
    });
    expect(result.savingsItems).toEqual([]);
    expect(result.savingsDetailedEnabled).toBe(false);
  });

  it("forces savingsDetailedEnabled to false when an empty array is passed explicitly", () => {
    const result = normalizeSettingsPayload({
      savingsItems: [],
      savingsDetailedEnabled: true,
    });
    expect(result.savingsDetailedEnabled).toBe(false);
  });

  it("preserves savingsItems when savingsDetailedEnabled is false (no data destruction)", () => {
    const savingsItem: BudgetSubItem = { id: "s1", name: "PEA", amount: 300 };
    const result = normalizeSettingsPayload({
      savingsItems: [savingsItem],
      savingsDetailedEnabled: false,
    });
    expect(result.savingsItems).toEqual([savingsItem]);
    expect(result.savingsDetailedEnabled).toBe(false);
  });

  // ── Combined payload ──────────────────────────────────────────────────────

  it("handles a full payload with both categories simultaneously", () => {
    const savingsItem: BudgetSubItem = { id: "s1", name: "Livret A", amount: 150 };
    const result = normalizeSettingsPayload({
      fixedCostsItems: [validItem],
      fixedCostsDetailedEnabled: true,
      savingsItems: [savingsItem],
      savingsDetailedEnabled: true,
      monthlyIncome: 3500,
    });
    expect(result.fixedCostsItems).toEqual([validItem]);
    expect(result.fixedCostsDetailedEnabled).toBe(true);
    expect(result.savingsItems).toEqual([savingsItem]);
    expect(result.savingsDetailedEnabled).toBe(true);
    expect(result.monthlyIncome).toBe(3500);
  });

  it("independently enforces the invariant per category when one is empty and the other is not", () => {
    const result = normalizeSettingsPayload({
      fixedCostsItems: [],
      fixedCostsDetailedEnabled: true, // should be forced to false
      savingsItems: [validItem],
      savingsDetailedEnabled: true, // should remain true
    });
    expect(result.fixedCostsDetailedEnabled).toBe(false);
    expect(result.savingsDetailedEnabled).toBe(true);
  });
});
