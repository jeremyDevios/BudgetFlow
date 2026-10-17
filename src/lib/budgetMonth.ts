/**
 * Moteur du « mois budgétaire personnalisé » (date de tombée du salaire).
 *
 * Quand l'option est activée, le mois budgétaire `M` s'étend du jour de paie
 * de `M` (`customMonthStartDay`, surchargé par `customMonthStartOverrides`)
 * au jour de paie de `M+1`, exclus. Avec un jour de paie à 1 — ou l'option
 * désactivée — la période est strictement identique au mois calendaire :
 * aucune régression pour les utilisateurs existants.
 *
 * Conventions :
 *  - toutes les dates sont des chaînes locales `YYYY-MM-DD` et les clés de
 *    mois des `YYYY-MM` (jamais de `Date` UTC) ;
 *  - les bornes retournées reprennent exactement le format de l'historique
 *    `dateUtils.getMonthBounds` : `start` = `YYYY-MM-DD`, `end` =
 *    `YYYY-MM-DDT23:59:59` inclusif.
 */

export interface CustomMonthConfig {
  /** Option activée par l'utilisateur dans les réglages. */
  enabled: boolean;
  /** Jour de paie commun à tous les mois (1..28). */
  startDay: number;
  /** Jour de paie spécifique par mois : `"YYYY-MM"` → jour (1..28). */
  overrides: Record<string, number>;
}

/** Configuration par défaut : mois calendaires (comportement historique). */
export const DEFAULT_CUSTOM_MONTH_CONFIG: CustomMonthConfig = {
  enabled: false,
  startDay: 1,
  overrides: {},
};

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// ---------------------------------------------------------------------------
// Arithmétique locale sur chaînes de dates (jamais de Date UTC)
// ---------------------------------------------------------------------------

interface YMD {
  y: number;
  m: number;
  d: number;
}

