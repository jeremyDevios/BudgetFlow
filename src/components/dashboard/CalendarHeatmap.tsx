"use client";

import type { CSSProperties } from "react";

import { computeSpendSeverity, computeSpendSeverityFromEnvelopes, type EnvelopeSpendEntry, type SpendSeverity } from "@/lib/calendarSeverity";

// "inactive" and "future" are structural states; the four active states come from severity.
type ActiveState = SpendSeverity; // "login-only" | "low-spend" | "moderate-spend" | "heavy-spend"
type DayState = ActiveState | "inactive" | "future";
type MilestoneState = "achieved" | "in-progress" | "next";

interface CalendarHeatmapProps {
  month: Date;
  /** Total spend per date string ("YYYY-MM-DD"), summed across all transactions. */
  dailySpend: Map<string, number>;
  perEnvelopeSpendPerDay?: Map<string, EnvelopeSpendEntry[]>;
  loginDates: Set<string>;
  /** Sum of all visible envelope budgets for the month. Used for severity ratio. */
  monthlyBudget: number;
  loading?: boolean;
  title?: string;
  className?: string;
  embedded?: boolean;
}

interface DayCell {
  dateStr: string;
  day: number;
}

const getLocalDateString = (date: Date): string => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().split("T")[0];
};

const getCellState = (
  dateStr: string,
  todayString: string,
  dailySpend: Map<string, number>,
  loginDates: Set<string>,
  monthlyBudget: number,
  perEnvelopeSpendPerDay?: Map<string, EnvelopeSpendEntry[]>
): DayState => {
  if (dateStr > todayString) return "future";

  const daySpend = dailySpend.get(dateStr) ?? 0;
  const hasSpend = daySpend > 0;
  const hasLogin = loginDates.has(dateStr);

  if (!hasSpend && !hasLogin) return "inactive";

  if (!hasSpend) return "login-only";

  // Per-envelope path (preferred)
  const entries = perEnvelopeSpendPerDay?.get(dateStr);
  if (entries && entries.length > 0) {
    return computeSpendSeverityFromEnvelopes(entries);
  }
  // Fallback: global ratio
  return computeSpendSeverity(daySpend, monthlyBudget);
};

// Active-state cell style — gradient + border + glow matching the approved tokens.
// CSS variables (--hm-*) are set in globals.css with light/dark variants.
const getActiveCellStyle = (state: ActiveState): CSSProperties => {
  switch (state) {
    case "login-only":
      return {
        background:
          "linear-gradient(135deg, var(--hm-login-only-from) 0%, var(--hm-login-only-to) 100%)",
        borderColor: "var(--hm-login-only-border)",
        borderRadius: "4px",
        boxShadow:
          "inset 0 0 4px 1px color-mix(in srgb, var(--hm-login-only-border) 80%, transparent)",
      };
    case "low-spend":
      return {
        background:
          "linear-gradient(135deg, var(--hm-low-spend-from) 0%, var(--hm-low-spend-to) 100%)",
        borderColor: "var(--hm-low-spend-border)",
        borderRadius: "4px",
        boxShadow:
          "0 0 6px 1px var(--hm-low-spend-glow), inset 0 0 4px 1px color-mix(in srgb, var(--hm-low-spend-border) 80%, transparent)",
      };
    case "moderate-spend":
      return {
        background:
          "linear-gradient(135deg, var(--hm-moderate-spend-from) 0%, var(--hm-moderate-spend-to) 100%)",
        borderColor: "var(--hm-moderate-spend-border)",
        borderRadius: "4px",
        boxShadow:
          "0 0 6px 1px var(--hm-moderate-spend-glow), inset 0 0 4px 1px color-mix(in srgb, var(--hm-moderate-spend-border) 80%, transparent)",
      };
    case "heavy-spend":
      return {
        background:
          "linear-gradient(135deg, var(--hm-heavy-spend-from) 0%, var(--hm-heavy-spend-to) 100%)",
        borderColor: "var(--hm-heavy-spend-border)",
        borderRadius: "4px",
        boxShadow:
          "0 0 6px 1px var(--hm-heavy-spend-glow), inset 0 0 4px 1px color-mix(in srgb, var(--hm-heavy-spend-border) 80%, transparent)",
      };
  }
};

