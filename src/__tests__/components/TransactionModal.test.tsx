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
const triggerHapticMock = jest.fn();

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

jest.mock("@/hooks/useHaptics", () => ({
  useHaptics: () => ({
    trigger: (...args: unknown[]) => triggerHapticMock(...args),
  }),
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
    triggerHapticMock.mockReset();
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
    expect(triggerHapticMock).toHaveBeenCalledWith("success");
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
      }
    );
    expect(updateDocMock).toHaveBeenNthCalledWith(
      2,
      { path: ["users", "user-1", "envelopes", "env-1"] },
      { spent: { incrementBy: 20 } }
    );
    expect(triggerHapticMock).toHaveBeenCalledWith("success");
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
    expect(triggerHapticMock).toHaveBeenCalledWith("success");
    expect(refreshData).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("triggers a selection haptic when changing the envelope", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <TransactionModal
        isOpen
        onClose={onClose}
        envelopes={envelopes}
        refreshData={refreshData}
        defaultEnvelopeId="env-1"
      />
    );

    await user.click(screen.getByRole("button", { name: /transport/i }));

    expect(triggerHapticMock).toHaveBeenCalledWith("selection");
  });

  it("does not trigger a selection haptic when reselecting the current envelope", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <TransactionModal
        isOpen
        onClose={onClose}
        envelopes={envelopes}
        refreshData={refreshData}
        defaultEnvelopeId="env-1"
      />
    );

    await user.click(screen.getByRole("button", { name: /courses/i }));

    expect(triggerHapticMock).not.toHaveBeenCalled();
  });
});
