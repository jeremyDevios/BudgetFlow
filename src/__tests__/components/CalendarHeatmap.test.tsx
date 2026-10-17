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

  it("la grille démarre le 5 septembre et finit le 1er octobre (veille du jour de paie suivant)", () => {
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
    // 5→30 sept. (26 jours) + 1er oct. (1 jour) = 27 cellules.
    expect(cells).toHaveLength(27);
    expect(cells[0]).toBe("2026-09-05");
    expect(cells[cells.length - 1]).toBe("2026-10-01");
    // Les jours calendaires avant le jour de paie n'apparaissent pas…
    expect(cells).not.toContain("2026-09-04");
    // …et le début de la période suivante est exclu (il ouvre la grille d'octobre).
    expect(cells).not.toContain("2026-10-02");
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
    // 2 oct. → 1er nov. = 31 jours (octobre a 31 jours).
    expect(cells).toHaveLength(31);
    expect(cells[0]).toBe("2026-10-02");
    expect(cells[cells.length - 1]).toBe("2026-11-01");
  });

  it("option désactivée avec jour de paie résiduel : identité calendaire", () => {
    // Régression : l'option décochée conservait le jour 5 stocké et découpait
    // quand même les périodes du 5 au 4.
    const { container } = render(
      <CalendarHeatmap
        month={new Date(2026, 8, 25)}
        dailySpend={new Map()}
        loginDates={new Set()}
        monthlyBudget={100}
        embedded
        customMonthConfig={{ enabled: false, startDay: 5, overrides: {} }}
      />
    );

    const cells = extractDayCells(container);
    expect(cells).toHaveLength(30); // septembre complet
    expect(cells[0]).toBe("2026-09-01");
    expect(cells[cells.length - 1]).toBe("2026-09-30");
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
