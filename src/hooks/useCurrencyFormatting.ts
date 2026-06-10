"use client";

import { useCallback } from "react";

import { useAnonymousMode } from "@/context/AnonymousModeContext";
import { useCurrency } from "@/context/CurrencyContext";
import { maskAmount } from "@/lib/maskAmount";
import { getCurrencyLocale, getCurrencySymbol } from "@/types/currency";

/**
 * Convenience hook bundling currency + anonymous mode into pre-bound
 * formatting functions for use in client components.
 *
 * Components that don't need anonymous mode can use `useCurrency()` directly
 * and call `maskAmount()` with their own parameters.
 */
export function useCurrencyFormatting() {
  const { currency } = useCurrency();
  const { anonymousMode } = useAnonymousMode();

  /** Formats an amount with the current currency (respects anonymous mode). */
  const formatAmount = useCallback(
    (amount: number, decimals = 2): string => {
      const locale = getCurrencyLocale(currency);
      return maskAmount({
        amount: Number(amount || 0),
        currency,
        locale,
        anonymousMode,
      });
    },
    [currency, anonymousMode],
  );

  /** Formats an amount without decimals (respects anonymous mode). */
  const formatAmountNoDecimals = useCallback(
    (amount: number): string => {
      const locale = getCurrencyLocale(currency);
      return maskAmount({
        amount: Number(amount || 0),
        currency,
        locale,
        anonymousMode,
        currencyDisplay: "narrowSymbol",
      });
    },
    [currency, anonymousMode],
  );

  /** Current currency display symbol (e.g. "€", "$"). */
  const symbol = getCurrencySymbol(currency);

  return { formatAmount, formatAmountNoDecimals, symbol, currency };
}
