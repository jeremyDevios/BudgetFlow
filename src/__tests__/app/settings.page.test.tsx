import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SettingsPage from "@/app/(protected)/settings/page";
import { DEFAULT_USER_SETTINGS } from "@/types/settings";

const backMock = jest.fn();
const useAuthMock = jest.fn();
const useAnonymousModeMock = jest.fn();
const setAnonymousModeMock = jest.fn();
const loadSettingsMock = jest.fn();
const saveSettingsMock = jest.fn();
const getDocMock = jest.fn();
const getDocsMock = jest.fn();

// Envelope service mocks
const fetchLinkedTransactionsMock = jest.fn();
const migrateTransactionsToExistingMock = jest.fn();
const createEnvelopeAndMigrateMock = jest.fn();
const deleteEnvelopeAndTransactionsMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    back: backMock,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

jest.mock("@/context/AnonymousModeContext", () => ({
  useAnonymousMode: () => useAnonymousModeMock(),
}));

jest.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
}));

jest.mock("@/lib/settingsService", () => {
  const actual = jest.requireActual("@/lib/settingsService");
  return {
    ...actual,
    loadSettings: (...args: unknown[]) => loadSettingsMock(...args),
    saveSettings: (...args: unknown[]) => saveSettingsMock(...args),
  };
});

jest.mock("@/lib/envelopeService", () => ({
  fetchLinkedTransactions: (...args: unknown[]) =>
    fetchLinkedTransactionsMock(...args),
  migrateTransactionsToExisting: (...args: unknown[]) =>
    migrateTransactionsToExistingMock(...args),
  createEnvelopeAndMigrate: (...args: unknown[]) =>
    createEnvelopeAndMigrateMock(...args),
  deleteEnvelopeAndTransactions: (...args: unknown[]) =>
    deleteEnvelopeAndTransactionsMock(...args),
  groupTransactionsByMonth: jest.requireActual(
    "@/lib/envelopeService",
  ).groupTransactionsByMonth,
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ type: "collection-ref" })),
  doc: jest.fn(() => ({ type: "doc-ref" })),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  addDoc: jest.fn(),
  writeBatch: jest.fn(() => ({
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
  increment: jest.fn((n: number) => `incr(${n})`),
}));

jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    permission: "default",
    requestPermission: jest.fn(),
    disableNotifications: jest.fn(),
    loading: false,
  }),
}));

jest.mock("@/components/ThemeToggle", () => ({
  __esModule: true,
  default: () => <div data-testid="theme-toggle" />,
}));

jest.mock("@/components/settings/TemporaryEnvelopeForm", () => ({
  __esModule: true,
  default: () => null,
  ICON_MAP: {
    ShoppingCart: () => null,
  },
  COLORS: ["bg-blue-500"],
}));

jest.mock("@/components/settings/BudgetDetailEditor", () => ({
  __esModule: true,
  default: (props: {
    category: "fixedCosts" | "savings";
    enabled: boolean;
    variant?: "card" | "inline";
  }) => (
    <div
      data-testid={`budget-detail-${props.category}`}
      data-enabled={String(props.enabled)}
      data-variant={props.variant ?? "card"}
    >
      Détail mocké
    </div>
  ),
}));

// DeleteEnvelopeModal mock — renders a simple testable UI that forwards
// user actions to the real props passed by the Settings page.
const DeleteEnvelopeModalMock = (props: {
  isOpen: boolean;
  onClose: () => void;
  envelope: { id: string; name: string };
  envelopes: Array<{ id: string; name: string }>;
  linkedTransactions: Array<{ id: string; amount: number }>;
  onMigrateToExisting: (targetEnvelopeId: string) => Promise<void>;
  onCreateAndMigrate: (name: string, budget: number) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}) => {
  if (!props.isOpen) return null;
  return (
    <div data-testid="delete-envelope-modal">
      <p data-testid="modal-envelope-name">{props.envelope.name}</p>
      <p data-testid="modal-tx-count">{props.linkedTransactions.length}</p>
      <button
        data-testid="modal-migrate-btn"
        onClick={() => props.onMigrateToExisting("env-2")}
      >
        Migrer et supprimer
      </button>
      <button
        data-testid="modal-create-migrate-btn"
        onClick={() => props.onCreateAndMigrate("Nouvelle", 300)}
      >
        Créer et migrer
      </button>
      <button
        data-testid="modal-delete-all-btn"
        onClick={() => props.onDeleteAll()}
      >
        Tout supprimer
      </button>
      <button data-testid="modal-close-btn" onClick={props.onClose}>
        Annuler
      </button>
    </div>
  );
};

