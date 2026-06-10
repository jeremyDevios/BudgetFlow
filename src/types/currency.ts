/**
 * Currency display types and helpers.
 *
 * The currency setting is display-only — no conversion is ever performed on
 * stored amounts. All monetary values remain raw numbers; the currency code
 * only controls how Intl.NumberFormat renders them.
 */

// ---------------------------------------------------------------------------
// Currency code
// ---------------------------------------------------------------------------

/** Supported ISO 4217 currency codes for display purposes. */
export type CurrencyCode = "EUR" | "USD" | "GBP" | "CHF" | "CAD" | "AUD" | "JPY";

// ---------------------------------------------------------------------------
// Currency metadata
// ---------------------------------------------------------------------------

export interface CurrencyOption {
  /** ISO 4217 code (e.g. "EUR"). */
  code: CurrencyCode;
  /** Display symbol (e.g. "€", "$"). */
  symbol: string;
  /** French display name shown in the settings picker. */
  name: string;
  /** Locale used by Intl.NumberFormat for digit grouping and symbol placement. */
  locale: string;
}

/**
 * All currencies the user can choose in the settings picker.
 *
 * Order matters — it determines the picker list order. EUR is first as the
 * default for existing users.
 */
export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: "EUR", symbol: "€", name: "Euro", locale: "fr-FR" },
  { code: "USD", symbol: "$", name: "Dollar américain", locale: "en-US" },
  { code: "GBP", symbol: "£", name: "Livre sterling", locale: "en-GB" },
  { code: "CHF", symbol: "CHF", name: "Franc suisse", locale: "fr-CH" },
  { code: "CAD", symbol: "CA$", name: "Dollar canadien", locale: "fr-CA" },
  { code: "AUD", symbol: "AU$", name: "Dollar australien", locale: "en-AU" },
  { code: "JPY", symbol: "¥", name: "Yen japonais", locale: "ja-JP" },
];

// ---------------------------------------------------------------------------
// Defaults & resolvers
// ---------------------------------------------------------------------------

/** Default currency applied when no value is stored (legacy documents). */
export const DEFAULT_CURRENCY: CurrencyCode = "EUR";

/** Map for O(1) currency symbol lookup. */
const SYMBOL_MAP: Record<CurrencyCode, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.symbol]),
) as Record<CurrencyCode, string>;

/** Map for O(1) locale lookup. */
const LOCALE_MAP: Record<CurrencyCode, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.locale]),
) as Record<CurrencyCode, string>;

/**
 * Resolves an unknown value (e.g. from Firestore) to a valid `CurrencyCode`.
 * Falls back to `"EUR"` for any unrecognised or missing value.
 */
export function resolveCurrencyCode(value: unknown): CurrencyCode {
  if (typeof value === "string" && value in SYMBOL_MAP) {
    return value as CurrencyCode;
  }
  return DEFAULT_CURRENCY;
}

/** Returns the display symbol for a given currency code (e.g. "€" for "EUR"). */
export function getCurrencySymbol(code: CurrencyCode): string {
  return SYMBOL_MAP[code] ?? "€";
}

/** Returns the locale string for a given currency code (e.g. "fr-FR" for "EUR"). */
export function getCurrencyLocale(code: CurrencyCode): string {
  return LOCALE_MAP[code] ?? "fr-FR";
}
