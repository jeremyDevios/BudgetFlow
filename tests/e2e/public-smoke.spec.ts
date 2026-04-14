import { expect, test } from "@playwright/test";

test.describe("parcours public", () => {
  test("affiche la page d'accueil puis la page de connexion", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Commencer" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "Commencer" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "BudgetFlow" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter avec Google" })).toBeVisible();
  });
});
