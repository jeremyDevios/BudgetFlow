import type { BudgetVersionEntry, BudgetVersionItem, UserSettings } from "@/types/settings";

/**
 * Versioned budget values (income / fixed costs / savings) — web mirror of the
 * iOS engine `BudgetVersionTimeline.swift` (+ `BudgetVersionMutationService`).
 *
 * Two responsibilities, both needed to keep web and iOS consistent:
 *
 *  1. **Read** — `resolveVersionAmount(history, flat, monthKey)` returns the
 *     value effective for a month (resolution on the month's last day), so a
 *     dated change no longer leaks the current value into past months. Months
 *     no version covers resolve to the closest known version — never to the
 *     flats, which mirror *today* (see `resolveVersionAmountOnDay`).
 *  2. **Write** — `applyBudgetOperation(...)` mirrors the iOS mutation
 *     semantics (materialise the "before" version, splice, coalesce, cap) and
 *     returns the timeline + the flats to persist, so a web edit stays visible
 *     in the dated views instead of being shadowed by an iOS version.
 *
 * Everything works on `YYYY-MM-DD` strings (project convention): no Date is
 * ever stored, and day arithmetic is done on UTC parts to stay DST-proof.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Anchor of the first materialised version (day 0). */
export const SENTINEL_START_DATE = "0001-01-01";

/** Maximum number of versions per timeline (SEC-24, mirrors the Firestore rule). */
export const MAX_VERSION_COUNT = 100;

/** Estimated byte budget per timeline, keeps the settings doc below 1 MiB. */
const MAX_ESTIMATED_BYTES_PER_TIMELINE = 250_000;

/** Amounts closer than this are considered equal (mirrors iOS epsilon). */
const AMOUNT_EPSILON = 0.000_001;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type BudgetCategory = "income" | "fixedCosts" | "savings";

/** Flat (non-versioned) state of the three budget axes. */
export interface FlatBudgetState {
  monthlyIncome: number;
  fixedCosts: number;
  monthlySavings: number;
  fixedCostsDetailedEnabled: boolean;
  savingsDetailedEnabled: boolean;
  fixedCostsItems: BudgetVersionItem[];
  savingsItems: BudgetVersionItem[];
  /**
   * Earliest known data day (`settings.createdAt`), used to anchor the initial
   * materialised version. Absent → the sentinel start date.
   */
  earliestKnownDate?: string | null;
}

/** Edits the web can apply to a timeline. Mirrors the iOS operation subset used by the UI. */
export type BudgetTimelineOperation =
  | { kind: "setAmount"; value: number }
  | { kind: "setDetailedEnabled"; enabled: boolean }
  | { kind: "replaceContent"; total: number; detailedEnabled: boolean; items: BudgetVersionItem[] };

export interface BudgetTimelineMutation {
  history: BudgetVersionEntry[];
  flatAmount: number;
  flatDetailedEnabled?: boolean;
  flatItems?: BudgetVersionItem[];
  /** True when nothing changed — the caller must skip the write. */
  isNoOp: boolean;
}

// ---------------------------------------------------------------------------
// Day helpers
// ---------------------------------------------------------------------------

/** Parses `YYYY-MM-DD`, rejecting impossible dates (`2026-02-30`, `2026-13-01`). */
export function isValidDayString(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= lastDayOfMonthNumber(year, month);
}

