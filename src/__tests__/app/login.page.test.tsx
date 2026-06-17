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
  OAuthProvider: jest.fn().mockImplementation((providerId: string) => ({
    providerId,
    scopes: [] as string[],
    addScope(scope: string) {
      this.scopes.push(scope);
      return this;
    },
  })),
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

  describe("Google Sign-In", () => {
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

    it("shows a French error when the popup is closed", async () => {
      signInWithPopupMock.mockRejectedValue({ code: "auth/popup-closed-by-user" });

      render(<AuthPage />);

      await userEvent.click(screen.getByRole("button", { name: /se connecter avec google/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "La fenêtre Google a été fermée avant la fin de la connexion."
      );
    });
  });

  describe("Apple Sign-In", () => {
    it("persists the user profile and navigates to the dashboard after Apple popup auth succeeds", async () => {
      signInWithPopupMock.mockResolvedValue({
        user: {
          uid: "apple-user-1",
          email: "apple_user@privaterelay.appleid.com",
          displayName: "Apple User",
          photoURL: null,
        },
      });

      render(<AuthPage />);

      await userEvent.click(screen.getByRole("button", { name: /se connecter avec apple/i }));

      await waitFor(() => {
        expect(setDocMock).toHaveBeenCalled();
        expect(pushMock).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("falls back to redirect auth when the Apple popup is blocked", async () => {
      signInWithPopupMock.mockRejectedValue({ code: "auth/popup-blocked" });

      render(<AuthPage />);

      await userEvent.click(screen.getByRole("button", { name: /se connecter avec apple/i }));

      await waitFor(() => {
        expect(signInWithRedirectMock).toHaveBeenCalled();
      });
      expect(pushMock).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows a French error when the Apple popup is closed", async () => {
      signInWithPopupMock.mockRejectedValue({ code: "auth/popup-closed-by-user" });

      render(<AuthPage />);

      await userEvent.click(screen.getByRole("button", { name: /se connecter avec apple/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "La fenêtre Apple a été fermée avant la fin de la connexion."
      );
    });

    it("handles the case where Apple returns null email (subsequent sign-in)", async () => {
      signInWithPopupMock.mockResolvedValue({
        user: {
          uid: "apple-user-no-email",
          email: null,
          displayName: null,
          photoURL: null,
        },
      });

      render(<AuthPage />);

      await userEvent.click(screen.getByRole("button", { name: /se connecter avec apple/i }));

      await waitFor(() => {
        expect(setDocMock).toHaveBeenCalledWith(
          { type: "doc-ref" },
          expect.objectContaining({
            displayName: "apple-us", // first 8 chars of uid
          }),
          { merge: true }
        );
        expect(pushMock).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  describe("Pre-authenticated user", () => {
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

  describe("UI elements", () => {
    it("renders both Google and Apple sign-in buttons", () => {
      render(<AuthPage />);

      expect(screen.getByRole("button", { name: /se connecter avec google/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /se connecter avec apple/i })).toBeInTheDocument();
    });

    it("renders the 'ou' separator between buttons", () => {
      render(<AuthPage />);

      expect(screen.getByText("ou")).toBeInTheDocument();
    });
  });
});
