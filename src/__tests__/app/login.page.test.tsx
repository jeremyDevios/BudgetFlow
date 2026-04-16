import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AuthPage from "@/app/(auth)/login/page";

const pushMock = jest.fn();
const setDocMock = jest.fn();
const signInWithPopupMock = jest.fn();
const signInWithRedirectMock = jest.fn();
const getRedirectResultMock = jest.fn();
const useAuthMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

jest.mock("@/lib/firebase", () => ({
  auth: { app: "auth" },
  db: { app: "db" },
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => ({ type: "doc-ref" })),
  setDoc: (...args: unknown[]) => setDocMock(...args),
}));

jest.mock("firebase/auth", () => ({
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({ providerId: "google.com" })),
  getRedirectResult: (...args: unknown[]) => getRedirectResultMock(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirectMock(...args),
}));

describe("AuthPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    setDocMock.mockReset();
    signInWithPopupMock.mockReset();
    signInWithRedirectMock.mockReset();
    getRedirectResultMock.mockReset();
    useAuthMock.mockReset();

    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
    });

    setDocMock.mockResolvedValue(undefined);
    signInWithRedirectMock.mockResolvedValue(undefined);
    getRedirectResultMock.mockResolvedValue(null);
  });

  it("persists the user profile and navigates to the dashboard after popup auth succeeds", async () => {
    signInWithPopupMock.mockResolvedValue({
      user: {
        uid: "user-1",
        email: "user@example.com",
        displayName: "Budget User",
        photoURL: "https://example.com/avatar.png",
      },
    });

    render(<AuthPage />);

    await userEvent.click(screen.getByRole("button", { name: /se connecter avec google/i }));

    await waitFor(() => {
      expect(setDocMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("falls back to redirect auth when the popup is blocked", async () => {
    signInWithPopupMock.mockRejectedValue({ code: "auth/popup-blocked" });

    render(<AuthPage />);

    await userEvent.click(screen.getByRole("button", { name: /se connecter avec google/i }));

    await waitFor(() => {
      expect(signInWithRedirectMock).toHaveBeenCalled();
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("finalizes redirect auth by syncing the profile when a user is already authenticated", async () => {
    useAuthMock.mockReturnValue({
      user: {
        uid: "user-redirect",
        email: "redirect@example.com",
        displayName: null,
        photoURL: null,
      },
      loading: false,
    });

    render(<AuthPage />);

    await waitFor(() => {
      expect(setDocMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });

    expect(setDocMock).toHaveBeenCalledWith(
      { type: "doc-ref" },
      expect.objectContaining({
        email: "redirect@example.com",
        displayName: "redirect",
      }),
      { merge: true }
    );
  });

  it("finalizes the explicit redirect result returned by Firebase", async () => {
    getRedirectResultMock.mockResolvedValue({
      user: {
        uid: "redirect-result-user",
        email: "result@example.com",
        displayName: "Result User",
        photoURL: null,
      },
    });

    render(<AuthPage />);

    await waitFor(() => {
      expect(getRedirectResultMock).toHaveBeenCalled();
      expect(setDocMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});
