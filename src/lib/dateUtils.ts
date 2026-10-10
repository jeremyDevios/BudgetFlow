import {
  budgetPeriod,
  DEFAULT_CUSTOM_MONTH_CONFIG,
} from "@/lib/budgetMonth";

/**
 * Bornes du mois calendaire — conservé pour compatibilité : l'implémentation
 * est désormais le moteur `budgetPeriod` avec la config désactivée, ce qui
 * garantit l'identité exacte avec l'ancienne implémentation (testée dans
 * `budgetMonth.test.ts` sur 2 années complètes).
 */
export const getMonthBounds = (date: Date) => {
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return budgetPeriod(monthKey, DEFAULT_CUSTOM_MONTH_CONFIG);
};

export const formatMonthYear = (date: Date) => {
  return date.toLocaleString("fr-FR", { month: "long", year: "numeric" });
};

const MOIS_ABREVIATIONS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

function parseDayKey(dateStr: string): { y: number; m: number; d: number } | null {
  const match = DAY_KEY_PATTERN.exec(dateStr);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * Libellé français déterministe d'une plage de période budgétaire, ex.
 * « du 25 sept. au 24 oct. ». L'année n'apparaît que lorsqu'elle change
 * entre les deux bornes. Déterministe (pas de `Intl`) pour rester testable.
 */
export function formatMonthRangeLabel(start: string, end: string): string {
  const s = parseDayKey(start);
  const e = parseDayKey(end.slice(0, 10));
  if (!s || !e) return "";
  const startLabel = `${s.d} ${MOIS_ABREVIATIONS[s.m - 1]}`;
  const endLabel =
    s.y === e.y
      ? `${e.d} ${MOIS_ABREVIATIONS[e.m - 1]}`
      : `${e.d} ${MOIS_ABREVIATIONS[e.m - 1]} ${e.y}`;
  return `du ${startLabel} au ${endLabel}`;
}
