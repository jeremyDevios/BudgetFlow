import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
    commit: jest.fn().mockResolvedValue(undefined),
  })),
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
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

function createDocSnapshot(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  };
}

function createCollectionSnapshot(items: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    forEach: (
      callback: (doc: { id: string; data: () => Record<string, unknown> }) => void,
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
  });

  it("activates the fixed-cost detail button inline on the first click", async () => {
    render(<SettingsPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Paramètres/i })).toBeInTheDocument(),
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
      expect(screen.getByRole("heading", { name: /Confidentialité/i })).toBeInTheDocument(),
    );

    expect(screen.getByRole("switch", { name: /Mode anonyme/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("persists anonymous mode changes and updates the shared state", async () => {
    render(<SettingsPage />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /Mode anonyme/i })).toBeInTheDocument(),
    );

    const anonymousModeSwitch = screen.getByRole("switch", { name: /Mode anonyme/i });

    expect(anonymousModeSwitch).toHaveAttribute("aria-checked", "false");

    await userEvent.click(anonymousModeSwitch);

    await waitFor(() =>
      expect(saveSettingsMock).toHaveBeenCalledWith("user-1", { anonymousMode: true }),
    );

    expect(setAnonymousModeMock).toHaveBeenCalledWith(true);
    expect(anonymousModeSwitch).toHaveAttribute("aria-checked", "true");
  });
});
