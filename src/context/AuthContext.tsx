"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, enableAppCheck } from "@/lib/firebase";
import { logger } from "@/lib/logger";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

/**
 * Vérifie si le bypass E2E est activé.
 *
 * En mode E2E (NEXT_PUBLIC_E2E_AUTH_BYPASS=true), un utilisateur
 * factice est injecté via localStorage pour éviter la popup Google.
 * Cette fonction est uniquement appelée côté client.
 */
function getE2EBypassUser(): User | null {
  if (typeof window === "undefined") return null;
  // SEC-28 : garde d'environnement — le bypass ne doit jamais être embarqué
  // dans un build de production, même si NEXT_PUBLIC_E2E_AUTH_BYPASS=true est
  // présent dans un .env.local de la machine de build (Next charge .env.local
  // pour tous les builds). Les tests E2E tournent sous `next dev`
  // (NODE_ENV=development) et ne sont pas affectés.
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS !== "true") return null;

  try {
    const raw = window.localStorage.getItem("e2e_user");
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      // SEC-22 : App Check (inerte sans NEXT_PUBLIC_APP_CHECK_RECAPTCHA_KEY).
      await enableAppCheck();

      // Bypass E2E : injecte un utilisateur factice depuis localStorage.
      // Si un custom token Admin est présent, on crée une VRAIE session
      // Firebase Auth pour que request.auth ≠ null dans les règles Firestore.
      const bypassUser = getE2EBypassUser();
      if (bypassUser) {
        logger.info(`AuthContext: bypass E2E activé, uid: ${(bypassUser as any).uid}`);

        const customToken = typeof window !== "undefined"
          ? window.localStorage.getItem("e2e_token")
          : null;

        if (customToken) {
          try {
            const { signInWithCustomToken } = await import("firebase/auth");
            await signInWithCustomToken(auth, customToken);
            // Token consommé — le supprimer pour ne pas tenter de le
            // réutiliser (les custom tokens sont one-shot). Si un autre
            // onglet/test en avait besoin, il aura son propre token
            // injecté par auth.setup.ts.
            window.localStorage.removeItem("e2e_token");
            // Ne pas return : onAuthStateChanged va s'initialiser ci-dessous
            // et retournera le vrai utilisateur Firebase (même UID).
          } catch (e) {
            logger.warn("AuthContext: custom token E2E échoué, fallback sur bypass");
            setUser(bypassUser);
            setLoading(false);
            return;
          }
        } else {
          // Ancien comportement : bypass pur, pas de session Firestore réelle.
          // Les opérations Firestore échoueront (request.auth = null).
          setUser(bypassUser);
          setLoading(false);
          return;
        }
      }

      // Configurer onAuthStateChanged (cas normal OU après custom token E2E).
      try {
        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          setUser(firebaseUser);
          setLoading(false);
        });
      } catch (err) {
        // Firebase Auth indisponible (ex: pas de config en CI).
        logger.warn('AuthContext: onAuthStateChanged a échoué, auth indisponible');
        setUser(null);
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Sécurité : empêche un état "loading" infini si Firebase ne répond pas
  useEffect(() => {
    if (!loading) return;
    const SAFETY_TIMEOUT_MS = 10_000;
    const timer = setTimeout(() => {
      logger.warn('AuthContext: timeout de sécurité, force loading=false');
      setLoading(false);
    }, SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!user) return;

    // Désactiver l'auto-logout en mode E2E (SEC-28 : jamais en production,
    // même si le flag E2E a fuité dans un build).
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "true"
    ) {
      return;
    }

    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        signOut(auth).catch(() => {
          logger.warn("Auto sign-out on inactivity failed");
        });
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "touchstart"];

    resetInactivityTimer();
    events.forEach((eventName) => window.addEventListener(eventName, resetInactivityTimer));

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((eventName) => window.removeEventListener(eventName, resetInactivityTimer));
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
