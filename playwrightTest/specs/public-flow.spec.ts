import { test, expect } from "@playwright/test";
import { LandingPage } from "../page-objects/landing-page";
import { LoginPage } from "../page-objects/login-page";

test.describe("Parcours public (non authentifié)", () => {
  test("la page d'accueil affiche le lien Commencer", async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.expectLandingVisible();
  });

  test("la page d'accueil contient le nom de l'application", async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.expectMarketingContent();
  });

  test('le lien "Commencer" redirige vers /login', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.clickCommencer();

    const login = new LoginPage(page);
    await login.expectLoginVisible();
  });

  test("la page /login est accessible directement", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.expectLoginVisible();
  });

  test("la page /login affiche le bouton Google", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.googleButton).toBeVisible();
    await expect(login.googleButton).toBeEnabled();
  });

  test("les routes protégées redirigent vers /login", async ({ page }) => {
    const protectedRoutes = [
      "/dashboard",
      "/settings",
      "/cashflow",
      "/evolution",
      "/history",
      "/onboarding",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("la page login a le bon titre dans l'onglet", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/BudgetFlow|Budget|Flow/i);
  });
});