function parseDayKey(dateStr: string): YMD | null {
  const match = DAY_KEY_PATTERN.exec(dateStr);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function parseMonthKey(monthKey: string): { y: number; m: number } | null {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatDayKey(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function formatMonthKey(y: number, m: number): string {
  return `${y}-${pad2(m)}`;
}

/** Nombre de jours du mois `m` (1-based) de l'année `y`. */
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/**
 * Index jour absolu en jours civils (via Date.UTC : aucune DST côté UTC).
 * La différence entre deux index donne le vrai écart en jours, quel que
 * soit le nombre de jours des mois traversés.
 */
function dayIndex(ymd: YMD): number {
  return Math.round(Date.UTC(ymd.y, ymd.m - 1, ymd.d) / 86400000);
}

/** Déplace une clé `YYYY-MM-DD` de `delta` jours (arith. locale). */
function addDaysToKey(dateStr: string, delta: number): string {
  const ymd = parseDayKey(dateStr);
  if (!ymd) return dateStr;
  const date = new Date(ymd.y, ymd.m - 1, ymd.d + delta);
  return formatDayKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Déplace une clé `YYYY-MM` de `offset` mois. */
export function addMonthsToKey(monthKey: string, offset: number): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  const total = parsed.y * 12 + (parsed.m - 1) + offset;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return formatMonthKey(y, m);
}

// ---------------------------------------------------------------------------
// Sanitization (lecture tolérante de payloads Firestore inconnus)
// ---------------------------------------------------------------------------

const MAX_OVERRIDES = 100; // SEC-24 : borne alignée sur la limite des règles.

function isDayOfMonth(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 28
  );
}

/**
 * Valide et assainit des valeurs Firestore inconnues en `CustomMonthConfig`.
 *
 * Rétrocompatible par conception : un document legacy (champs absents)
 * produit la config par défaut = mois calendaires. Les valeurs malformées
 * retombent silencieusement sur les défauts plutôt que de lever.
 */
export function sanitizeCustomMonthConfig(raw: unknown): CustomMonthConfig {
  if (raw === null || typeof raw !== "object") {
    return { ...DEFAULT_CUSTOM_MONTH_CONFIG };
  }
  const candidate = raw as Record<string, unknown>;

  const startDay = isDayOfMonth(candidate.customMonthStartDay)
    ? candidate.customMonthStartDay
    : DEFAULT_CUSTOM_MONTH_CONFIG.startDay;

  const overrides: Record<string, number> = {};
  if (
    candidate.customMonthStartOverrides !== null &&
    typeof candidate.customMonthStartOverrides === "object"
  ) {
    const entries = Object.entries(
      candidate.customMonthStartOverrides as Record<string, unknown>,
    );
    for (const [monthKey, day] of entries.slice(0, MAX_OVERRIDES)) {
      if (MONTH_KEY_PATTERN.test(monthKey) && isDayOfMonth(day)) {
        overrides[monthKey] = day;
      }
    }
  }

  return {
    enabled: candidate.customMonthEnabled === true,
    startDay,
    overrides,
  };
}

/**
 * Construit la config depuis des réglages typés (déjà assainis en lecture).
 * Pratique pour les appels depuis les pages et hooks. Accepte tout objet
 * partiel (y compris `{}` ou un document Firestore brut) — la sanitization
 * reste faite par `sanitizeCustomMonthConfig`.
 */
export function getCustomMonthConfig(settings: {
  customMonthEnabled?: unknown;
  customMonthStartDay?: unknown;
  customMonthStartOverrides?: unknown;
}): CustomMonthConfig {
  return sanitizeCustomMonthConfig({
    customMonthEnabled: settings.customMonthEnabled,
    customMonthStartDay: settings.customMonthStartDay,
    customMonthStartOverrides: settings.customMonthStartOverrides,
  });
}

/**
 * True si l'option produit un découpage différent du calendaire. Sert
 * uniquement à l'UI (sous-titre de plage, libellés) — les calculs, eux,
 * passent toujours par la config.
 */
export function isCustomMonthActive(config: CustomMonthConfig): boolean {
  return (
    config.enabled &&
    (config.startDay > 1 || Object.keys(config.overrides).length > 0)
  );
}

// ---------------------------------------------------------------------------
// Bornes de période
// ---------------------------------------------------------------------------

/**
 * Jour de début effectif du mois budgétaire `monthKey` :
 * surcharge du mois, sinon jour global, clampé au dernier jour du mois
 * (défensif — les valeurs valides 1..28 existent dans tous les mois).
 *
 * Option désactivée → 1 (mois calendaire), même si `startDay`/`overrides`
 * restent stockés : ils sont conservés mais inopérants tant que l'option
 * n'est pas réactivée.
 */
export function effectiveStartDay(monthKey: string, config: CustomMonthConfig): number {
  if (!config.enabled) return 1;
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return 1;
  const day = config.overrides[monthKey] ?? config.startDay;
  return Math.min(day, daysInMonth(parsed.y, parsed.m));
}

/** Premier jour (`YYYY-MM-DD`) du mois budgétaire `monthKey`. */
export function periodStartKey(monthKey: string, config: CustomMonthConfig): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  return formatDayKey(parsed.y, parsed.m, effectiveStartDay(monthKey, config));
}

/**
 * Bornes du mois budgétaire `monthKey`.
 *
 * Identité garantie : avec une config désactivée (ou `startDay` 1 sans
 * surcharge), la sortie est strictement égale — à la chaîne près — à
 * l'ancien `getMonthBounds` (mois calendaire, `end` = dernier jour 23:59:59).
 */
export function budgetPeriod(
  monthKey: string,
  config: CustomMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
): { start: string; end: string } {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) {
    return { start: monthKey, end: monthKey };
  }
  const start = formatDayKey(parsed.y, parsed.m, effectiveStartDay(monthKey, config));
  const nextStart = addDaysToKey(
    periodStartKey(addMonthsToKey(monthKey, 1), config),
    -1,
  );
  return { start, end: `${nextStart}T23:59:59` };
}

/**
 * Clé du mois budgétaire auquel appartient une date `YYYY-MM-DD`.
 *
 * Une date antérieure au jour de paie de son mois calendaire appartient
 * encore au mois budgétaire précédent. Config désactivée → clé calendaire
 * (`slice(0,7)`), identique au comportement historique.
 */
export function budgetMonthKeyForDate(
  dateStr: string,
  config: CustomMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
): string {
  const calendarKey = dateStr.slice(0, 7);
  if (!config.enabled) return calendarKey;

  const ymd = parseDayKey(dateStr);
  const parsedMonth = parseMonthKey(calendarKey);
  if (!ymd || !parsedMonth) return calendarKey;

  const startDay = effectiveStartDay(calendarKey, config);
  if (ymd.d >= startDay) return calendarKey;
  return addMonthsToKey(calendarKey, -1);
}

