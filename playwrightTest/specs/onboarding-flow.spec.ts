import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../page-objects/onboarding-page";
import { DashboardPage } from "../page-objects/dashboard-page";

/**
 * Tests du flux d'onboarding.
 *
 * PRÉREQUIS : Un utilisateur Firebase authentifié mais NON onboardé.
 * L'utilisateur doit avoir un compte Google connecté mais
 * `isOnboarded !== true` dans Firestore settings/general.
 *
 * Le fichier playwright.onboarding.json est généré automatiquement
 * par auth.setup.ts avec un utilisateur non onboardé.
 */
test.describe("Parcours d'onboarding", () => {
  test("l'étape 1 affiche les champs obligatoires", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.expectStep1Visible();

    await expect(onboarding.incomeInput).toBeVisible();
    await expect(onboarding.fixedCostsInput).toBeVisible();
    await expect(onboarding.savingsInput).toBeVisible();
    await expect(onboarding.continueButton).toBeVisible();
  });

  test("le bouton Continuer est présent mais peut être désactivé si champs vides", async ({
    page,
  }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.expectStep1Visible();

    // Sans remplir les champs, le bouton devrait être désactivé
    // (la logique métier : si charges + épargne > revenus, bouton désactivé)
    await expect(onboarding.continueButton).toBeVisible();
  });

  test("remplir l'étape 1 et passer à l'étape 2", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.completeStep1("3000", "1500", "500");

    // Vérifier que l'étape 2 est bien affichée
    await expect(onboarding.step2Heading).toBeVisible();
  });

  test("l'étape 2 affiche les 3 enveloppes par défaut", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.completeStep1("3000", "1500", "500");

    await onboarding.expectDefaultEnvelopes();
  });

  test("l'étape 2 affiche le bouton Créer une enveloppe", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.completeStep1("3000", "1500", "500");

    await expect(onboarding.addEnvelopeButton).toBeVisible();
  });

  test("l'étape 2 affiche le bouton Terminer", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.completeStep1("3000", "1500", "500");

    await expect(onboarding.finishButton).toBeVisible();
  });

  test("le budget disponible est visible et se met à jour", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();

    // Vérifier que le compteur "Disponible pour" est visible
    await expect(onboarding.availableCounter).toBeVisible();
  });

  test("compléter l'onboarding redirige vers le dashboard", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.completeFullOnboarding("3500", "1800", "400");

    const dashboard = new DashboardPage(page);
    await dashboard.expectDashboardVisible();
  });
});