const getCellStyle = (state: DayState): CSSProperties => {
  switch (state) {
    case "login-only":
    case "low-spend":
    case "moderate-spend":
    case "heavy-spend":
      return getActiveCellStyle(state);
    case "inactive":
      return {
        backgroundColor: "var(--hm-cell-inactive-bg)",
        borderColor: "var(--hm-cell-inactive-border)",
        borderRadius: "4px",
      };
    case "future":
    default:
      return {
        backgroundColor: "var(--hm-cell-future-bg)",
        borderColor: "var(--hm-cell-future-border)",
        borderRadius: "4px",
      };
  }
};

// Returns the CSS color value for the day-number text inside a cell.
const getDayTextColor = (state: DayState): string => {
  switch (state) {
    case "login-only":     return "var(--hm-login-only-text)";
    case "low-spend":      return "var(--hm-low-spend-text)";
    case "moderate-spend": return "var(--hm-moderate-spend-text)";
    case "heavy-spend":    return "var(--hm-heavy-spend-text)";
    case "inactive":       return "var(--hm-day-num-inactive)";
    case "future":
    default:               return "var(--hm-day-num-future)";
  }
};

// A day "has activity" if it was logged in OR had spend — used by streak/milestone logic.
const hasActivity = (
  dateStr: string,
  dailySpend: Map<string, number>,
  loginDates: Set<string>
): boolean => (dailySpend.get(dateStr) ?? 0) > 0 || loginDates.has(dateStr);

function computeCurrentStreak(
  loginDates: Set<string>,
  dailySpend: Map<string, number>,
  year: number,
  monthIndex: number,
  daysInMonth: number
): number {
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const firstOfMonth = getLocalDateString(new Date(year, monthIndex, 1));
  if (firstOfMonth > todayStr) return 0;
  const endDay =
    today.getFullYear() === year && today.getMonth() === monthIndex
      ? today.getDate()
      : daysInMonth;
  let streak = 0;
  for (let day = endDay; day >= 1; day--) {
    const dateStr = getLocalDateString(new Date(year, monthIndex, day));
    if (hasActivity(dateStr, dailySpend, loginDates)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function computeMaxStreak(
  loginDates: Set<string>,
  dailySpend: Map<string, number>,
  year: number,
  monthIndex: number,
  daysInMonth: number,
  todayString: string
): number {
  let max = 0;
  let run = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = getLocalDateString(new Date(year, monthIndex, day));
    if (dateStr > todayString) break;
    if (hasActivity(dateStr, dailySpend, loginDates)) {
      run++;
      if (run > max) max = run;
    } else {
      run = 0;
    }
  }
  return max;
}

function computeFullMonthProgress(
  loginDates: Set<string>,
  dailySpend: Map<string, number>,
  year: number,
  monthIndex: number,
  daysInMonth: number,
  todayString: string
): { activeDays: number; totalDays: number } {
  let activeDays = 0;
  let totalDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = getLocalDateString(new Date(year, monthIndex, day));
    if (dateStr > todayString) break;
    totalDays++;
    if (hasActivity(dateStr, dailySpend, loginDates)) activeDays++;
  }
  return { activeDays, totalDays };
}

// ─── SVG dot-ring progress badge ─────────────────────────────────────────────

interface DotRingBadgeProps {
  totalDots: number;
  filledDots: number;
  label: string;
  state: MilestoneState;
}

function DotRingBadge({ totalDots, filledDots, label, state }: DotRingBadgeProps) {
  const size = 48;
  const cx = 24;
  const cy = 24;
  const ringRadius = 20;
  const dotR = totalDots <= 8 ? 3.5 : totalDots <= 12 ? 2.8 : 2.2;
  const clampedFilled = Math.min(filledDots, totalDots);
  const isAchieved = state === "achieved";

  const activeColor = isAchieved ? "#F97316" : "#EAB308";
  const dimColor = "var(--hm-dim-dot)";

  const textColor = isAchieved ? "#FFFFFF" : state === "in-progress" ? "#EAB308" : "#71717A";
  const fontSize = label.length > 2 ? 9 : 12;

  const svgEl = (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: "visible", display: "block" }}
    >
      <defs>
        <radialGradient id={`fill-${label}`} cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFB347" />
          <stop offset="100%" stopColor="#E05A00" />
        </radialGradient>
      </defs>

      {/* Filled background circle when achieved */}
      {isAchieved && (
        <circle
          cx={cx}
          cy={cy}
          r={ringRadius - dotR - 2}
          fill={`url(#fill-${label})`}
          style={{
            filter:
              "drop-shadow(0 0 8px rgba(249,115,22,0.9)) drop-shadow(0 0 16px rgba(249,115,22,0.5))",
          }}
        />
      )}

      {/* Dot ring */}
      {Array.from({ length: totalDots }).map((_, i) => {
        const angle = (2 * Math.PI * i) / totalDots - Math.PI / 2;
        const x = cx + ringRadius * Math.cos(angle);
        const y = cy + ringRadius * Math.sin(angle);
        const isFilled = i < clampedFilled;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={dotR}
            style={
              isFilled
                ? {
                    fill: activeColor,
                    filter: `drop-shadow(0 0 3px ${activeColor}) drop-shadow(0 0 5px ${activeColor}90)`,
                  }
                : { fill: dimColor }
            }
          />
        );
      })}

      {/* Label */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={textColor}
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {label}
      </text>
    </svg>
  );

  if (!isAchieved) return (
    <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0">{svgEl}</div>
  );

  // Heartbeat animation wrapper when achieved
  return (
    <>
      <div
        className="w-9 h-9 sm:w-12 sm:h-12 shrink-0"
        style={{
          animation: "hb-beat 1.6s ease-in-out infinite",
          display: "inline-flex",
        }}
      >
        {svgEl}
      </div>
    </>
  );
}

