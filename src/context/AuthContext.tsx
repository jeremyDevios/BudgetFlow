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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

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
