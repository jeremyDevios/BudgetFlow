"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
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
    // Bypass E2E : injecte l'utilisateur factice sans Firebase Auth
    const bypassUser = getE2EBypassUser();
    if (bypassUser) {
      logger.info("AuthContext: bypass E2E activé, uid:", (bypassUser as any).uid);
      setUser(bypassUser);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Désactiver l'auto-logout en mode E2E
    if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "true") return;

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
