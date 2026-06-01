"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { logger } from "@/lib/logger";
import { loadSettings } from "@/lib/settingsService";

interface AnonymousModeContextValue {
  anonymousMode: boolean;
  anonymousModeReady: boolean;
  setAnonymousMode: (value: boolean) => void;
}

const AnonymousModeContext = createContext<AnonymousModeContextValue | undefined>(undefined);

export function AnonymousModeProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [anonymousMode, setAnonymousModeState] = useState(false);
  const [anonymousModeReady, setAnonymousModeReady] = useState(false);

  const setAnonymousMode = useCallback((value: boolean) => {
    setAnonymousModeState(value);
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setAnonymousModeState(false);
      setAnonymousModeReady(true);
      return;
    }

    let cancelled = false;

    const hydrateAnonymousMode = async () => {
      setAnonymousModeReady(false);

      try {
        const settings = await loadSettings(user.uid);
        if (!cancelled) {
          setAnonymousModeState(settings.anonymousMode === true);
        }
      } catch (error) {
        logger.sanitizedError("Anonymous mode settings read failed", error);
        if (!cancelled) {
          setAnonymousModeState(false);
        }
      } finally {
        if (!cancelled) {
          setAnonymousModeReady(true);
        }
      }
    };

    void hydrateAnonymousMode();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const value = useMemo(
    () => ({
      anonymousMode,
      anonymousModeReady,
      setAnonymousMode,
    }),
    [anonymousMode, anonymousModeReady, setAnonymousMode],
  );

  return <AnonymousModeContext.Provider value={value}>{children}</AnonymousModeContext.Provider>;
}

export function useAnonymousMode() {
  const context = useContext(AnonymousModeContext);

  if (!context) {
    throw new Error("useAnonymousMode must be used within an AnonymousModeProvider");
  }

  return context;
}