jest.mock(
  "@/components/settings/DeleteEnvelopeModal",
  () => ({
    __esModule: true,
    default: (
      props: React.ComponentProps<typeof DeleteEnvelopeModalMock>,
    ) => DeleteEnvelopeModalMock(props),
  }),
);

jest.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(() => ({})),
  useSensors: jest.fn(() => []),
}));

jest.mock("@dnd-kit/sortable", () => ({
  arrayMove: <T,>(items: T[]) => items,
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  sortableKeyboardCoordinates: jest.fn(),
  verticalListSortingStrategy: jest.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

jest.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => "",
    },
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────

function createDocSnapshot(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  };
}

function createCollectionSnapshot(
  items: Array<{ id: string; data: Record<string, unknown> }>,
) {
  return {
    forEach: (
      callback: (doc: {
        id: string;
        data: () => Record<string, unknown>;
      }) => void,
    ) => {
      items.forEach((item) => {
        callback({
          id: item.id,
          data: () => item.data,
        });
      });
    },
  };
}

function makeEnvelopeDoc(
  id: string,
  overrides: Record<string, unknown> = {},
): { id: string; data: Record<string, unknown> } {
  return {
    id,
    data: {
      name: `Enveloppe ${id}`,
      icon: "ShoppingCart",
      color: "bg-amber-500",
      budget: 400,
      order: 0,
      ...overrides,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("SettingsPage", () => {
  beforeEach(() => {
    backMock.mockReset();
    useAuthMock.mockReset();
    useAnonymousModeMock.mockReset();
    setAnonymousModeMock.mockReset();
    loadSettingsMock.mockReset();
    saveSettingsMock.mockReset();
    getDocMock.mockReset();
    getDocsMock.mockReset();
    fetchLinkedTransactionsMock.mockReset();
    migrateTransactionsToExistingMock.mockReset();
    createEnvelopeAndMigrateMock.mockReset();
    deleteEnvelopeAndTransactionsMock.mockReset();

    useAuthMock.mockReturnValue({
      user: {
        uid: "user-1",
        displayName: "Budget User",
        email: "budget@example.com",
        photoURL: null,
      },
    });

    useAnonymousModeMock.mockReturnValue({
      anonymousMode: false,
      anonymousModeReady: true,
      setAnonymousMode: setAnonymousModeMock,
    });

    loadSettingsMock.mockResolvedValue({ ...DEFAULT_USER_SETTINGS });
    saveSettingsMock.mockResolvedValue(undefined);
    getDocMock.mockResolvedValue(createDocSnapshot({ notificationsEnabled: false }));
    getDocsMock.mockResolvedValue(createCollectionSnapshot([]));
    fetchLinkedTransactionsMock.mockResolvedValue([]);
    migrateTransactionsToExistingMock.mockResolvedValue(undefined);
    createEnvelopeAndMigrateMock.mockResolvedValue("env-new-999");
    deleteEnvelopeAndTransactionsMock.mockResolvedValue(undefined);
  });

  // ── Existing tests ─────────────────────────────────────────────

  it("activates the fixed-cost detail button inline on the first click", async () => {
    render(<SettingsPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Paramètres/i }),
      ).toBeInTheDocument(),
    );

    expect(screen.getByTestId("budget-detail-fixedCosts")).toHaveAttribute(
      "data-enabled",
      "false",
    );
    expect(screen.getByTestId("budget-detail-fixedCosts")).toHaveAttribute(
      "data-variant",
      "inline",
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Détails des frais fixes/i }),
    );

    await waitFor(() => expect(saveSettingsMock).toHaveBeenCalledTimes(1));

    expect(screen.getByTestId("budget-detail-fixedCosts")).toHaveAttribute(
      "data-enabled",
      "true",
    );
    expect(saveSettingsMock).toHaveBeenNthCalledWith(1, "user-1", {
      fixedCostsDetailedEnabled: true,
      fixedCostsItems: [
        expect.objectContaining({
          name: "",
          amount: 0,
        }),
      ],
    });
  });

  it("renders the confidentiality section with persisted anonymous mode state", async () => {
    useAnonymousModeMock.mockReturnValue({
      anonymousMode: true,
      anonymousModeReady: true,
      setAnonymousMode: setAnonymousModeMock,
    });
    loadSettingsMock.mockResolvedValue({
      ...DEFAULT_USER_SETTINGS,
      anonymousMode: true,
    });

    render(<SettingsPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Confidentialité/i }),
      ).toBeInTheDocument(),
    );

    expect(
      screen.getByRole("switch", { name: /Mode anonyme/i }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("persists anonymous mode changes and updates the shared state", async () => {
    render(<SettingsPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: /Mode anonyme/i }),
      ).toBeInTheDocument(),
    );

    const anonymousModeSwitch = screen.getByRole("switch", {
      name: /Mode anonyme/i,
    });

    expect(anonymousModeSwitch).toHaveAttribute("aria-checked", "false");

    await userEvent.click(anonymousModeSwitch);

    await waitFor(() =>
      expect(saveSettingsMock).toHaveBeenCalledWith("user-1", {
        anonymousMode: true,
      }),
    );

    expect(setAnonymousModeMock).toHaveBeenCalledWith(true);
    expect(anonymousModeSwitch).toHaveAttribute("aria-checked", "true");
  });

  // ── New: envelope deletion flow ─────────────────────────────────

  describe("envelope deletion flow", () => {
    const env1 = makeEnvelopeDoc("env-1", { name: "Alimentation" });
    const env2 = makeEnvelopeDoc("env-2", {
      name: "Transport",
      budget: 150,
    });

    beforeEach(() => {
      // Provide two envelopes so the list renders
      getDocsMock.mockResolvedValue(createCollectionSnapshot([env1, env2]));
    });

    it("opens the delete modal when the trash button is clicked", async () => {
      fetchLinkedTransactionsMock.mockResolvedValue([
        { id: "tx-1", amount: 50, envelopeId: "env-1", date: "2026-06-01", description: "Courses" },
        { id: "tx-2", amount: 30, envelopeId: "env-1", date: "2026-06-15", description: "Pain" },
      ]);

      render(<SettingsPage />);

      await waitFor(() =>
        expect(screen.getByText("Alimentation")).toBeInTheDocument(),
      );

      // Find the trash button. The row layout is:
      //   outer div.group > (icon+name div, buttons div)
      // The trash button is in the buttons div (sibling, not parent).
      // Find the group container first, then look for the trash inside it.
      const nameEl = screen.getByText("Alimentation");
      const groupRow = nameEl.closest(".group") as HTMLElement;
      const trashButton = within(groupRow).getAllByRole("button").pop()!;

      await userEvent.click(trashButton);

      // Wait for the modal to appear with linked transactions loaded
      await waitFor(() =>
        expect(screen.getByTestId("delete-envelope-modal")).toBeInTheDocument(),
      );

      // Verify the modal received the correct envelope
      expect(screen.getByTestId("modal-envelope-name")).toHaveTextContent(
        "Alimentation",
      );
      // Verify linked transactions were fetched and passed
      expect(screen.getByTestId("modal-tx-count")).toHaveTextContent("2");

      expect(fetchLinkedTransactionsMock).toHaveBeenCalledWith(
        "user-1",
        "env-1",
      );
    });

    it("calls migrateTransactionsToExisting and removes the envelope", async () => {
      fetchLinkedTransactionsMock.mockResolvedValue([
        { id: "tx-1", amount: 50, envelopeId: "env-1", date: "2026-06-01", description: "Courses" },
      ]);

      render(<SettingsPage />);

      await waitFor(() =>
        expect(screen.getByText("Alimentation")).toBeInTheDocument(),
      );

      // Click trash
      const nameEl = screen.getByText("Alimentation");
      const groupRow = nameEl.closest(".group") as HTMLElement;
      const trashBtn = within(groupRow).getAllByRole("button").pop()!;
      await userEvent.click(trashBtn);

      await waitFor(() =>
        expect(screen.getByTestId("delete-envelope-modal")).toBeInTheDocument(),
      );

      // Click "Migrer et supprimer" in the mocked modal
      await userEvent.click(screen.getByTestId("modal-migrate-btn"));

      await waitFor(() => {
        expect(migrateTransactionsToExistingMock).toHaveBeenCalledWith(
          "user-1",
          "env-1",
          "env-2",
        );
      });

      // Envelope should be removed from the list
      await waitFor(() =>
        expect(screen.queryByText("Alimentation")).not.toBeInTheDocument(),
      );
    });

    it("calls createEnvelopeAndMigrate and adds the new envelope", async () => {
      fetchLinkedTransactionsMock.mockResolvedValue([
        { id: "tx-1", amount: 50, envelopeId: "env-1", date: "2026-06-01", description: "Courses" },
      ]);

      render(<SettingsPage />);

      await waitFor(() =>
        expect(screen.getByText("Alimentation")).toBeInTheDocument(),
      );

      // Click trash
      const nameEl = screen.getByText("Alimentation");
      const groupRow = nameEl.closest(".group") as HTMLElement;
      const trashBtn = within(groupRow).getAllByRole("button").pop()!;
      await userEvent.click(trashBtn);

      await waitFor(() =>
        expect(screen.getByTestId("delete-envelope-modal")).toBeInTheDocument(),
      );

      // Click "Créer et migrer"
      await userEvent.click(screen.getByTestId("modal-create-migrate-btn"));

      await waitFor(() => {
        expect(createEnvelopeAndMigrateMock).toHaveBeenCalledWith(
          "user-1",
          "env-1",
          {
            name: "Nouvelle",
            budget: 300,
            icon: "ShoppingCart",
            color: "bg-amber-500",
          },
        );
      });

      // The new envelope should appear (id = "env-new-999").
      // Use getAllByText because "Nouvelle" also appears in the
      // "Nouvelle Enveloppe" button in the page header.
      await waitFor(() =>
        expect(screen.getAllByText("Nouvelle").length).toBeGreaterThanOrEqual(
          2,
        ),
      );
      // Old envelope should be gone
      expect(screen.queryByText("Alimentation")).not.toBeInTheDocument();
    });

    it("calls deleteEnvelopeAndTransactions for the delete-all path", async () => {
      const txs = [
        { id: "tx-1", amount: 50, envelopeId: "env-1", date: "2026-06-01", description: "Courses" },
        { id: "tx-2", amount: 30, envelopeId: "env-1", date: "2026-06-15", description: "Pain" },
      ];
      fetchLinkedTransactionsMock.mockResolvedValue(txs);

      render(<SettingsPage />);

      await waitFor(() =>
        expect(screen.getByText("Alimentation")).toBeInTheDocument(),
      );

      // Click trash
      const nameEl = screen.getByText("Alimentation");
      const groupRow = nameEl.closest(".group") as HTMLElement;
      const trashBtn = within(groupRow).getAllByRole("button").pop()!;
      await userEvent.click(trashBtn);

      await waitFor(() =>
        expect(screen.getByTestId("delete-envelope-modal")).toBeInTheDocument(),
      );

      // Click "Tout supprimer"
      await userEvent.click(screen.getByTestId("modal-delete-all-btn"));

      await waitFor(() => {
        expect(deleteEnvelopeAndTransactionsMock).toHaveBeenCalledWith(
          "user-1",
          "env-1",
          txs,
        );
      });

      // Envelope should be removed
      await waitFor(() =>
        expect(screen.queryByText("Alimentation")).not.toBeInTheDocument(),
      );
    });

    it("fetches linked transactions when the modal opens", async () => {
      fetchLinkedTransactionsMock.mockResolvedValue([]);

      render(<SettingsPage />);

      await waitFor(() =>
        expect(screen.getByText("Alimentation")).toBeInTheDocument(),
      );

      // Click trash
      const nameEl = screen.getByText("Alimentation");
      const groupRow = nameEl.closest(".group") as HTMLElement;
      const trashBtn = within(groupRow).getAllByRole("button").pop()!;
      await userEvent.click(trashBtn);

      await waitFor(() =>
        expect(fetchLinkedTransactionsMock).toHaveBeenCalledWith(
          "user-1",
          "env-1",
        ),
      );

      // Modal should show 0 transactions
      expect(screen.getByTestId("modal-tx-count")).toHaveTextContent("0");
    });

    it("closes the modal without changes when cancelled", async () => {
      fetchLinkedTransactionsMock.mockResolvedValue([
        { id: "tx-1", amount: 50, envelopeId: "env-1", date: "2026-06-01", description: "Courses" },
      ]);

      render(<SettingsPage />);

      await waitFor(() =>
        expect(screen.getByText("Alimentation")).toBeInTheDocument(),
      );

      // Click trash
      const nameEl = screen.getByText("Alimentation");
      const groupRow = nameEl.closest(".group") as HTMLElement;
      const trashBtn = within(groupRow).getAllByRole("button").pop()!;
      await userEvent.click(trashBtn);

      await waitFor(() =>
        expect(screen.getByTestId("delete-envelope-modal")).toBeInTheDocument(),
      );

      // Click close/annuler
      await userEvent.click(screen.getByTestId("modal-close-btn"));

      await waitFor(() =>
        expect(
          screen.queryByTestId("delete-envelope-modal"),
        ).not.toBeInTheDocument(),
      );

      // Envelope should still be there
      expect(screen.getByText("Alimentation")).toBeInTheDocument();

      // No service calls
      expect(migrateTransactionsToExistingMock).not.toHaveBeenCalled();
      expect(createEnvelopeAndMigrateMock).not.toHaveBeenCalled();
      expect(deleteEnvelopeAndTransactionsMock).not.toHaveBeenCalled();
    });
  });
});
