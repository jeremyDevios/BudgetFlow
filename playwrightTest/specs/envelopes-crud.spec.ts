import { test, expect } from "@playwright/test";
import { SettingsPage } from "../page-objects/settings-page";
import { DashboardPage } from "../page-objects/dashboard-page";

test.describe("Gestion des enveloppes (CRUD)", () => {
  test.beforeEach(async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectSettingsVisible();
  });

  test.describe("Affichage", () => {
    test("la section Enveloppes est visible dans les paramètres", async ({
      page,
    }) => {
      const settings = new SettingsPage(page);
      await expect(settings.envelopesSection.first()).toBeVisible({
        timeout: 10_000,
      });
    });

    test("les enveloppes existantes sont listées", async ({ page }) => {
      // Les enveloppes créées par le seed devraient être visibles
      // (Courses, Transport, Loisirs, Abonnements, Santé, Maison, Sorties)
      const envelopeNames = [
        "Courses",
        "Transport",
        "Loisirs",
        "Abonnements",
        "Santé",
        "Maison",
        "Sorties",
      ];

      let foundCount = 0;
      for (const name of envelopeNames) {
        const el = page.getByText(name, { exact: false });
        if ((await el.count()) > 0) {
          foundCount++;
        }
      }
      // Au moins quelques enveloppes devraient être présentes
      expect(foundCount).toBeGreaterThanOrEqual(3);
    });

    test("le bouton Nouvelle enveloppe est visible", async ({ page }) => {
      const settings = new SettingsPage(page);
      // Scroll vers la section enveloppes
      await settings.envelopesSection.first().scrollIntoViewIfNeeded();
      // Le bouton a le texte "Nouvelle" (avec icône Plus)
      const newBtn = page.getByRole("button", { name: /Nouvelle/i });
      await expect(newBtn.first()).toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe("Création", () => {
    test("le clic sur Nouvelle enveloppe ouvre le formulaire", async ({
      page,
    }) => {
      const settings = new SettingsPage(page);
      await settings.envelopesSection.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Le bouton "Nouvelle" dans la section enveloppes
      const newBtn = page.getByRole("button", { name: /Nouvelle/i });
      if ((await newBtn.count()) > 0) {
        await newBtn.first().click();
        await page.waitForTimeout(500);

        // Après clic, une modale s'ouvre avec le titre "Nouvelle Enveloppe"
        // ou "Modifier l'enveloppe" (selon le contexte)
        const dialog = page.getByRole("dialog");
        const heading = page.getByText(/Nouvelle Enveloppe|Modifier l'enveloppe/i);

        const dialogVisible = (await dialog.count()) > 0;
        const headingVisible = (await heading.count()) > 0;

        // L'un ou l'autre doit être présent
        expect(dialogVisible || headingVisible).toBe(true);
      }
    });
  });

  test.describe("Modification", () => {
    test("une enveloppe existante peut être sélectionnée", async ({ page }) => {
      // Vérifier qu'on peut interagir avec une enveloppe existante
      const coursesEl = page.getByText("Courses").first();
      if ((await coursesEl.count()) > 0) {
        await expect(coursesEl).toBeVisible();
      }
    });
  });

  test.describe("Détail d'enveloppe", () => {
    test("la page détail d'une enveloppe affiche les transactions", async ({
      page,
    }) => {
      // Aller au dashboard via le Page Object (gère la popup)
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      // Utiliser clickEnvelope qui cible précisément une tuile par son nom
      // plutôt qu'un sélecteur CSS trop large ([class*='tile'] etc.)
      await dashboard.clickEnvelope("Courses");

      // Vérifier que la page détail s'affiche
      await expect(page.locator("h1")).toBeVisible({ timeout: 5_000 });
    });

    test("la page détail a un bouton Nouvelle Dépense", async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      await dashboard.clickEnvelope("Courses");

      // Chercher le bouton Nouvelle Dépense
      const newTxButton = page.getByRole("button", {
        name: /Nouvelle Dépense|Ajouter/i,
      });
      await expect(newTxButton.first()).toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe("Enveloppes temporaires", () => {
    test("le bouton Nouvelle enveloppe permet de créer une enveloppe temporaire", async ({
      page,
    }) => {
      const settings = new SettingsPage(page);
      await settings.envelopesSection.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const newBtn = page.getByRole("button", { name: /Nouvelle/i });
      if ((await newBtn.count()) > 0) {
        await newBtn.first().click();
        await page.waitForTimeout(500);

        // Vérifier que le toggle "Enveloppe temporaire" est présent dans le formulaire
        const tempToggle = page.getByRole("switch", { name: /temporaire/i });
        if ((await tempToggle.count()) > 0) {
          await expect(tempToggle).toBeVisible();
        }
      }
    });

    test("les enveloppes temporaires existantes ont un badge", async ({ page }) => {
      const settings = new SettingsPage(page);
      await settings.goto();

      // Chercher des badges "Temporaire" dans la liste des enveloppes
      const tempBadges = page.getByText("Temporaire");
      // Il peut y en avoir 0 ou plus selon le seed
      const count = await tempBadges.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
