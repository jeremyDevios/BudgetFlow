"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { logger } from "@/lib/logger";
import { loadSettings } from "@/lib/settingsService";
import { CurrencyCode, DEFAULT_CURRENCY } from "@/types/currency";

interface CurrencyContextValue {
  currency: CurrencyCode;
  currencyReady: boolean;
  setCurrency: (value: CurrencyCode) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [currencyReady, setCurrencyReady] = useState(false);

  const setCurrency = useCallback((value: CurrencyCode) => {
    setCurrencyState(value);
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setCurrencyState(DEFAULT_CURRENCY);
      setCurrencyReady(true);
      return;
    }

    let cancelled = false;

    const hydrateCurrency = async () => {
      setCurrencyReady(false);

      try {
        const settings = await loadSettings(user.uid);
        if (!cancelled) {
          setCurrencyState(settings.currency ?? DEFAULT_CURRENCY);
        }
      } catch (error) {
        logger.sanitizedError("Currency settings read failed", error);
        if (!cancelled) {
          setCurrencyState(DEFAULT_CURRENCY);
        }
      } finally {
        if (!cancelled) {
          setCurrencyReady(true);
        }
      }
    };

    void hydrateCurrency();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const value = useMemo(
    () => ({
      currency,
      currencyReady,
      setCurrency,
    }),
    [currency, currencyReady, setCurrency],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }

  return context;
}