function badgeStatusText(state: MilestoneState): { text: string; color: string } {
  if (state === "achieved") return { text: "Complété", color: "#F97316" };
  if (state === "in-progress") return { text: "En cours", color: "#CA8A04" };
  return { text: "En cours", color: "#52525B" };
}

// ─── Legend dot ───────────────────────────────────────────────────────────────

interface LegendDotProps {
  fromVar: string;
  toVar: string;
}
function LegendDot({ fromVar, toVar }: LegendDotProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "2px",
        background: `linear-gradient(135deg, var(${fromVar}) 0%, var(${toVar}) 100%)`,
        flexShrink: 0,
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarHeatmap({
  month,
  dailySpend,
  perEnvelopeSpendPerDay,
  loginDates,
  monthlyBudget,
  loading = false,
  title = "Votre Parcours Fidélité",
  className = "",
  embedded = false,
}: CalendarHeatmapProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const todayString = getLocalDateString(new Date());
  const columns = Math.ceil(daysInMonth / 3);
  const maxGridWidth = columns * 22 + (columns - 1) * 4;

  const currentStreak = computeCurrentStreak(
    loginDates, dailySpend, year, monthIndex, daysInMonth
  );
  const maxStreak = computeMaxStreak(
    loginDates, dailySpend, year, monthIndex, daysInMonth, todayString
  );
  const { activeDays, totalDays } = computeFullMonthProgress(
    loginDates, dailySpend, year, monthIndex, daysInMonth, todayString
  );

  // ── Milestone states ──────────────────────────────────────────────────────

  // Série 1: 7 consecutive days
  const s1Achieved = maxStreak >= 7;
  const s1State: MilestoneState = s1Achieved
    ? "achieved"
    : currentStreak > 0
      ? "in-progress"
      : "next";
  const s1Filled = s1Achieved ? 7 : Math.min(currentStreak, 7);

  // Série 2: 14 consecutive days
  const s2Achieved = maxStreak >= 14;
  const s2State: MilestoneState = s2Achieved
    ? "achieved"
    : maxStreak > 0
      ? "in-progress"
      : "next";
  const s2Filled = s2Achieved ? 14 : Math.min(maxStreak, 14);

  // Mois Complet: every day of the full month must have activity
  const monthAchieved = totalDays === daysInMonth && activeDays === daysInMonth;
  const monthState: MilestoneState = monthAchieved
    ? "achieved"
    : activeDays > 0
      ? "in-progress"
      : "next";
  const monthTotalDots = 10;
  const monthFilled = monthAchieved
    ? monthTotalDots
    : Math.round((activeDays / daysInMonth) * monthTotalDots);

  const Outer = embedded ? "div" : "section";
  const outerProps = embedded
    ? { className }
    : {
        className: `hm-section border border-app-border rounded-[20px] overflow-hidden ${className}`,
        style: { background: "var(--hm-section-bg)", padding: "16px" } as CSSProperties,
      };

  const cells: DayCell[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = getLocalDateString(new Date(year, monthIndex, day));
    cells.push({ dateStr, day });
  }

  if (loading) {
    return (
      <Outer {...outerProps}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-44 rounded-md bg-black/5 dark:bg-white/5" />
          <div className="h-2.5 w-56 rounded-md bg-black/5 dark:bg-white/5" />
          <div className="flex flex-row gap-4 items-center justify-center">
            <div
              style={{
                maxWidth: `${maxGridWidth}px`,
                width: "100%",
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: "4px",
              }}
            >
              {Array.from({ length: daysInMonth }).map((_, i) => (
                <div key={i} className="w-full aspect-square rounded-md bg-black/5 dark:bg-white/5" />
              ))}
            </div>
            <div className="shrink-0 flex flex-col gap-3 pl-4 border-l border-app-border">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-14 rounded bg-black/5 dark:bg-white/5" />
                    <div className="h-2 w-16 rounded bg-black/5 dark:bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Outer>
    );
  }

  return (
    <Outer {...outerProps}>
      {/* Main row: two equal halves, each centered */}
      <div className="flex flex-row items-center w-full">

        {/* Left half: grid + legend centered */}
        <div className="flex-1 flex flex-col items-center gap-2 pr-3 sm:pr-4">
          {/* Heatmap grid */}
          <div
            style={{
              maxWidth: `${maxGridWidth}px`,
              width: "100%",
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: "4px",
            }}
          >
            {cells.map((cell) => {
              const state = getCellState(
                cell.dateStr,
                todayString,
                dailySpend,
                loginDates,
                monthlyBudget,
                perEnvelopeSpendPerDay
              );
              return (
                <div
                  key={cell.dateStr}
                  className="w-full aspect-square rounded-md border relative"
                  style={getCellStyle(state)}
                  title={cell.dateStr}
                >
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "7px",
                      fontWeight: 500,
                      lineHeight: 1,
                      color: getDayTextColor(state),
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                  >
                    {cell.day}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend — semantic states in French */}
          <div className="flex items-center gap-2 flex-wrap text-[10px] self-start">
            <span className="flex items-center gap-1" style={{ whiteSpace: "nowrap" }}>
              <LegendDot fromVar="--hm-login-only-from" toVar="--hm-login-only-to" />
              <span className="text-app-text-secondary">Connexion</span>
            </span>
            <span className="text-app-text-secondary">·</span>
            <span className="flex items-center gap-1" style={{ whiteSpace: "nowrap" }}>
              <LegendDot fromVar="--hm-low-spend-from" toVar="--hm-low-spend-to" />
              <span className="text-app-text-secondary">Faible dépense</span>
            </span>
            <span className="text-app-text-secondary">·</span>
            <span className="flex items-center gap-1" style={{ whiteSpace: "nowrap" }}>
              <LegendDot fromVar="--hm-moderate-spend-from" toVar="--hm-moderate-spend-to" />
              <span className="text-app-text-secondary">Dépense modérée</span>
            </span>
            <span className="text-app-text-secondary">·</span>
            <span className="flex items-center gap-1" style={{ whiteSpace: "nowrap" }}>
              <LegendDot fromVar="--hm-heavy-spend-from" toVar="--hm-heavy-spend-to" />
              <span className="text-app-text-secondary">Forte dépense</span>
            </span>
          </div>
        </div>

        {/* Badge panel — right half, centered between separator and edge */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5 border-l border-app-border">
          <div className="flex flex-col gap-2.5 w-fit">

            {/* Série 1 — 7 jours */}
            <div className="flex items-center gap-2">
              <DotRingBadge totalDots={7} filledDots={s1Filled} label="7" state={s1State} />
              <div>
                <p className="text-xs font-semibold text-app-text leading-tight">7 jours</p>
                <p
                  className="text-[10px] leading-tight mt-0.5 font-medium"
                  style={{ color: badgeStatusText(s1State).color }}
                >
                  {badgeStatusText(s1State).text}
                </p>
              </div>
            </div>

            {/* Série 2 — 14 jours */}
            <div className="flex items-center gap-2">
              <DotRingBadge totalDots={14} filledDots={s2Filled} label="14" state={s2State} />
              <div>
                <p className="text-xs font-semibold text-app-text leading-tight">14 jours</p>
                <p
                  className="text-[10px] leading-tight mt-0.5 font-medium"
                  style={{ color: badgeStatusText(s2State).color }}
                >
                  {badgeStatusText(s2State).text}
                </p>
              </div>
            </div>

            {/* Mois Complet */}
            <div className="flex items-center gap-2">
              <DotRingBadge
                totalDots={monthTotalDots}
                filledDots={monthFilled}
                label="♛"
                state={monthState}
              />
              <div>
                <p className="text-xs font-semibold text-app-text leading-tight">Mois Complet</p>
                <p
                  className="text-[10px] leading-tight mt-0.5 font-medium"
                  style={{ color: badgeStatusText(monthState).color }}
                >
                  {badgeStatusText(monthState).text}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Outer>
  );
}
