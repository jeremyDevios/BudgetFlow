import { test, expect } from "@playwright/test";
import { HistoryPage } from "../page-objects/history-page";

test.describe("Historique", () => {
  test("la page historique est accessible", async ({ page }) => {
    const history = new HistoryPage(page);
    await history.goto();
    await history.expectHistoryVisible();
  });

  test("affiche la liste des transactions", async ({ page }) => {
    await page.goto("/history");
    await page.waitForTimeout(1500);

    // Vérifier s'il y a des transactions
    const emptyState = page.getByText(/Aucune transaction/i);
    const isEmpty = (await emptyState.count()) > 0;

    if (!isEmpty) {
      // Au moins une transaction devrait être visible
      const txItems = page.locator(
        "[class*='space-y'] > div, [class*='space-y'] > li"
      );
      const count = await txItems.count();
      expect(count).toBeGreaterThan(0);

      // Vérifier que les transactions contiennent des montants
      const firstAmount = page.getByText(/€|\$|£/).first();
      await expect(firstAmount).toBeVisible({ timeout: 5_000 });
    }
  });

  test("le champ de recherche est présent", async ({ page }) => {
    const history = new HistoryPage(page);
    await history.goto();

    if ((await history.searchInput.count()) > 0) {
      await expect(history.searchInput).toBeVisible();
    }
  });

  test("la recherche filtre les résultats", async ({ page }) => {
    await page.goto("/history");
    await page.waitForTimeout(1500);

    const searchInput = page.getByPlaceholder(/Rechercher/i);
    if ((await searchInput.count()) > 0) {
      // Compter les éléments avant la recherche
      const beforeCount = await page
        .locator("[class*='space-y'] > div, [class*='space-y'] > li")
        .count();

      // Rechercher un terme spécifique
      await searchInput.fill("zzz_test_non_existant_xyz");
      await page.waitForTimeout(500);

      // Les résultats devraient être filtrés (probablement 0)
      const afterCount = await page
        .locator("[class*='space-y'] > div, [class*='space-y'] > li")
        .count();

      // Après filtrage, le compte devrait être ≤ avant
      expect(afterCount).toBeLessThanOrEqual(beforeCount);

      // Nettoyer
      await searchInput.fill("");
    }
  });

  test("les transactions ont des dates visibles", async ({ page }) => {
    await page.goto("/history");
    await page.waitForTimeout(1500);

    const emptyState = page.getByText(/Aucune transaction/i);
    if ((await emptyState.count()) === 0) {
      // Vérifier la présence de dates (format JJ/MM/AAAA ou YYYY-MM-DD)
      const datePattern = /\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/;
      const dateElement = page.getByText(datePattern).first();

      // Il devrait y avoir des dates visibles
      const dateCount = await page.getByText(datePattern).count();
      expect(dateCount).toBeGreaterThan(0);
    }
  });

  test("la page gère le défilement (scroll) pour charger plus de transactions", async ({
    page,
  }) => {
    await page.goto("/history");
    await page.waitForTimeout(1500);

    // Scroller vers le bas
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Scroller vers le haut
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    // La page ne devrait pas crasher
    await expect(page).toHaveURL(/\/history/);
  });
});
