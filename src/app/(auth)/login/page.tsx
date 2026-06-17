"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  OAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { useAuth } from "@/context/AuthContext";

function isFirebaseAuthError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

export default function AuthPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | null>(null);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const syncedUserIdRef = useRef<string | null>(null);

  const buildUserProfile = (currentUser: User) => {
    const email = currentUser.email?.trim() || "";

    // Apple Sign-In may only provide email/displayName on first sign-in.
    // Subsequent sign-ins can have email === null, so we fall back to a
    // provider-scoped identifier. Apple private relay emails use the
    // @privaterelay.appleid.com domain — the local part is still usable.
    const fallbackDisplayName = email
      ? email.split("@")[0]
      : currentUser.uid.slice(0, 8);

    const displayName = currentUser.displayName?.trim() || fallbackDisplayName;

    const profile: Record<string, unknown> = {
      displayName: displayName.slice(0, 100),
      lastLogin: new Date().toISOString(),
      ...(currentUser.photoURL ? { photoURL: currentUser.photoURL } : {}),
    };

    // Email is optional for Apple (only provided on first sign-in).
    // Always store it when available, but don't require it.
    if (email) {
      profile.email = email;
    }

    return profile;
  };

  const syncUserProfile = async (currentUser: User) => {
    await setDoc(doc(db, "users", currentUser.uid), buildUserProfile(currentUser), { merge: true });
  };

  const finalizeAuthenticatedUser = useCallback(
    async (currentUser: User) => {
      if (syncedUserIdRef.current === currentUser.uid) {
        return;
      }

      syncedUserIdRef.current = currentUser.uid;

      try {
        await syncUserProfile(currentUser);
      } catch (err: unknown) {
        logger.sanitizedError("Authentication profile sync error", err);
      }

      router.push("/dashboard");
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const redirectResult = await getRedirectResult(auth);

        if (!cancelled && redirectResult?.user) {
          await finalizeAuthenticatedUser(redirectResult.user);
        }
      } catch (err: unknown) {
        logger.sanitizedError("Redirect result error", err);
        if (!cancelled) {
          setError("Erreur lors du retour de connexion. Veuillez réessayer.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [finalizeAuthenticatedUser]);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    void finalizeAuthenticatedUser(user);
  }, [authLoading, finalizeAuthenticatedUser, user]);

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);
    setLoadingProvider("google");
    const provider = new GoogleAuthProvider();

    try {
      const userCredential = await signInWithPopup(auth, provider);
      await finalizeAuthenticatedUser(userCredential.user);
    } catch (err: unknown) {
      if (isFirebaseAuthError(err) && err.code === "auth/popup-blocked") {
        logger.warn("Google auth popup blocked, falling back to redirect");
        await signInWithRedirect(auth, provider);
        return;
      }

      if (isFirebaseAuthError(err) && err.code === "auth/popup-closed-by-user") {
        setError("La fenêtre Google a été fermée avant la fin de la connexion.");
        return;
      }

      logger.sanitizedError("Google authentication error", err);
      setError("Erreur lors de la connexion avec Google. Veuillez réessayer.");
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleAppleAuth = async () => {
    setError("");
    setLoading(true);
    setLoadingProvider("apple");
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");

    try {
      const userCredential = await signInWithPopup(auth, provider);
      await finalizeAuthenticatedUser(userCredential.user);
    } catch (err: unknown) {
      if (isFirebaseAuthError(err) && err.code === "auth/popup-blocked") {
        logger.warn("Apple auth popup blocked, falling back to redirect");
        await signInWithRedirect(auth, provider);
        return;
      }

      if (isFirebaseAuthError(err) && err.code === "auth/popup-closed-by-user") {
        setError("La fenêtre Apple a été fermée avant la fin de la connexion.");
        return;
      }

      logger.sanitizedError("Apple authentication error", err);
      setError("Erreur lors de la connexion avec Apple. Veuillez réessayer.");
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-app-surface p-8 shadow-xl border border-app-border">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h1.5m-1.5 0h-1.5m-9 0H4.5m1.5 0H4.5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-app-text">Vizualy Budget</h1>
          <p className="text-sm text-app-text-secondary">
            Gérez votre budget en toute simplicité
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-900/40 p-3 text-sm text-red-300 border border-red-800/60" role="alert">
            {error}
          </div>
        )}

        {/* Sign-In Buttons */}
        <div className="space-y-3">
          {/* Apple Sign-In Button — follows Apple HIG: black background, white text, rounded */}
          <button
            type="button"
            onClick={handleAppleAuth}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#000] px-4 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-app-bg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] dark:bg-white dark:text-black dark:hover:bg-[#e8e8e8] dark:focus:ring-black/50"
            aria-label="Se connecter avec Apple"
          >
            {loading && loadingProvider === "apple" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Continuer avec Apple
              </>
            )}
          </button>

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-app-border" />
            <span className="text-xs text-app-text-secondary">ou</span>
            <div className="flex-1 h-px bg-app-border" />
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3.5 text-sm font-semibold text-app-text transition-all hover:bg-white/5 hover:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-app-bg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            aria-label="Se connecter avec Google"
          >
            {loading && loadingProvider === "google" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continuer avec Google
              </>
            )}
          </button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-app-text-secondary">
          En vous connectant, vous acceptez que vos données soient stockées de façon sécurisée via Firebase.
        </p>
      </div>
    </div>
  );
}
