"use client";

import type { CSSProperties } from "react";

type DayState = "transaction" | "login-only" | "inactive" | "future";
type MilestoneState = "achieved" | "in-progress" | "next";

interface CalendarHeatmapProps {
  month: Date;
  transactionDates: Set<string>;
  loginDates: Set<string>;
  loading?: boolean;
  title?: string;
  className?: string;
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
  transactionDates: Set<string>,
  loginDates: Set<string>
): DayState => {
  if (dateStr > todayString) return "future";
  if (transactionDates.has(dateStr)) return "transaction";
  if (loginDates.has(dateStr)) return "login-only";
  return "inactive";
};

const getCellStyle = (state: DayState): CSSProperties => {
  switch (state) {
    case "transaction":
      return {
        background: "linear-gradient(135deg, #FB923C 0%, #EA580C 100%)",
        borderColor: "transparent",
        boxShadow: "0 0 7px 2px rgba(249,115,22,0.55), inset 0 1px 0 rgba(255,255,255,0.15)",
      };
    case "login-only":
      return {
        background: "linear-gradient(135deg, #FDE047 0%, #CA8A04 100%)",
        borderColor: "transparent",
        boxShadow: "0 0 6px 2px rgba(234,179,8,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
      };
    case "inactive":
      return {
        backgroundColor: "#27272A",
        borderColor: "#3F3F46",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      };
    case "future":
    default:
      return {
        backgroundColor: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.06)",
      };
  }
};

function computeCurrentStreak(
  loginDates: Set<string>,
  transactionDates: Set<string>,
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
    if (transactionDates.has(dateStr) || loginDates.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function computeMaxStreak(
  loginDates: Set<string>,
  transactionDates: Set<string>,
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
    if (transactionDates.has(dateStr) || loginDates.has(dateStr)) {
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
  transactionDates: Set<string>,
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
    if (transactionDates.has(dateStr) || loginDates.has(dateStr)) activeDays++;
  }
  return { activeDays, totalDays };
}

// SVG dot-ring progress badge
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
  const dimColor = "#3A3A3E";

  const textColor = isAchieved ? "#FFFFFF" : state === "in-progress" ? "#EAB308" : "#71717A";
  const fontSize = label.length > 2 ? 9 : 12;

  const svgEl = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: "visible", flexShrink: 0 }}
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
            fill={isFilled ? activeColor : dimColor}
            style={
              isFilled
                ? {
                    filter: `drop-shadow(0 0 3px ${activeColor}) drop-shadow(0 0 5px ${activeColor}90)`,
                  }
                : undefined
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

  if (!isAchieved) return svgEl;

  // Heartbeat animation wrapper when achieved
  return (
    <>
      <style>{`
        @keyframes hb-beat {
          0%   { transform: scale(1); }
          14%  { transform: scale(1.18); }
          28%  { transform: scale(1); }
          42%  { transform: scale(1.10); }
          70%  { transform: scale(1); }
          100% { transform: scale(1); }
        }
      `}</style>
      <div
        style={{
          animation: "hb-beat 1.6s ease-in-out infinite",
          flexShrink: 0,
          display: "inline-flex",
        }}
      >
        {svgEl}
      </div>
    </>
  );
}

function badgeStatusText(
  state: MilestoneState,
  sublabel: string
): { text: string; color: string } {
  if (state === "achieved") return { text: `${sublabel} · ACTIF`, color: "#F97316" };
  if (state === "in-progress") return { text: `${sublabel} · En cours`, color: "#CA8A04" };
  return { text: "Prochain défi", color: "#52525B" };
}