function lastDayOfMonthNumber(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDayParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Today as a local `YYYY-MM-DD` day (the app's string-date convention). */
export function todayDayString(now: Date = new Date()): string {
  return formatDayParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Local `YYYY-MM-DD` day of a stored `createdAt` timestamp, or `null` when it
 * is missing/unreadable. Mirrors the iOS anchor conversion
 * (`BudgetVersionTimeline.dayString(from: settings.createdAt)`), which is what
 * keeps the initial materialised version identical on both platforms.
 */
export function dayFromTimestamp(timestamp: unknown): string | null {
  if (typeof timestamp !== "string" || timestamp.length === 0) return null;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return todayDayString(parsed);
}

/** The day before `day`. Invalid input is returned unchanged. */
export function dayBefore(day: string): string {
  if (!isValidDayString(day)) return day;
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  date.setUTCDate(date.getUTCDate() - 1);
  return formatDayParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Last day of a `YYYY-MM` key (`"2026-02"` → `"2026-02-28"`). */
export function lastDayOfMonth(monthKey: string): string | null {
  const parts = monthKey.split("-");
  if (parts.length !== 2) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return formatDayParts(year, month, lastDayOfMonthNumber(year, month));
}

// ---------------------------------------------------------------------------
// Read side
// ---------------------------------------------------------------------------

/** Amount carried by a version (`amount` for income, `total` otherwise). */
export function versionAmount(version: BudgetVersionEntry): number {
  return version.amount ?? version.total ?? 0;
}

/**
 * The version active on `day`: the latest `startDate <= day` among the versions
 * whose period covers the day (`endDate == null` or `endDate >= day`).
 * Returns `null` when no version covers the day — callers fall back to the flat.
 * Tolerant to unsorted input.
 */
export function resolveVersion(
  history: BudgetVersionEntry[] | undefined | null,
  on: string,
): BudgetVersionEntry | null {
  if (!history || history.length === 0) return null;
  let best: BudgetVersionEntry | null = null;
  for (const version of history) {
    if (version.startDate > on) continue;
    if (version.endDate !== null && version.endDate < on) continue;
    if (best === null || version.startDate > best.startDate) best = version;
  }
  return best;
}

/**
 * Effective amount on an arbitrary day — the single fallback policy shared by
 * every caller (Dashboard, Évolution, Cash Flow, Analyse…).
 *
 * - Empty/absent timeline → `flat`: the legacy behaviour, where the flat value
 *   applies to every month.
 * - Day covered by a version → that version's amount.
 * - **Day not covered** (before the first version, or a gap between two
 *   versions) → the closest known version: the last one starting on or before
 *   that day, else the earliest one.
 *
 * That last rule matters: the flats mirror the version active *today*, so
 * falling back to them projects present-day values onto past months. Observed
 * case — a history anchored late, flat at 0 → every earlier month of the
 * Évolution curve showed 0 instead of the value that actually applied then,
 * and a PEA stopped on 01/10 showed its old 155 € on every later month. Same
 * rule as the engine's internal `preChange` baseline below.
 */
export function resolveVersionAmountOnDay(
  history: BudgetVersionEntry[] | undefined | null,
  flat: number,
  day: string,
): number {
  if (!history || history.length === 0) return flat;
  const active = resolveVersion(history, day);
  if (active) return versionAmount(active);

  const sorted = [...history].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  let closest: BudgetVersionEntry | null = null;
  for (const entry of sorted) {
    if (entry.startDate <= day) closest = entry;
    else break;
  }
  closest = closest ?? sorted[0];
  return closest ? versionAmount(closest) : flat;
}

/**
 * Effective amount for month `YYYY-MM` (resolution happens on the month's last
 * day). Callers working on a custom budget month should pass the period's own
 * last day to `resolveVersionAmountOnDay` instead — with a payday on the 5th,
 * a change dated 01/10 belongs to the period "2026-09" (05/09 → 04/10).
 */
export function resolveVersionAmount(
  history: BudgetVersionEntry[] | undefined | null,
  flat: number,
  monthKey: string,
): number {
  const lastDay = lastDayOfMonth(monthKey);
  if (!lastDay) return flat;
  return resolveVersionAmountOnDay(history, flat, lastDay);
}

/**
 * Effective fixed costs and savings for a month, resolved from the versioned
 * histories with the flat values as fallback.
 */
export function resolveBudgetValuesForMonth(
  monthKey: string,
  settings: Pick<
    UserSettings,
    "fixedCosts" | "monthlySavings" | "fixedCostsHistory" | "savingsHistory"
  >,
): { fixedCosts: number; monthlySavings: number } {
  return {
    fixedCosts: resolveVersionAmount(settings.fixedCostsHistory, settings.fixedCosts, monthKey),
    monthlySavings: resolveVersionAmount(
      settings.savingsHistory,
      settings.monthlySavings,
      monthKey,
    ),
  };
}

/**
 * Effective fixed income for a month. Only meaningful for fixed income — the
 * variable path resolves per-month overrides instead (`resolveMonthlyIncome`).
 */
export function resolveMonthlyIncomeFromHistory(
  monthKey: string,
  settings: Pick<UserSettings, "monthlyIncome" | "incomeHistory">,
): number {
  return resolveVersionAmount(settings.incomeHistory, settings.monthlyIncome, monthKey);
}

// ---------------------------------------------------------------------------
// Write side
// ---------------------------------------------------------------------------

/** Flat state of the three axes, read from a settings object. */
export function flatBudgetStateFrom(
  settings: UserSettings,
  earliestKnownDate?: string | null,
): FlatBudgetState {
  return {
    monthlyIncome: settings.monthlyIncome ?? 0,
    fixedCosts: settings.fixedCosts ?? 0,
    monthlySavings: settings.monthlySavings ?? 0,
    fixedCostsDetailedEnabled: settings.fixedCostsDetailedEnabled === true,
    savingsDetailedEnabled: settings.savingsDetailedEnabled === true,
    fixedCostsItems: settings.fixedCostsItems ?? [],
    savingsItems: settings.savingsItems ?? [],
    earliestKnownDate: earliestKnownDate ?? null,
  };
}

/** Timeline field carrying a category's history. */
export function historyFieldFor(
  category: BudgetCategory,
): "incomeHistory" | "fixedCostsHistory" | "savingsHistory" {
  switch (category) {
    case "income":
      return "incomeHistory";
    case "fixedCosts":
      return "fixedCostsHistory";
    case "savings":
      return "savingsHistory";
  }
}

/** Amount field carrying a category's flat value. */
export function amountFieldFor(
  category: BudgetCategory,
): "monthlyIncome" | "fixedCosts" | "monthlySavings" {
  switch (category) {
    case "income":
      return "monthlyIncome";
    case "fixedCosts":
      return "fixedCosts";
    case "savings":
      return "monthlySavings";
  }
}

/** Timeline of a category, read from a settings object. */
export function timelineFor(
  category: BudgetCategory,
  settings: Pick<UserSettings, "incomeHistory" | "fixedCostsHistory" | "savingsHistory">,
): BudgetVersionEntry[] {
  switch (category) {
    case "income":
      return settings.incomeHistory ?? [];
    case "fixedCosts":
      return settings.fixedCostsHistory ?? [];
    case "savings":
      return settings.savingsHistory ?? [];
  }
}

function flatAmount(category: BudgetCategory, flat: FlatBudgetState): number {
  switch (category) {
    case "income":
      return flat.monthlyIncome;
    case "fixedCosts":
      return flat.fixedCosts;
    case "savings":
      return flat.monthlySavings;
  }
}

function flatDetailedEnabled(category: BudgetCategory, flat: FlatBudgetState): boolean | undefined {
  switch (category) {
    case "income":
      return undefined;
    case "fixedCosts":
      return flat.fixedCostsDetailedEnabled;
    case "savings":
      return flat.savingsDetailedEnabled;
  }
}

function flatItems(category: BudgetCategory, flat: FlatBudgetState): BudgetVersionItem[] | undefined {
  switch (category) {
    case "income":
      return undefined;
    case "fixedCosts":
      return flat.fixedCostsItems;
    case "savings":
      return flat.savingsItems;
  }
}

function freshId(): string {
  const supportsRandomUuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
  return supportsRandomUuid ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function itemsEqual(a?: BudgetVersionItem[], b?: BudgetVersionItem[]): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return (
      item.id === other.id &&
      item.name === other.name &&
      Math.abs(item.amount - other.amount) < AMOUNT_EPSILON &&
      (item.order ?? index) === (other.order ?? index)
    );
  });
}

function contentEquals(
  version: BudgetVersionEntry,
  desired: DesiredContent,
): boolean {
  return (
    (version.amount ?? null) === (desired.amount ?? null) &&
    (version.total ?? null) === (desired.total ?? null) &&
    (version.detailedEnabled ?? null) === (desired.detailedEnabled ?? null) &&
    itemsEqual(version.items, desired.items)
  );
}

function makeVersion(startDate: string, desired: DesiredContent): BudgetVersionEntry {
  return {
    id: freshId(),
    startDate,
    endDate: null,
    ...(desired.amount !== undefined ? { amount: desired.amount } : {}),
    ...(desired.total !== undefined ? { total: desired.total } : {}),
    ...(desired.detailedEnabled !== undefined
      ? { detailedEnabled: desired.detailedEnabled }
      : {}),
    ...(desired.items !== undefined ? { items: desired.items } : {}),
    updatedAt: new Date().toISOString(),
  };
}

interface DesiredContent {
  amount?: number;
  total?: number;
  detailedEnabled?: boolean;
  items?: BudgetVersionItem[];
}

function normaliseOrder(items: BudgetVersionItem[]): BudgetVersionItem[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

function splice(
  timeline: BudgetVersionEntry[],
  newVersion: BudgetVersionEntry,
  day: string,
): BudgetVersionEntry[] {
  const sorted = [...timeline].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  const before: BudgetVersionEntry[] = [];
  const after: BudgetVersionEntry[] = [];

  for (const version of sorted) {
    if (version.startDate >= day) {
      after.push(version);
    } else if (version.endDate !== null && version.endDate < day) {
      before.push(version);
    } else {
      // Starts before D and still active the day before → covers D.
      before.push({ ...version, endDate: dayBefore(day) });
    }
  }
  // A version starting exactly at D is superseded by the new one.
  const remaining = after.filter((version) => version.startDate !== day);

  const inserted: BudgetVersionEntry = { ...newVersion };
  inserted.endDate = remaining.length > 0 ? dayBefore(remaining[0].startDate) : null;

  return [...before, inserted, ...remaining];
}

/** Merges adjacent versions (contiguous days, identical content) into one. */
function coalesce(timeline: BudgetVersionEntry[]): BudgetVersionEntry[] {
  const sorted = [...timeline].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  const result: BudgetVersionEntry[] = [];
  for (const version of sorted) {
    const last = result[result.length - 1];
    if (
      last &&
      last.endDate !== null &&
      last.endDate === dayBefore(version.startDate) &&
      contentEquals(last, {
        amount: version.amount,
        total: version.total,
        detailedEnabled: version.detailedEnabled,
        items: version.items,
      })
    ) {
      result[result.length - 1] = {
        ...last,
        endDate: version.endDate,
        updatedAt: version.updatedAt,
      };
    } else {
      result.push(version);
    }
  }
  return result;
}

/** Fuses the oldest versions when the timeline exceeds the count/byte budget. */
function capped(
  timeline: BudgetVersionEntry[],
  maxEntries: number = MAX_VERSION_COUNT,
  maxBytes: number = MAX_ESTIMATED_BYTES_PER_TIMELINE,
): BudgetVersionEntry[] {
  let result = [...timeline].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  while (result.length > maxEntries || estimateBytes(result) > maxBytes) {
    if (result.length < 2) break;
    const fused: BudgetVersionEntry = { ...result[1], startDate: result[0].startDate };
    result = [fused, ...result.slice(2)];
  }
  return result;
}

function estimateBytes(timeline: BudgetVersionEntry[]): number {
  try {
    return JSON.stringify(timeline).length;
  } catch {
    return 0;
  }
}

/**
 * The initial version covering the past before the first dated edit:
 * `[min(earliestKnownDate ?? sentinel, day), dayBefore(day)]`.
 * `null` when nothing precedes the change.
 */
function materializeInitialVersion(
  category: BudgetCategory,
  flat: FlatBudgetState,
  effectiveFrom: string,
): BudgetVersionEntry | null {
  const anchor = flat.earliestKnownDate ?? SENTINEL_START_DATE;
  const initialStart = anchor < effectiveFrom ? anchor : effectiveFrom;
  if (!(initialStart < effectiveFrom)) return null;
  return {
    ...makeVersion(initialStart, flatContent(category, flat)),
    endDate: dayBefore(effectiveFrom),
  };
}

/**
 * One-day snapshot anchored the day before `day`, used when the first dated
 * edit happens on or before the earliest known date (nothing precedes it).
 */
function materializePreChangeSnapshot(
  category: BudgetCategory,
  flat: FlatBudgetState,
  before: string,
): BudgetVersionEntry | null {
  const anchor = dayBefore(before);
  if (!isValidDayString(anchor)) return null;
  return { ...makeVersion(anchor, flatContent(category, flat)), endDate: anchor };
}

/** The flat content of a category as a version snapshot. */
function flatContent(category: BudgetCategory, flat: FlatBudgetState): DesiredContent {
  if (category === "income") {
    return { amount: flat.monthlyIncome };
  }
  return {
    total: flatAmount(category, flat),
    detailedEnabled: flatDetailedEnabled(category, flat) ?? false,
    items: flatItems(category, flat) ?? [],
  };
}

function contentEqualsFlat(
  desired: DesiredContent,
  category: BudgetCategory,
  flat: FlatBudgetState,
): boolean {
  const desiredAmount = desired.amount ?? desired.total ?? 0;
  if (Math.abs(desiredAmount - flatAmount(category, flat)) >= AMOUNT_EPSILON) return false;
  if (desired.detailedEnabled !== undefined) {
    if (desired.detailedEnabled !== (flatDetailedEnabled(category, flat) ?? false)) return false;
    if (!itemsEqual(desired.items, flatItems(category, flat))) return false;
  }
  return true;
}

function mutation(
  desired: DesiredContent,
  newTimeline: BudgetVersionEntry[],
  flat: FlatBudgetState,
  category: BudgetCategory,
  previousTimeline: BudgetVersionEntry[],
  today: string,
): BudgetTimelineMutation {
  // The flats mirror the version ACTIVE TODAY: a scheduled (future) change
  // leaves them on the current content until it takes effect.
  const active = resolveVersion(newTimeline, today);
  const activeContent: DesiredContent = active
    ? {
        amount: versionAmount(active),
        detailedEnabled: active.detailedEnabled,
        items: active.items,
      }
    : {
        amount: desired.amount ?? desired.total ?? 0,
        detailedEnabled: desired.detailedEnabled,
        items: desired.items,
      };

  const isNoOp =
    timelineEquals(newTimeline, previousTimeline) &&
    Math.abs((activeContent.amount ?? 0) - flatAmount(category, flat)) < AMOUNT_EPSILON &&
    (activeContent.detailedEnabled ?? undefined) === flatDetailedEnabled(category, flat) &&
    itemsEqual(activeContent.items, flatItems(category, flat));

  return {
    history: newTimeline,
    flatAmount: activeContent.amount ?? 0,
    flatDetailedEnabled: activeContent.detailedEnabled,
    flatItems: activeContent.items,
    isNoOp,
  };
}

function timelineEquals(a: BudgetVersionEntry[], b: BudgetVersionEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((version, index) => {
    const other = b[index];
    return (
      version.id === other.id &&
      version.startDate === other.startDate &&
      (version.endDate ?? null) === (other.endDate ?? null) &&
      versionAmount(version) === versionAmount(other) &&
      (version.detailedEnabled ?? null) === (other.detailedEnabled ?? null) &&
      itemsEqual(version.items, other.items)
    );
  });
}

/**
 * Applies an operation to a category's timeline from `effectiveDay`, returning
 * the new timeline plus the flat values to persist.
 *
 * @param operation    - the edit to apply.
 * @param category     - the axis being edited.
 * @param effectiveDay - when the edit takes effect (`YYYY-MM-DD`).
 * @param settings     - current settings (timeline + flats source).
 * @param today        - current day (`YYYY-MM-DD`), used for the flat mirror.
 */
export function applyBudgetOperation(
  operation: BudgetTimelineOperation,
  category: BudgetCategory,
  effectiveDay: string,
  settings: UserSettings,
  today: string = todayDayString(),
): BudgetTimelineMutation {
  return applyBudgetOperationToTimeline(
    operation,
    category,
    effectiveDay,
    timelineFor(category, settings),
    flatBudgetStateFrom(settings),
    today,
  );
}

/**
 * Same as {@link applyBudgetOperation}, on an explicit timeline + flat state —
 * the entry point for callers that read the timeline and the flats separately
 * (like the iOS mutation service) or that need an explicit `earliestKnownDate`
 * (the stored `createdAt`).
 */
export function applyBudgetOperationToTimeline(
  operation: BudgetTimelineOperation,
  category: BudgetCategory,
  effectiveDay: string,
  existing: BudgetVersionEntry[],
  flat: FlatBudgetState,
  today: string = todayDayString(),
): BudgetTimelineMutation {
  const noOp = (): BudgetTimelineMutation => ({
    history: existing,
    flatAmount: flatAmount(category, flat),
    flatDetailedEnabled: flatDetailedEnabled(category, flat),
    flatItems: flatItems(category, flat),
    isNoOp: true,
  });

  if (category === "income" && operation.kind !== "setAmount") return noOp();
  if (!isValidDayString(effectiveDay)) return noOp();

  // Pre-change state = what is active on the effective day itself.
  const preChange = (
    day: string,
  ): { amount: number; detailedEnabled?: boolean; items?: BudgetVersionItem[] } => {
    const active = resolveVersion(existing, day);
    if (active) {
      return {
        amount: versionAmount(active),
        detailedEnabled: active.detailedEnabled,
        items: active.items,
      };
    }
    // No version covers that day. The flats are only a legitimate fallback when
    // there is no history at all: they mirror the version active TODAY, not the
    // state back then. Building a back-dated edit from them would inject
    // present-day values into the past (observed on iOS: the whole history
    // shifted by one line). Take the closest known version instead — the last
    // one before that day (gap case), or else the earliest, the only
    // information available before the history starts.
    const sorted = [...existing].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const baseline = [...sorted].reverse().find((v) => v.startDate <= day) ?? sorted[0];
    if (baseline) {
      return {
        amount: versionAmount(baseline),
        detailedEnabled: baseline.detailedEnabled,
        items: baseline.items,
      };
    }
    return {
      amount: flatAmount(category, flat),
      detailedEnabled: flatDetailedEnabled(category, flat),
      items: flatItems(category, flat),
    };
  };

  let desired: DesiredContent | null;
  switch (operation.kind) {
    case "setAmount":
      if (category === "income") {
        desired = { amount: operation.value };
      } else {
        // Fixed costs/savings: setting the aggregate exits detailed mode, but
        // the items are preserved (no data loss on toggle).
        desired = {
          total: operation.value,
          detailedEnabled: false,
          items: preChange(effectiveDay).items ?? [],
        };
      }
      break;
    case "setDetailedEnabled": {
      if (category === "income") return noOp();
      if (operation.enabled) {
        const items = flatItems(category, flat) ?? [];
        if (items.length === 0) return noOp();
        desired = {
          total: items.reduce((sum, item) => sum + item.amount, 0),
          detailedEnabled: true,
          items,
        };
      } else {
        const pre = preChange(effectiveDay);
        desired = {
          total: pre.amount,
          detailedEnabled: false,
          items: pre.items ?? [],
        };
      }
      break;
    }
    case "replaceContent": {
      if (category === "income") return noOp();
      desired = {
        total: operation.total,
        detailedEnabled: operation.detailedEnabled,
        items: normaliseOrder(operation.items),
      };
      break;
    }
  }
  if (!desired) return noOp();

  // No-op fast paths.
  const activeAtDay = resolveVersion(existing, effectiveDay);
  if (activeAtDay && contentEquals(activeAtDay, desired)) return noOp();
  if (existing.length === 0 && contentEqualsFlat(desired, category, flat)) return noOp();

  const newVersion = makeVersion(effectiveDay, desired);
  let newTimeline: BudgetVersionEntry[];
  if (existing.length === 0) {
    const materialised: BudgetVersionEntry[] = [];
    const initial = materializeInitialVersion(category, flat, effectiveDay);
    if (initial) {
      materialised.push(initial);
    } else {
      const snapshot = materializePreChangeSnapshot(category, flat, effectiveDay);
      if (snapshot) materialised.push(snapshot);
    }
    materialised.push(newVersion);
    newTimeline = materialised;
  } else {
    newTimeline = splice(existing, newVersion, effectiveDay);
  }

  newTimeline = capped(coalesce(newTimeline));
  return mutation(desired, newTimeline, flat, category, existing, today);
}

/**
 * Firestore patch for a mutation: the timeline, the flat amount and — for
 * fixed costs/savings — the detailed flag and items, so the flats stay
 * identical to the version active today (iOS invariant).
 */
export function settingsPatchFromMutation(
  mutation: BudgetTimelineMutation,
  category: BudgetCategory,
): Partial<UserSettings> {
  const patch: Partial<UserSettings> = {
    [historyFieldFor(category)]: mutation.history,
    [amountFieldFor(category)]: mutation.flatAmount,
  } as Partial<UserSettings>;

  if (category === "fixedCosts") {
    patch.fixedCostsDetailedEnabled = mutation.flatDetailedEnabled ?? false;
    patch.fixedCostsItems = mutation.flatItems ?? [];
  } else if (category === "savings") {
    patch.savingsDetailedEnabled = mutation.flatDetailedEnabled ?? false;
    patch.savingsItems = mutation.flatItems ?? [];
  }
  return patch;
}

/**
 * Firestore patch for a flat amount change (mirrors the iOS `.setAmount` from
 * today): the new version, the flats, and the history in one write.
 * Returns `null` when the operation is a no-op.
 */
export function buildAmountChangePatch(
  category: BudgetCategory,
  value: number,
  settings: UserSettings,
  effectiveDay: string = todayDayString(),
): Partial<UserSettings> | null {
  const applied = applyBudgetOperation({ kind: "setAmount", value }, category, effectiveDay, settings);
  if (applied.isNoOp) return null;
  return settingsPatchFromMutation(applied, category);
}
