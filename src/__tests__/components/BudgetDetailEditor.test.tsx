/**
 * Component tests for BudgetDetailEditor.
 *
 * Covers the core interactions of the detailed-budget feature:
 *   - Display in enabled/disabled mode
 *   - Toggle activation / deactivation
 *   - Adding and removing lines
 *   - Real-time total calculation
 *   - Auto-disable when the last line is deleted
 *   - Data preservation (items kept when mode is disabled)
 *   - Input validation (negative/invalid amounts clamped to 0)
 */

import React, { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";

import BudgetDetailEditor, {
  BudgetDetailEditorProps,
} from "@/components/settings/BudgetDetailEditor";
import { BudgetSubItem } from "@/types/settings";

const useAnonymousModeMock = jest.fn();

// ---------------------------------------------------------------------------
// Mock Firebase (required by settingsService imported inside the component)
// ---------------------------------------------------------------------------

jest.mock("@/lib/firebase", () => ({ db: {}, auth: {}, app: {} }));

jest.mock("@/context/AnonymousModeContext", () => ({
  useAnonymousMode: () => useAnonymousModeMock(),
}));

// ---------------------------------------------------------------------------
// Mock crypto.randomUUID to produce predictable IDs in tests
// ---------------------------------------------------------------------------

let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  useAnonymousModeMock.mockReset();
  useAnonymousModeMock.mockReturnValue({ anonymousMode: false });
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => `test-uuid-${++uuidCounter}`,
    },
    configurable: true,
  });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const itemA: BudgetSubItem = { id: "a", name: "Loyer", amount: 800 };
const itemB: BudgetSubItem = { id: "b", name: "Électricité", amount: 120 };

// ---------------------------------------------------------------------------
// Stateful wrapper
//
// BudgetDetailEditor is a fully-controlled component. This wrapper lifts state
// so that interactions (toggle, add, delete) actually update the rendered output
// without requiring rerender() calls in every test.
// ---------------------------------------------------------------------------

function ControlledEditor(
  initial: Omit<BudgetDetailEditorProps, "onEnabledChange" | "onItemsChange"> & {
    onEnabledChange?: jest.Mock;
    onItemsChange?: jest.Mock;
  }
) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [items, setItems] = useState<BudgetSubItem[]>(initial.items);

  const handleEnabledChange = (next: boolean) => {
    initial.onEnabledChange?.(next);
    setEnabled(next);
  };

  const handleItemsChange = (next: BudgetSubItem[]) => {
    initial.onItemsChange?.(next);
    setItems(next);
  };

  return (
    <BudgetDetailEditor
      label={initial.label}
      category={initial.category}
      aggregateAmount={initial.aggregateAmount}
      enabled={enabled}
      items={items}
      onEnabledChange={handleEnabledChange}
      onItemsChange={handleItemsChange}
    />
  );
}

/** Renders a controlled editor and returns the spy handles. */
function renderControlled(
  overrides: Partial<BudgetDetailEditorProps> = {},
  spies: { onEnabledChange?: jest.Mock; onItemsChange?: jest.Mock } = {}
) {
  const onEnabledChange = spies.onEnabledChange ?? jest.fn();
  const onItemsChange = spies.onItemsChange ?? jest.fn();

  render(
    <ControlledEditor
      label="Charges fixes"
      category="fixedCosts"
      enabled={false}
      items={[]}
      aggregateAmount={1200}
      onEnabledChange={onEnabledChange}
      onItemsChange={onItemsChange}
      {...overrides}
    />
  );

  return { onEnabledChange, onItemsChange };
}

// ---------------------------------------------------------------------------
// 1. Display — mode disabled (default)
// ---------------------------------------------------------------------------