export default function CalendarHeatmap({
  month,
  transactionDates,
  loginDates,
  loading = false,
  title = "Votre Parcours Fidélité",
  className = "",
}: CalendarHeatmapProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const todayString = getLocalDateString(new Date());
  const columns = Math.ceil(daysInMonth / 3);
  const maxGridWidth = columns * 30 + (columns - 1) * 4;

  const currentStreak = computeCurrentStreak(
    loginDates, transactionDates, year, monthIndex, daysInMonth
  );
  const maxStreak = computeMaxStreak(
    loginDates, transactionDates, year, monthIndex, daysInMonth, todayString
  );
  const { activeDays, totalDays } = computeFullMonthProgress(
    loginDates, transactionDates, year, monthIndex, daysInMonth, todayString
  );

  // --- Milestone states ---

  // Série 1: 7 consecutive days
  const s1Achieved = maxStreak >= 7;
  const s1State: MilestoneState = s1Achieved
    ? "achieved"
    : currentStreak > 0
      ? "in-progress"
      : "next";
  // Progress: current active streak toward 7 (capped at 7 when achieved)
  const s1Filled = s1Achieved ? 7 : Math.min(currentStreak, 7);

  // Série 2: 14 consecutive days
  const s2Achieved = maxStreak >= 14;
  const s2State: MilestoneState = s2Achieved
    ? "achieved"
    : maxStreak > 0
      ? "in-progress"
      : "next";
  // Progress: best streak so far toward 14
  const s2Filled = s2Achieved ? 14 : Math.min(maxStreak, 14);

  // Mois Complet: EVERY day of the full month must have activity.
  // Only achieved when the month is over (totalDays === daysInMonth) AND all days active.
  const monthAchieved = totalDays === daysInMonth && activeDays === daysInMonth;
  const monthState: MilestoneState = monthAchieved
    ? "achieved"
    : activeDays > 0
      ? "in-progress"
      : "next";
  // Progress: 10 dots, normalized to full month length
  const monthTotalDots = 10;
  const monthFilled = monthAchieved
    ? monthTotalDots
    : Math.round((activeDays / daysInMonth) * monthTotalDots);

  const cells: DayCell[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = getLocalDateString(new Date(year, monthIndex, day));
    cells.push({ dateStr, day });
  }

  if (loading) {
    return (
      <section
        className={`border border-[#3F3F46] rounded-[20px] overflow-hidden ${className}`}
        style={{ background: "#1C1C1E", padding: "16px" }}
      >
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-44 rounded-md bg-white/5" />
          <div className="h-2.5 w-56 rounded-md bg-white/5" />
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
                <div key={i} className="w-full aspect-square rounded-md bg-white/5" />
              ))}
            </div>
            <div className="shrink-0 flex flex-col gap-3 pl-4 border-l border-[#3F3F46]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-12 h-12 rounded-full bg-white/5 shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-14 rounded bg-white/5" />
                    <div className="h-2 w-16 rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`border border-[#3F3F46] rounded-[20px] overflow-hidden ${className}`}
      style={{
        background:
          "radial-gradient(ellipse at 20% 60%, rgba(249,115,22,0.09) 0%, #1C1C1E 65%)",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.4)",
        padding: "16px",
      }}
    >
      {/* Title */}
      <h3 className="text-sm font-bold text-white tracking-tight mb-1">{title}</h3>

      {/* Legend */}
      <div className="flex items-center gap-1 mb-3 flex-wrap text-[10px]">
        <span className="text-zinc-500 mr-0.5">Légende :</span>
        <span className="text-[#F97316] font-semibold">Orange</span>
        <span className="text-zinc-600"> : Saisie de dépense</span>
        <span className="text-zinc-600 mx-1">·</span>
        <span className="text-[#EAB308] font-semibold">Jaune</span>
        <span className="text-zinc-600"> : Connexion seulement</span>
      </div>

      {/* Main row: grid left, badges right */}
      <div className="flex flex-row gap-4 items-center justify-center">

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
              transactionDates,
              loginDates
            );
            return (
              <div
                key={cell.dateStr}
                className="w-full aspect-square rounded-md border"
                style={getCellStyle(state)}
                title={cell.dateStr}
              />
            );
          })}
        </div>

        {/* Badge panel */}
        <div className="shrink-0 flex flex-col gap-1.5 pl-3 sm:pl-4 border-l border-[#3F3F46]">

          {/* Série 1 — 7 jours */}
          <div className="flex items-center gap-2">
            <DotRingBadge totalDots={7} filledDots={s1Filled} label="7" state={s1State} />
            <div>
              <p className="text-xs font-semibold text-white leading-tight">Série 1</p>
              <p
                className="text-[10px] leading-tight mt-0.5 font-medium"
                style={{ color: badgeStatusText(s1State, "Semaine").color }}
              >
                {badgeStatusText(s1State, "Semaine").text}
              </p>
            </div>
          </div>

          {/* Série 2 — 14 jours */}
          <div className="flex items-center gap-2">
            <DotRingBadge totalDots={14} filledDots={s2Filled} label="14" state={s2State} />
            <div>
              <p className="text-xs font-semibold text-white leading-tight">Série 2</p>
              <p
                className="text-[10px] leading-tight mt-0.5 font-medium"
                style={{ color: badgeStatusText(s2State, "Semaines").color }}
              >
                {badgeStatusText(s2State, "Semaines").text}
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
              <p className="text-xs font-semibold text-white leading-tight">Mois Complet</p>
              <p
                className="text-[10px] leading-tight mt-0.5 font-medium"
                style={{ color: badgeStatusText(monthState, "Mois").color }}
              >
                {badgeStatusText(monthState, "Mois").text}
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
