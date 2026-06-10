import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TransactionModal from "@/components/dashboard/TransactionModal";

const addDocMock = jest.fn();
const updateDocMock = jest.fn();
const deleteDocMock = jest.fn();
const incrementMock = jest.fn();
const collectionMock = jest.fn();
const docMock = jest.fn();
const sanitizedErrorMock = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "user-1" },
  }),
}));

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    sanitizedError: (...args: unknown[]) => sanitizedErrorMock(...args),
  },
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  doc: (...args: unknown[]) => docMock(...args),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  increment: (...args: unknown[]) => incrementMock(...args),
}));

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
        >(({ children, ...props }, ref) => {
          const domProps = Object.fromEntries(
            Object.entries(props).filter(([key]) => !motionProps.has(key))
          );

          return React.createElement(tag, { ...domProps, ref }, children);
        });

        MockMotionComponent.displayName = `MockMotion(${tag})`;

        return MockMotionComponent;
      },
    }
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const envelopes = [
  {
    id: "env-1",
    name: "Courses",
    icon: "ShoppingCart",
    color: "bg-blue-500",
    budget: 100,
    spent: 10,
  },
  {
    id: "env-2",
    name: "Transport",
    icon: "Fuel",
    color: "bg-red-500",
    budget: 150,
    spent: 20,
  },
];

// ---------------------------------------------------------------------------
// Shared fixture: one temporary envelope active only in March and April 2026.
// ---------------------------------------------------------------------------
const tempEnvelope = {
  id: "env-temp",
  name: "Vacances été",
  icon: "Sun",
  color: "bg-amber-500",
  budget: 500,
  spent: 50,
  isTemporary: true,
  activeMonths: ["2026-03", "2026-04"],
};

// Envelopes list that includes the temporary envelope.
const envelopesWithTemp = [...envelopes, tempEnvelope];

// ---------------------------------------------------------------------------
// Helper: renders the modal with the temp envelope pre-selected via
// defaultEnvelopeId so every test starts in a consistent state.
// ---------------------------------------------------------------------------
function renderWithTemp(
  overrides: Partial<React.ComponentProps<typeof TransactionModal>> = {}
) {
  const onClose = jest.fn();
  const refreshData = jest.fn();
  render(
    <TransactionModal
      isOpen
      onClose={onClose}
      envelopes={envelopesWithTemp}
      refreshData={refreshData}
      defaultEnvelopeId="env-temp"
      {...overrides}
    />
  );
  return { onClose, refreshData };
}