describe("BudgetDetailEditor – display (mode disabled)", () => {
  it("renders the section label", () => {
    renderControlled();
    expect(screen.getByText("Charges fixes")).toBeInTheDocument();
  });

  it("renders the toggle switch button", () => {
    renderControlled();
    expect(
      screen.getByRole("switch", { name: /Mode détaillé pour Charges fixes/i })
    ).toBeInTheDocument();
  });

  it("toggle switch has aria-checked=false when mode is disabled", () => {
    renderControlled();
    expect(
      screen.getByRole("switch", { name: /Mode détaillé pour Charges fixes/i })
    ).toHaveAttribute("aria-checked", "false");
  });

  it("shows the aggregate amount in the header when mode is disabled", () => {
    renderControlled({ aggregateAmount: 950 });
    // The header span is identified by its aria-label.
    expect(
      screen.getByLabelText(/Montant global/i)
    ).toBeInTheDocument();
    // The formatted value must appear somewhere in the document.
    expect(screen.getByLabelText(/Montant global/i).textContent).toContain("950");
  });

  it("masks the aggregate amount when anonymous mode is enabled", () => {
    useAnonymousModeMock.mockReturnValue({ anonymousMode: true });

    renderControlled({ aggregateAmount: 950 });

    expect(screen.getByLabelText(/Montant global : \*{4},\*{2}\s€/i)).toBeInTheDocument();
    expect(screen.queryByText(/950/)).not.toBeInTheDocument();
  });

  it("does NOT render the detail panel when mode is disabled", () => {
    renderControlled();
    expect(
      screen.queryByRole("region", { name: /Détail des lignes/i })
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Display — mode enabled
// ---------------------------------------------------------------------------

describe("BudgetDetailEditor – display (mode enabled)", () => {
  it("toggle switch has aria-checked=true when mode is enabled", () => {
    renderControlled({ enabled: true, items: [itemA] });
    expect(
      screen.getByRole("switch", { name: /Mode détaillé pour Charges fixes/i })
    ).toHaveAttribute("aria-checked", "true");
  });

  it("renders the detail panel when mode is enabled", () => {
    renderControlled({ enabled: true, items: [itemA] });
    expect(
      screen.getByRole("region", { name: /Détail des lignes/i })
    ).toBeInTheDocument();
  });

  it("renders one row per item", () => {
    renderControlled({ enabled: true, items: [itemA, itemB] });
    expect(screen.getAllByRole("group", { name: /Ligne \d+/i })).toHaveLength(2);
  });

  it("renders item names in their respective inputs", () => {
    renderControlled({ enabled: true, items: [itemA, itemB] });
    expect(screen.getByDisplayValue("Loyer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Électricité")).toBeInTheDocument();
  });

  it("renders item amounts in their respective inputs", () => {
    renderControlled({ enabled: true, items: [itemA, itemB] });
    expect(screen.getByDisplayValue("800")).toBeInTheDocument();
    expect(screen.getByDisplayValue("120")).toBeInTheDocument();
  });

  it("renders the 'Ajouter une ligne' button when mode is enabled", () => {
    renderControlled({ enabled: true, items: [itemA] });
    expect(
      screen.getByRole("button", { name: /Ajouter une ligne/i })
    ).toBeInTheDocument();
  });

  it("does NOT show the aggregate amount header span when mode is enabled", () => {
    renderControlled({ enabled: true, items: [itemA] });
    expect(screen.queryByLabelText(/Montant global/i)).not.toBeInTheDocument();
  });

  it("masks the detailed total when anonymous mode is enabled", () => {
    useAnonymousModeMock.mockReturnValue({ anonymousMode: true });

    renderControlled({ enabled: true, items: [itemA, itemB] });

    expect(screen.getByLabelText(/Total détaillé : \*{4},\*{2}\s€/i)).toBeInTheDocument();
    expect(screen.queryByText(/920/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Toggle interaction
// ---------------------------------------------------------------------------

describe("BudgetDetailEditor – toggle interaction", () => {
  it("activating the toggle when items list is empty creates a first empty line and calls onEnabledChange(true)", () => {
    const onEnabledChange = jest.fn();
    const onItemsChange = jest.fn();
    renderControlled({ enabled: false, items: [] }, { onEnabledChange, onItemsChange });

    fireEvent.click(screen.getByRole("switch", { name: /Mode détaillé/i }));

    // onItemsChange must be called with exactly one new (empty) item.
    expect(onItemsChange).toHaveBeenCalledTimes(1);
    const newItems: BudgetSubItem[] = onItemsChange.mock.calls[0][0];
    expect(newItems).toHaveLength(1);
    expect(newItems[0].name).toBe("");
    expect(newItems[0].amount).toBe(0);

    // onEnabledChange must be called with true.
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it("activating the toggle when items already exist does NOT add a new item", () => {
    const onItemsChange = jest.fn();
    renderControlled(
      { enabled: false, items: [itemA] },
      { onItemsChange }
    );

    fireEvent.click(screen.getByRole("switch", { name: /Mode détaillé/i }));

    // No extra item must be created.
    expect(onItemsChange).not.toHaveBeenCalled();
  });

  it("deactivating the toggle calls onEnabledChange(false)", () => {
    const onEnabledChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA] }, { onEnabledChange });

    fireEvent.click(screen.getByRole("switch", { name: /Mode détaillé/i }));

    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it("deactivating the toggle does NOT call onItemsChange (items are preserved)", () => {
    const onItemsChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA, itemB] }, { onItemsChange });

    fireEvent.click(screen.getByRole("switch", { name: /Mode détaillé/i }));

    expect(onItemsChange).not.toHaveBeenCalled();
  });

  it("detail panel disappears after toggling mode off", () => {
    renderControlled({ enabled: true, items: [itemA] });

    fireEvent.click(screen.getByRole("switch", { name: /Mode détaillé/i }));

    expect(
      screen.queryByRole("region", { name: /Détail des lignes/i })
    ).not.toBeInTheDocument();
  });

  it("re-enabling after disable shows the previously entered items", () => {
    // Start disabled with pre-existing items.
    renderControlled({ enabled: false, items: [itemA, itemB] });

    // Enable the mode.
    fireEvent.click(screen.getByRole("switch", { name: /Mode détaillé/i }));

    // Items must still be visible — no data destruction on toggle.
    expect(screen.getByDisplayValue("Loyer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Électricité")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Adding lines
// ---------------------------------------------------------------------------

describe("BudgetDetailEditor – adding lines", () => {
  it("clicking 'Ajouter une ligne' appends a new empty row", () => {
    renderControlled({ enabled: true, items: [itemA] });

    fireEvent.click(screen.getByRole("button", { name: /Ajouter une ligne/i }));

    expect(screen.getAllByRole("group", { name: /Ligne \d+/i })).toHaveLength(2);
  });

  it("calls onItemsChange with the existing items plus one new item", () => {
    const onItemsChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA] }, { onItemsChange });

    fireEvent.click(screen.getByRole("button", { name: /Ajouter une ligne/i }));

    expect(onItemsChange).toHaveBeenCalledTimes(1);
    const result: BudgetSubItem[] = onItemsChange.mock.calls[0][0];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(itemA);
    // New item must be empty with a unique id.
    expect(result[1].name).toBe("");
    expect(result[1].amount).toBe(0);
    expect(result[1].id).toBeTruthy();
    expect(result[1].id).not.toBe(itemA.id);
  });

  it("multiple 'Ajouter une ligne' clicks produce the correct cumulative count", () => {
    renderControlled({ enabled: true, items: [itemA] });

    fireEvent.click(screen.getByRole("button", { name: /Ajouter une ligne/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une ligne/i }));

    expect(screen.getAllByRole("group", { name: /Ligne \d+/i })).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 5. Deleting lines
// ---------------------------------------------------------------------------

describe("BudgetDetailEditor – deleting lines", () => {
  it("clicking delete removes that row from the list", () => {
    renderControlled({ enabled: true, items: [itemA, itemB] });

    fireEvent.click(screen.getByRole("button", { name: /Supprimer la ligne 1/i }));

    expect(screen.getAllByRole("group", { name: /Ligne \d+/i })).toHaveLength(1);
    // itemA must be gone; itemB must remain.
    expect(screen.queryByDisplayValue("Loyer")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Électricité")).toBeInTheDocument();
  });

  it("calls onItemsChange with the item removed", () => {
    const onItemsChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA, itemB] }, { onItemsChange });

    fireEvent.click(screen.getByRole("button", { name: /Supprimer la ligne 1/i }));

    expect(onItemsChange).toHaveBeenCalledTimes(1);
    expect(onItemsChange.mock.calls[0][0]).toEqual([itemB]);
  });

  it("deleting the last line calls onEnabledChange(false) — auto-disable invariant", () => {
    const onEnabledChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA] }, { onEnabledChange });

    fireEvent.click(screen.getByRole("button", { name: /Supprimer la ligne 1/i }));

    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it("detail panel disappears after the last line is deleted", () => {
    renderControlled({ enabled: true, items: [itemA] });

    fireEvent.click(screen.getByRole("button", { name: /Supprimer la ligne 1/i }));

    expect(
      screen.queryByRole("region", { name: /Détail des lignes/i })
    ).not.toBeInTheDocument();
  });

  it("deleting a non-last line does NOT call onEnabledChange", () => {
    const onEnabledChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA, itemB] }, { onEnabledChange });

    fireEvent.click(screen.getByRole("button", { name: /Supprimer la ligne 1/i }));

    expect(onEnabledChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. Total calculation
// ---------------------------------------------------------------------------

describe("BudgetDetailEditor – total calculation", () => {
  it("displays 0,00 € in the total row when all amounts are zero", () => {
    const zeroItem: BudgetSubItem = { id: "z1", name: "X", amount: 0 };
    renderControlled({ enabled: true, items: [zeroItem] });

    const totalRow = screen.getByText("Total").closest("div")!;
    expect(within(totalRow).getByText(/0,00\s*€/)).toBeInTheDocument();
  });

  it("displays the correct sum of all item amounts in the total row", () => {
    renderControlled({ enabled: true, items: [itemA, itemB] });

    // 800 + 120 = 920
    const totalRow = screen.getByText("Total").closest("div")!;
    expect(within(totalRow).getByText(/920,00\s*€/)).toBeInTheDocument();
  });

  it("updates the total in real time when an amount input is changed", () => {
    renderControlled({ enabled: true, items: [itemA, itemB] });

    // Change itemA amount from 800 to 500.
    fireEvent.change(screen.getByDisplayValue("800"), {
      target: { value: "500" },
    });

    // New total: 500 + 120 = 620.
    const totalRow = screen.getByText("Total").closest("div")!;
    expect(within(totalRow).getByText(/620,00\s*€/)).toBeInTheDocument();
  });

  it("shows the computed total in the header badge when mode is enabled", () => {
    renderControlled({ enabled: true, items: [itemA, itemB] });

    // The header aria-label contains "Total détaillé".
    const headerBadge = screen.getByLabelText(/Total détaillé/i);
    expect(headerBadge.textContent).toContain("920");
  });
});

// ---------------------------------------------------------------------------
// 7. Input validation — amount sanitization
// ---------------------------------------------------------------------------

describe("BudgetDetailEditor – amount input sanitization", () => {
  it("clamps a negative amount to 0 and calls onItemsChange with amount 0", () => {
    const onItemsChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA] }, { onItemsChange });

    fireEvent.change(screen.getByDisplayValue("800"), {
      target: { value: "-50" },
    });

    expect(onItemsChange).toHaveBeenCalledTimes(1);
    const result: BudgetSubItem[] = onItemsChange.mock.calls[0][0];
    expect(result[0].amount).toBe(0);
  });

  it("clamps a non-numeric string to 0 and calls onItemsChange with amount 0", () => {
    const onItemsChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA] }, { onItemsChange });

    fireEvent.change(screen.getByDisplayValue("800"), {
      target: { value: "abc" },
    });

    expect(onItemsChange).toHaveBeenCalledTimes(1);
    const result: BudgetSubItem[] = onItemsChange.mock.calls[0][0];
    expect(result[0].amount).toBe(0);
  });

  it("accepts a valid decimal amount and passes it through unchanged", () => {
    const onItemsChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA] }, { onItemsChange });

    fireEvent.change(screen.getByDisplayValue("800"), {
      target: { value: "123.45" },
    });

    expect(onItemsChange).toHaveBeenCalledTimes(1);
    const result: BudgetSubItem[] = onItemsChange.mock.calls[0][0];
    expect(result[0].amount).toBeCloseTo(123.45);
  });
});

// ---------------------------------------------------------------------------
// 8. Name input
// ---------------------------------------------------------------------------

describe("BudgetDetailEditor – name input", () => {
  it("calls onItemsChange with the updated name when a name input changes", () => {
    const onItemsChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA] }, { onItemsChange });

    fireEvent.change(screen.getByDisplayValue("Loyer"), {
      target: { value: "Loyer modifié" },
    });

    expect(onItemsChange).toHaveBeenCalledTimes(1);
    const result: BudgetSubItem[] = onItemsChange.mock.calls[0][0];
    expect(result[0].name).toBe("Loyer modifié");
    // Amount must be untouched.
    expect(result[0].amount).toBe(800);
  });

  it("only updates the targeted item when multiple items are present", () => {
    const onItemsChange = jest.fn();
    renderControlled({ enabled: true, items: [itemA, itemB] }, { onItemsChange });

    fireEvent.change(screen.getByDisplayValue("Loyer"), {
      target: { value: "Loyer modifié" },
    });

    const result: BudgetSubItem[] = onItemsChange.mock.calls[0][0];
    expect(result[0].name).toBe("Loyer modifié");
    expect(result[1]).toEqual(itemB); // itemB unchanged.
  });
});

// ---------------------------------------------------------------------------
// 9. Savings category
// ---------------------------------------------------------------------------

describe("BudgetDetailEditor – savings category", () => {
  it("renders the correct contextual description for the savings category", () => {
    renderControlled({ enabled: true, items: [itemA], category: "savings", label: "Épargne" });
    expect(
      screen.getByText(/Décomposez votre épargne par enveloppe/i)
    ).toBeInTheDocument();
  });

  it("renders the correct contextual description for the fixedCosts category", () => {
    renderControlled({ enabled: true, items: [itemA], category: "fixedCosts", label: "Charges fixes" });
    expect(
      screen.getByText(/Décomposez vos charges fixes/i)
    ).toBeInTheDocument();
  });
});
