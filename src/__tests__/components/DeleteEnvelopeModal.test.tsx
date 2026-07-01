import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DeleteEnvelopeModal from "@/components/settings/DeleteEnvelopeModal";
import { Envelope } from "@/types/envelope";
import { Transaction } from "@/types/transaction";

// ── Mock framer-motion ───────────────────────────────────────────────

jest.mock("framer-motion", () => {
  const motionProps = new Set([
    "animate",
    "exit",
    "initial",
    "layout",
    "transition",
    "variants",
    "whileHover",
    "whileTap",
  ]);

  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const MockMotionComponent = React.forwardRef<
          HTMLElement,
          React.HTMLAttributes<HTMLElement> & {
            children?: React.ReactNode;
            [key: string]: unknown;
          }
        >(({ children, ...rest }, ref) => {
          const clean: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(rest)) {
            if (!motionProps.has(k)) clean[k] = v;
          }
          // @ts-expect-error — mock wrapper
          return React.createElement(tag, { ...clean, ref }, children);
        });
        MockMotionComponent.displayName = `motion.${String(tag)}`;
        return MockMotionComponent;
      },
    },
  ) as Record<string, React.ForwardRefExoticComponent<unknown>>;

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

// ── Helpers ──────────────────────────────────────────────────────────

function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
  return {
    id: "env-1",
    name: "Alimentation",
    icon: "ShoppingCart",
    color: "bg-amber-500",
    budget: 400,
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    amount: 50,
    description: "Courses",
    envelopeId: "env-1",
    date: "2026-06-15T12:00:00.000Z",
    ...overrides,
  };
}

const otherEnvelopes: Envelope[] = [
  makeEnvelope({ id: "env-2", name: "Transport", budget: 150 }),
  makeEnvelope({ id: "env-3", name: "Loisirs", budget: 200 }),
];

// ── Props factories ──────────────────────────────────────────────────