// ---------------------------------------------------------------------------
// Regression suite: temporary-envelope visual marking and date validation.
// ---------------------------------------------------------------------------
describe("TransactionModal – temporary-envelope regression", () => {
  beforeEach(() => {
    // System time: 14 April 2026 – inside the temp envelope's activeMonths.
    jest.useFakeTimers().setSystemTime(new Date("2026-04-14T12:00:00.000Z"));
    addDocMock.mockReset().mockResolvedValue({ id: "tx-new" });
    updateDocMock.mockReset().mockResolvedValue(undefined);
    deleteDocMock.mockReset().mockResolvedValue(undefined);
    incrementMock.mockReset().mockImplementation((value: number) => ({ incrementBy: value }));
    collectionMock.mockReset().mockImplementation((_db: unknown, ...path: unknown[]) => ({ path }));
    docMock.mockReset().mockImplementation((_db: unknown, ...path: unknown[]) => ({ path }));
    sanitizedErrorMock.mockReset();
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- 1. Visual marking ------------------------------------------------- //

  it("renders a 'tmp' badge inside the picker button for every temporary envelope", () => {
    renderWithTemp();
    // Exactly one "tmp" badge should be visible (only one temp envelope).
    const badges = screen.getAllByText("tmp");
    expect(badges).toHaveLength(1);
  });

  it("applies a dashed border to the temporary envelope picker button", () => {
    renderWithTemp();
    // The picker button for a temporary envelope must carry border-dashed.
    const tempButton = screen.getByRole("button", { name: /Vacances été/i });
    expect(tempButton.className).toMatch(/border-dashed/);
  });

  it("does NOT render a 'tmp' badge or dashed border on non-temporary envelope buttons", () => {
    renderWithTemp();
    const coursesButton = screen.getByRole("button", { name: /Courses/i });
    expect(coursesButton.className).not.toMatch(/border-dashed/);
  });

  // --- 2. Submit disabled when date is outside activeMonths -------------- //

  it("disables the submit button when the selected date is outside the temporary envelope's activeMonths", () => {
    renderWithTemp();
    // Move the date to May 2026 – outside ["2026-03", "2026-04"].
    fireEvent.change(screen.getByLabelText(/Date de la transaction/i), {
      target: { value: "2026-05-15" },
    });
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeDisabled();
  });

  it("keeps the submit button enabled when the date falls within the temporary envelope's activeMonths", () => {
    renderWithTemp();
    // Default date is 2026-04-14 which is inside activeMonths – button must be enabled.
    expect(screen.getByRole("button", { name: "Ajouter" })).not.toBeDisabled();
  });

  it("does not disable the submit button for a non-temporary envelope regardless of date", () => {
    // Render with a regular envelope selected.
    render(
      <TransactionModal
        isOpen
        onClose={jest.fn()}
        envelopes={envelopesWithTemp}
        refreshData={jest.fn()}
        defaultEnvelopeId="env-1"
      />
    );
    fireEvent.change(screen.getByLabelText(/Date de la transaction/i), {
      target: { value: "2026-05-15" },
    });
    expect(screen.getByRole("button", { name: "Ajouter" })).not.toBeDisabled();
  });

  // --- 3. Warning message appearance and content ------------------------- //

  it("shows a role='alert' warning when the date is outside the temporary envelope's activeMonths", () => {
    renderWithTemp();
    fireEvent.change(screen.getByLabelText(/Date de la transaction/i), {
      target: { value: "2026-05-15" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("includes the French rejection sentence in the warning message", () => {
    renderWithTemp();
    fireEvent.change(screen.getByLabelText(/Date de la transaction/i), {
      target: { value: "2026-05-15" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cette enveloppe temporaire n'accepte pas de dépense pour cette date."
    );
  });

  it("lists the valid months in French inside the warning message", () => {
    renderWithTemp();
    // activeMonths: ["2026-03", "2026-04"] → "Mars 2026 / Avril 2026"
    fireEvent.change(screen.getByLabelText(/Date de la transaction/i), {
      target: { value: "2026-05-15" },
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Mars 2026");
    expect(alert).toHaveTextContent("Avril 2026");
    // Both months must be present in the same alert element.
    expect(alert.textContent).toMatch(/Mars 2026.*Avril 2026/);
  });

  // --- 4. Warning clears when date corrected to a valid month ------------ //

  it("removes the warning when the date is corrected to a month within activeMonths", () => {
    renderWithTemp();
    // First trigger the error…
    fireEvent.change(screen.getByLabelText(/Date de la transaction/i), {
      target: { value: "2026-05-15" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // …then correct it back to a valid month (March 2026).
    fireEvent.change(screen.getByLabelText(/Date de la transaction/i), {
      target: { value: "2026-03-10" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("re-enables the submit button after the date is corrected to a valid month", () => {
    renderWithTemp();
    fireEvent.change(screen.getByLabelText(/Date de la transaction/i), {
      target: { value: "2026-05-15" },
    });
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Date de la transaction/i), {
      target: { value: "2026-04-01" },
    });
    expect(screen.getByRole("button", { name: "Ajouter" })).not.toBeDisabled();
  });

  // --- 5. Switching envelopes clears a stale validation error ------------ //

  it("clears the warning when the user switches from a temporary to a regular envelope", () => {
    renderWithTemp();
    // Trigger the error on the temp envelope.
    fireEvent.change(screen.getByLabelText(/Date de la transaction/i), {
      target: { value: "2026-05-15" },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Switch to a non-temporary envelope.
    fireEvent.click(screen.getByRole("button", { name: /Courses/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Original CRUD suite (unchanged).
// ---------------------------------------------------------------------------
describe("TransactionModal", () => {
  const onClose = jest.fn();
  const refreshData = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-14T12:00:00.000Z"));
    addDocMock.mockReset().mockResolvedValue({ id: "tx-new" });
    updateDocMock.mockReset().mockResolvedValue(undefined);
    deleteDocMock.mockReset().mockResolvedValue(undefined);
    incrementMock.mockReset().mockImplementation((value: number) => ({ incrementBy: value }));
    collectionMock.mockReset().mockImplementation((_db, ...path) => ({ path }));
    docMock.mockReset().mockImplementation((_db, ...path) => ({ path }));
    sanitizedErrorMock.mockReset();
    onClose.mockReset();
    refreshData.mockReset();
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates a transaction and updates the selected envelope spent amount", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <TransactionModal
        isOpen
        onClose={onClose}
        envelopes={envelopes}
        refreshData={refreshData}
        defaultEnvelopeId="env-2"
      />
    );

    fireEvent.change(screen.getByLabelText(/Montant de la transaction/i), {
      target: { value: "25.5" },
    });
    fireEvent.change(screen.getByLabelText(/Description de la transaction/i), {
      target: { value: "Burger" },
    });
    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() => expect(addDocMock).toHaveBeenCalledTimes(1));

    expect(addDocMock).toHaveBeenCalledWith(
      { path: ["users", "user-1", "transactions"] },
      expect.objectContaining({
        amount: 25.5,
        description: "Burger",
        envelopeId: "env-2",
        date: "2026-04-14T00:00:00.000Z",
        createdAt: "2026-04-14T12:00:00.000Z",
      })
    );
    expect(updateDocMock).toHaveBeenCalledWith(
      { path: ["users", "user-1", "envelopes", "env-2"] },
      { spent: { incrementBy: 25.5 } }
    );
    expect(refreshData).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("edits a transaction and adjusts the envelope aggregate by the amount delta", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <TransactionModal
        isOpen
        onClose={onClose}
        envelopes={envelopes}
        refreshData={refreshData}
        transactionToEdit={{
          id: "tx-1",
          amount: 10,
          description: "Taxi",
          envelopeId: "env-1",
          date: "2026-04-10T12:00:00.000Z",
        }}
      />
    );

    const amountInput = screen.getByLabelText(/Montant de la transaction/i);
    fireEvent.change(amountInput, {
      target: { value: "30" },
    });
    await user.click(screen.getByRole("button", { name: "Modifier" }));

    await waitFor(() => expect(updateDocMock).toHaveBeenCalledTimes(2));

    expect(updateDocMock).toHaveBeenNthCalledWith(
      1,
      { path: ["users", "user-1", "transactions", "tx-1"] },
      {
        amount: 30,
        description: "Taxi",
        envelopeId: "env-1",
        date: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-14T12:00:00.000Z",
        isReimbursement: false,
      }
    );
    expect(updateDocMock).toHaveBeenNthCalledWith(
      2,
      { path: ["users", "user-1", "envelopes", "env-1"] },
      { spent: { incrementBy: 20 } }
    );
    expect(refreshData).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deletes a transaction and refunds the original amount to the envelope", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <TransactionModal
        isOpen
        onClose={onClose}
        envelopes={envelopes}
        refreshData={refreshData}
        transactionToEdit={{
          id: "tx-1",
          amount: 18,
          description: "Plein",
          envelopeId: "env-2",
          date: "2026-04-10T12:00:00.000Z",
        }}
      />
    );

    await user.click(screen.getByTitle(/Supprimer la dépense/i));

    await waitFor(() => expect(deleteDocMock).toHaveBeenCalledTimes(1));

    expect(deleteDocMock).toHaveBeenCalledWith({
      path: ["users", "user-1", "transactions", "tx-1"],
    });
    expect(updateDocMock).toHaveBeenCalledWith(
      { path: ["users", "user-1", "envelopes", "env-2"] },
      { spent: { incrementBy: -18 } }
    );
    expect(refreshData).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows validation error when amount is zero", async () => {
    render(
      <TransactionModal
        isOpen
        onClose={onClose}
        envelopes={envelopes}
        refreshData={refreshData}
      />
    );

    // Set amount to 0, fill valid description
    fireEvent.change(screen.getByLabelText(/Montant de la transaction/i), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText(/Description de la transaction/i), {
      target: { value: "Test" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Ajouter/i }));

    await waitFor(() => {
      expect(screen.getByText(/supérieur à 0/)).toBeInTheDocument();
    });

    // Firestore write should NOT have been called
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it("shows validation error when description is empty", async () => {
    render(
      <TransactionModal
        isOpen
        onClose={onClose}
        envelopes={envelopes}
        refreshData={refreshData}
      />
    );

    fireEvent.change(screen.getByLabelText(/Montant de la transaction/i), {
      target: { value: "50" },
    });
    // Leave description empty

    fireEvent.click(screen.getByRole("button", { name: /Ajouter/i }));

    await waitFor(() => {
      expect(screen.getByText(/ne peut pas être vide/)).toBeInTheDocument();
    });

    expect(addDocMock).not.toHaveBeenCalled();
  });

  it("shows validation error when description exceeds 255 characters", async () => {
    render(
      <TransactionModal
        isOpen
        onClose={onClose}
        envelopes={envelopes}
        refreshData={refreshData}
      />
    );

    fireEvent.change(screen.getByLabelText(/Montant de la transaction/i), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText(/Description de la transaction/i), {
      target: { value: "a".repeat(256) },
    });

    fireEvent.click(screen.getByRole("button", { name: /Ajouter/i }));

    await waitFor(() => {
      expect(screen.getByText(/ne peut pas dépasser 255/)).toBeInTheDocument();
    });

    expect(addDocMock).not.toHaveBeenCalled();
  });

  it("shows quota error when monthly transaction limit is reached", async () => {
    render(
      <TransactionModal
        isOpen
        onClose={onClose}
        envelopes={envelopes}
        refreshData={refreshData}
        currentMonthTransactionCount={500}
      />
    );

    fireEvent.change(screen.getByLabelText(/Montant de la transaction/i), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText(/Description de la transaction/i), {
      target: { value: "Test" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Ajouter/i }));

    await waitFor(() => {
      expect(screen.getByText(/Limite atteinte/)).toBeInTheDocument();
    });

    expect(addDocMock).not.toHaveBeenCalled();
  });

  it("does NOT show quota error when editing an existing transaction", async () => {
    render(
      <TransactionModal
        isOpen
        onClose={onClose}
        envelopes={envelopes}
        refreshData={refreshData}
        transactionToEdit={{
          id: "tx-1",
          amount: 18,
          description: "Plein",
          envelopeId: "env-2",
          date: "2026-04-10T12:00:00.000Z",
        }}
        currentMonthTransactionCount={500}
      />
    );

    // Modify amount — quota does not apply to edits
    fireEvent.change(screen.getByLabelText(/Montant de la transaction/i), {
      target: { value: "30" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Modifier/i }));

    await waitFor(() => {
      expect(updateDocMock).toHaveBeenCalled();
    });
  });
});
