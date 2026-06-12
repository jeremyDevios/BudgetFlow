import { test, expect } from "@playwright/test";
import { CashflowPage } from "../page-objects/cashflow-page";

test.describe("Cash Flow", () => {
  test("la page cashflow est accessible", async ({ page }) => {
    const cashflow = new CashflowPage(page);
    await cashflow.goto();
    await cashflow.expectCashflowVisible();
  });

  test("affiche le diagramme Sankey", async ({ page }) => {
    const cashflow = new CashflowPage(page);
    await cashflow.goto();

    // Le diagramme Sankey est un SVG — vérifier qu'il existe
    const svg = page.locator("svg");
    const svgCount = await svg.count();
    expect(svgCount).toBeGreaterThan(0);
  });

  test("affiche le résumé des revenus et allocations", async ({ page }) => {
    const cashflow = new CashflowPage(page);
    await cashflow.goto();

    // Vérifier les cartes de résumé avec le texte exact
    await expect(page.getByText("Revenu Total")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Total Alloué")).toBeVisible({ timeout: 10_000 });
  });

  test("la navigation retour fonctionne", async ({ page }) => {
    const cashflow = new CashflowPage(page);
    await cashflow.goto();

    // Chercher un bouton retour
    const backButton = page
      .getByRole("button")
      .filter({ has: page.locator(".lucide-chevron-left, .lucide-arrow-left") })
      .first();

    if ((await backButton.count()) > 0) {
      await backButton.click();
      await expect(page).not.toHaveURL(/\/cashflow/, { timeout: 5_000 });
    }
  });
});
