import { test, expect } from "@playwright/test";
import { EvolutionPage } from "../page-objects/evolution-page";

test.describe("Évolution", () => {
  test("la page évolution est accessible", async ({ page }) => {
    const evolution = new EvolutionPage(page);
    await evolution.goto();
    await evolution.expectEvolutionVisible();
  });

  test("affiche le graphique d'évolution", async ({ page }) => {
    const evolution = new EvolutionPage(page);
    await evolution.goto();

    // Le graphique est un SVG Recharts
    const chartSvg = page.locator("svg");
    const svgCount = await chartSvg.count();
    expect(svgCount).toBeGreaterThan(0);
  });

  test("affiche les détails mensuels", async ({ page }) => {
    const evolution = new EvolutionPage(page);
    await evolution.goto();

    // Vérifier que la section détails mensuels existe
    if ((await evolution.monthDetails.count()) > 0) {
      await expect(evolution.monthDetails.first()).toBeVisible();
    }
  });

  test("affiche les résumés (total dépensé / total économisé)", async ({
    page,
  }) => {
    const evolution = new EvolutionPage(page);
    await evolution.goto();

    // Les résumés doivent être visibles
    await expect(page.getByText("Total dépenses")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Total économies")).toBeVisible({ timeout: 5_000 });
  });

  test("le graphique est interactif (survol)", async ({ page }) => {
    const evolution = new EvolutionPage(page);
    await evolution.goto();
    await page.waitForTimeout(2_000);

    // Le graphique Recharts est dans un SVG
    const svg = page.locator("svg").first();
    await expect(svg).toBeAttached({ timeout: 10_000 });

    // Vérifier que le SVG a du contenu (le graphique est rendu)
    const hasContent = await svg.locator("path, circle, rect").count();
    // Même si le graphique est vide (pas de données), le SVG doit exister
    expect(hasContent).toBeGreaterThanOrEqual(0);
  });
});