/** Clé + bornes du mois budgétaire contenant `dateStr`. */
export function budgetPeriodForDate(
  dateStr: string,
  config: CustomMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
): { key: string; start: string; end: string } {
  const key = budgetMonthKeyForDate(dateStr, config);
  return { key, ...budgetPeriod(key, config) };
}

/** Navigation de mois budgétaire : `offset` = +1 / -1. */
export function addBudgetPeriods(
  monthKey: string,
  offset: number,
  config: CustomMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
): string {
  return addMonthsToKey(monthKey, offset);
}

// ---------------------------------------------------------------------------
// Grille d'affichage (heatmap dashboard + widget)
// ---------------------------------------------------------------------------

/**
 * Clés `YYYY-MM-DD` des jours affichés par les grilles (heatmap du dashboard
 * et widget) pour le mois budgétaire `monthKey` : du premier jour de la
 * période à la VEILLE du début de la période suivante, exclu (ex. jour de
 * paie au 5 : 5 sept. → 1er oct.). L'intervalle est donc
 * `[jour de paie, jour de paie suivant)` — choix produit assumé, le jour de
 * paie suivant appartient à la période suivante.
 *
 * Retourne `[]` quand l'option est inactive (désactivée, ou `startDay` 1 sans
 * surcharge) : chaque appelant garde son repli sur le mois calendaire.
 *
 * Miroir de `BudgetMonthEngine.displayDayKeys` (iOS, `BudgetMonthEngine.swift`).
 */
export function displayDayKeys(
  monthKey: string,
  config: CustomMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
): string[] {
  if (!isCustomMonthActive(config)) return [];

  const start = periodStartKey(monthKey, config);
  const nextStart = periodStartKey(addMonthsToKey(monthKey, 1), config);
  if (!DAY_KEY_PATTERN.test(start) || !DAY_KEY_PATTERN.test(nextStart)) return [];

  const keys: string[] = [];
  let cursor = start;
  let safety = 0;
  // Comparaison lexicographique = chronologique (clés `YYYY-MM-DD` paddées).
  while (cursor < nextStart && safety < 33) {
    keys.push(cursor);
    cursor = addDaysToKey(cursor, 1);
    safety += 1;
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Durées de période (ratios forecast / insights)
// ---------------------------------------------------------------------------

/**
 * Nombre de jours de la période (28..31 selon les mois de départ/arrivée).
 */
export function daysInBudgetPeriod(
  monthKey: string,
  config: CustomMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
): number {
  const { start, end } = budgetPeriod(monthKey, config);
  const startYmd = parseDayKey(start);
  const endYmd = parseDayKey(end.slice(0, 10));
  if (!startYmd || !endYmd) return 0;
  return dayIndex(endYmd) - dayIndex(startYmd) + 1;
}

/**
 * Position de `todayStr` dans la période : jours écoulés (aujourd'hui
 * inclus) et jours restants (après aujourd'hui). Reprend les sémantiques
 * historiques `getMonthElapsedRatio` / `getRemainingDaysInMonth`.
 */
export function elapsedAndRemainingInBudgetPeriod(
  monthKey: string,
  todayStr: string,
  config: CustomMonthConfig = DEFAULT_CUSTOM_MONTH_CONFIG,
): { elapsed: number; remaining: number; total: number } {
  const { start, end } = budgetPeriod(monthKey, config);
  const startYmd = parseDayKey(start);
  const endYmd = parseDayKey(end.slice(0, 10));
  const todayYmd = parseDayKey(todayStr.slice(0, 10));
  if (!startYmd || !endYmd || !todayYmd) {
    return { elapsed: 0, remaining: 0, total: 0 };
  }
  const total = dayIndex(endYmd) - dayIndex(startYmd) + 1;
  const elapsed = Math.min(
    Math.max(dayIndex(todayYmd) - dayIndex(startYmd) + 1, 0),
    total,
  );
  const remaining = Math.max(dayIndex(endYmd) - dayIndex(todayYmd), 0);
  return { elapsed, remaining, total };
}