function defaultProps(overrides: Partial<{
  isOpen: boolean;
  envelope: Envelope;
  envelopes: Envelope[];
  linkedTransactions: Transaction[];
}> = {}) {
  return {
    isOpen: overrides.isOpen ?? true,
    onClose: jest.fn(),
    envelope: overrides.envelope ?? makeEnvelope(),
    envelopes: overrides.envelopes ?? [
      makeEnvelope(),
      ...otherEnvelopes,
    ],
    linkedTransactions: overrides.linkedTransactions ?? [],
    onMigrateToExisting: jest.fn().mockResolvedValue(undefined),
    onCreateAndMigrate: jest.fn().mockResolvedValue(undefined),
    onDeleteAll: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("DeleteEnvelopeModal", () => {
  // ── Zero transactions ──────────────────────────────────────────

  describe("when envelope has no transactions", () => {
    it("shows a simple confirmation message", () => {
      const props = defaultProps({ linkedTransactions: [] });
      render(<DeleteEnvelopeModal {...props} />);

      expect(
        screen.getByText(/ne contient aucune transaction/i),
      ).toBeInTheDocument();
    });

    it("shows Cancel and Delete buttons", () => {
      const props = defaultProps({ linkedTransactions: [] });
      render(<DeleteEnvelopeModal {...props} />);

      expect(screen.getByText("Annuler")).toBeInTheDocument();
      // The confirm button is still shown even with 0 txs
      expect(screen.getByRole("button", { name: /migrer/i })).toBeInTheDocument();
    });

    it("calls onClose when Cancel is clicked", async () => {
      const onClose = jest.fn();
      const props = defaultProps({ linkedTransactions: [] });
      props.onClose = onClose;
      render(<DeleteEnvelopeModal {...props} />);

      await userEvent.click(screen.getByText("Annuler"));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── With transactions ──────────────────────────────────────────

  describe("when envelope has linked transactions", () => {
    const txs = [
      makeTx({ id: "tx-1", date: "2026-06-01" }),
      makeTx({ id: "tx-2", date: "2026-06-15" }),
      makeTx({ id: "tx-3", date: "2026-07-01" }),
    ];

    it("shows the transaction count and month count", () => {
      const props = defaultProps({ linkedTransactions: txs });
      render(<DeleteEnvelopeModal {...props} />);

      // The amber warning box is visible with the summary
      expect(screen.getByText(/cette enveloppe contient/i)).toBeInTheDocument();
      // The warning and delete-all both contain "3" in <strong> tags
      const threeElements = screen.getAllByText("3");
      expect(threeElements.length).toBeGreaterThanOrEqual(2);
      // Month names from the breakdown list are shown
      expect(screen.getByText(/Juin/i)).toBeInTheDocument();
      expect(screen.getByText(/Juillet/i)).toBeInTheDocument();
    });

    it("renders all three options as radio buttons", () => {
      const props = defaultProps({ linkedTransactions: txs });
      render(<DeleteEnvelopeModal {...props} />);

      expect(
        screen.getByText(/Migrer vers une enveloppe existante/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Créer une nouvelle enveloppe et migrer/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Tout supprimer/i)).toBeInTheDocument();
    });

    it("defaults to migrate-existing option with first available envelope selected", () => {
      const props = defaultProps({ linkedTransactions: txs });
      render(<DeleteEnvelopeModal {...props} />);

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("env-2");
    });

    it("shows 'Migrer et supprimer' button label for option A", () => {
      const props = defaultProps({ linkedTransactions: txs });
      render(<DeleteEnvelopeModal {...props} />);

      expect(
        screen.getByRole("button", { name: /Migrer et supprimer/i }),
      ).toBeInTheDocument();
    });

    it("shows envelope dropdown when migrate-existing is selected", () => {
      const props = defaultProps({ linkedTransactions: txs });
      render(<DeleteEnvelopeModal {...props} />);

      // The dropdown should list all other envelopes
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.options).toHaveLength(2);
      expect(select.options[0].text).toContain("Transport");
      expect(select.options[1].text).toContain("Loisirs");
    });

    it("calls onMigrateToExisting with the selected envelope id", async () => {
      const onMigrateToExisting = jest.fn().mockResolvedValue(undefined);
      const props = defaultProps({ linkedTransactions: txs });
      props.onMigrateToExisting = onMigrateToExisting;
      render(<DeleteEnvelopeModal {...props} />);

      await userEvent.click(
        screen.getByRole("button", { name: /Migrer et supprimer/i }),
      );

      await waitFor(() => {
        expect(onMigrateToExisting).toHaveBeenCalledWith("env-2");
      });
    });

    it("shows inline form when create-new is selected", async () => {
      const props = defaultProps({ linkedTransactions: txs });
      render(<DeleteEnvelopeModal {...props} />);

      // Click the create-new radio label
      await userEvent.click(
        screen.getByText(/Créer une nouvelle enveloppe et migrer/i),
      );

      expect(
        screen.getByPlaceholderText(/Nom de la nouvelle enveloppe/i),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/Budget mensuel/i),
      ).toBeInTheDocument();
    });

    it("validates name and budget in create-new mode", async () => {
      const onCreateAndMigrate = jest.fn().mockResolvedValue(undefined);
      const props = defaultProps({ linkedTransactions: txs });
      props.onCreateAndMigrate = onCreateAndMigrate;
      render(<DeleteEnvelopeModal {...props} />);

      // Switch to create-new
      await userEvent.click(
        screen.getByText(/Créer une nouvelle enveloppe et migrer/i),
      );

      // Fill in the form using fireEvent for reliable value setting
      const nameInput = screen.getByPlaceholderText(
        /Nom de la nouvelle enveloppe/i,
      );
      fireEvent.change(nameInput, {
        target: { value: "Nouvelle Enveloppe" },
      });

      const budgetInput = screen.getByPlaceholderText(/Budget mensuel/i);
      fireEvent.change(budgetInput, { target: { value: "300" } });

      // The button should now be "Créer et migrer"
      const confirmBtn = screen.getByRole("button", {
        name: /Créer et migrer/i,
      });

      await userEvent.click(confirmBtn);

      await waitFor(() => {
        expect(onCreateAndMigrate).toHaveBeenCalledWith(
          "Nouvelle Enveloppe",
          300,
        );
      });
    });

    it("calls onDeleteAll when delete-all is selected", async () => {
      const onDeleteAll = jest.fn().mockResolvedValue(undefined);
      const props = defaultProps({ linkedTransactions: txs });
      props.onDeleteAll = onDeleteAll;
      render(<DeleteEnvelopeModal {...props} />);

      // Click the delete-all radio
      await userEvent.click(screen.getByText(/Tout supprimer/i));

      const deleteBtn = screen.getByRole("button", {
        name: /Tout supprimer/i,
      });
      await userEvent.click(deleteBtn);

      await waitFor(() => {
        expect(onDeleteAll).toHaveBeenCalled();
      });
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────

  describe("edge cases", () => {
    it("disables migrate-existing when no other envelopes exist", () => {
      const singleEnvelope = [makeEnvelope()];
      const props = defaultProps({
        envelopes: singleEnvelope,
        linkedTransactions: [makeTx()],
      });
      render(<DeleteEnvelopeModal {...props} />);

      expect(
        screen.getByText(/Aucune autre enveloppe disponible/i),
      ).toBeInTheDocument();
    });

    it("shows loading state during operation", () => {
      // The component enters loading state after confirm is clicked
      const onMigrateToExisting = jest.fn(
        () => new Promise<void>(() => {
          /* never resolves */
        }),
      );
      const props = defaultProps({
        linkedTransactions: [makeTx()],
      });
      props.onMigrateToExisting = onMigrateToExisting;
      render(<DeleteEnvelopeModal {...props} />);

      fireEvent.click(
        screen.getByRole("button", { name: /Migrer et supprimer/i }),
      );

      // Should show loading spinner text
      expect(
        screen.getByText(/Migration en cours/i),
      ).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      const props = { ...defaultProps(), isOpen: false };
      render(<DeleteEnvelopeModal {...props} />);

      expect(
        screen.queryByText(/Supprimer l'enveloppe/i),
      ).not.toBeInTheDocument();
    });

    it("shows the envelope name in the header", () => {
      const props = defaultProps();
      render(<DeleteEnvelopeModal {...props} />);

      expect(screen.getByText("Alimentation")).toBeInTheDocument();
    });
  });
});
