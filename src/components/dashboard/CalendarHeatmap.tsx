type DayState = "transaction" | "login-only" | "inactive" | "future";

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

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

const getLocalDateString = (date: Date) => {
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

const getCellStyle = (state: DayState) => {
  if (state === "transaction") {
    return { backgroundColor: "var(--color-accent)", borderColor: "var(--color-accent)" };
  }

  if (state === "login-only") {
    return {
      backgroundColor: "var(--color-accent-hover)",
      borderColor: "var(--color-accent-hover)",
    };
  }

  if (state === "inactive") {
    return { backgroundColor: "var(--color-border)", borderColor: "var(--color-border)" };
  }

  return { backgroundColor: "transparent", borderColor: "var(--color-border)" };
};

export default function CalendarHeatmap({
  month,
  transactionDates,
  loginDates,
  loading = false,
  title = "Activité du mois",
  className = "",
}: CalendarHeatmapProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const todayString = getLocalDateString(new Date());

  const cells: Array<DayCell | null> = [];

  for (let i = 0; i < firstDayOfWeek; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = getLocalDateString(new Date(year, monthIndex, day));
    cells.push({ dateStr, day });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const rows: Array<Array<DayCell | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  if (loading) {
    return (
      <section className={`bg-app-surface border border-app-border rounded-2xl p-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-36 rounded bg-app-bg/60" />
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 42 }).map((_, index) => (
              <div key={index} className="aspect-square rounded-lg bg-app-bg/60" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`bg-app-surface border border-app-border rounded-2xl p-4 ${className}`}>
      <h3 className="text-lg font-bold text-app-text mb-4">{title}</h3>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEK_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="text-center text-xs font-medium text-app-text-secondary"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-7 gap-1.5">
            {row.map((cell, cellIndex) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${rowIndex}-${cellIndex}`}
                    className="aspect-square rounded-lg border border-transparent"
                  />
                );
              }

              const state = getCellState(
                cell.dateStr,
                todayString,
                transactionDates,
                loginDates
              );

              return (
                <div
                  key={cell.dateStr}
                  className="aspect-square rounded-lg border flex items-center justify-center"
                  style={getCellStyle(state)}
                  title={cell.dateStr}
                >
                  <span
                    className={`text-[10px] sm:text-xs font-medium ${
                      state === "future" ? "text-app-text-secondary" : "text-app-text"
                    }`}
                  >
                    {cell.day}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-app-text-secondary">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-app-border">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--color-accent)" }} />
          Dépense
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-app-border">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: "var(--color-accent-hover)" }}
          />
          Connecté
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-app-border">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--color-border)" }} />
          Inactif
        </span>
      </div>
    </section>
  );
}
