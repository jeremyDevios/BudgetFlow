export interface MaskAmountOptions {
  amount: number;
  currency: string;
  locale?: string | string[];
  anonymousMode?: boolean;
  mask?: string;
  currencyDisplay?: Intl.NumberFormatOptions["currencyDisplay"];
}

const DEFAULT_MASK = "••••";

function createCurrencyFormatter({
  currency,
  locale,
  currencyDisplay,
}: Pick<MaskAmountOptions, "currency" | "locale" | "currencyDisplay">) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(currencyDisplay ? { currencyDisplay } : {}),
  });
}

/**
 * Formats a real currency amount or returns a masked display string.
 *
 * When anonymous mode is enabled, numeric parts collapse to a single mask token
 * while currency tokens and locale-specific spacing remain unchanged.
 */
export function maskAmount({
  amount,
  currency,
  locale,
  anonymousMode = false,
  mask = DEFAULT_MASK,
  currencyDisplay,
}: MaskAmountOptions): string {
  const formatter = createCurrencyFormatter({ currency, locale, currencyDisplay });

  if (!anonymousMode) {
    return formatter.format(amount);
  }

  let insertedMask = false;
  const masked = formatter
    .formatToParts(amount)
    .map((part) => {
      if (
        part.type === "currency" ||
        part.type === "literal" ||
        part.type === "minusSign" ||
        part.type === "plusSign"
      ) {
        return part.value;
      }

      if (!insertedMask) {
        insertedMask = true;
        return mask;
      }

      return "";
    })
    .join("");

  return insertedMask ? masked : formatter.format(amount);
}
