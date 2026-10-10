import { render } from "@testing-library/react";

import CalendarHeatmap from "@/components/dashboard/CalendarHeatmap";

// Récupère les cellules de la grille (div portant un title "YYYY-MM-DD").
function extractDayCells(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>("div[title]"))
    .map((el) => el.getAttribute("title") ?? "")
    .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t));
}

describe("CalendarHeatmap — mois budgétaire personnalisé", () => {
  // Septembre 2026 : surcharge à 5 ; tous les autres mois : jour 2.
  const customMonthConfig = {
    enabled: true,
    startDay: 2,
    overrides: { "2026-09": 5 },
  };

  it("la grille démarre le 5 septembre et finit le 2 octobre (inclus)", () => {
    const { container } = render(
      <CalendarHeatmap
        month={new Date(2026, 8, 25)} // ancre dans la période 2026-09
        dailySpend={new Map()}
        loginDates={new Set()}
        monthlyBudget={100}
        embedded
        customMonthConfig={customMonthConfig}
      />
    );

    const cells = extractDayCells(container);
    // 5→30 sept. (26 jours) + 1er→2 oct. (2 jours) = 28 cellules.
    expect(cells).toHaveLength(28);
    expect(cells[0]).toBe("2026-09-05");
    expect(cells[cells.length - 1]).toBe("2026-10-02");
    // Les jours calendaires avant le jour de paie n'apparaissent pas.
    expect(cells).not.toContain("2026-09-04");
  });

  it("octobre 2026 : la grille démarre le 2 octobre (jour global)", () => {
    const { container } = render(
      <CalendarHeatmap
        month={new Date(2026, 9, 15)}
        dailySpend={new Map()}
        loginDates={new Set()}
        monthlyBudget={100}
        embedded
        customMonthConfig={customMonthConfig}
      />
    );

    const cells = extractDayCells(container);
    // 2 oct. → 2 nov. inclus = 32 jours (octobre a 31 jours).
    expect(cells).toHaveLength(32);
    expect(cells[0]).toBe("2026-10-02");
    expect(cells[cells.length - 1]).toBe("2026-11-02");
  });

  it("identité : sans option, la grille reste le mois calendaire complet", () => {
    const { container } = render(
      <CalendarHeatmap
        month={new Date(2026, 1, 10)} // février 2026 (28 jours)
        dailySpend={new Map()}
        loginDates={new Set()}
        monthlyBudget={100}
        embedded
      />
    );

    const cells = extractDayCells(container);
    expect(cells).toHaveLength(28);
    expect(cells[0]).toBe("2026-02-01");
    expect(cells[cells.length - 1]).toBe("2026-02-28");
  });
});
