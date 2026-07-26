import { BasePage } from "./base-page";
import { expect } from "@playwright/test";

/**
 * Tableau de bord principal (/dashboard)
 */
export class DashboardPage extends BasePage {
  readonly heading = this.page.getByText("Mes Enveloppes");
  readonly remainingBalance = this.page.getByText(/Reste disponible|restant/i).first();
  readonly globalProgressBar = this.page.locator('[role="progressbar"]').first();
  readonly monthLabel = this.page.locator(".capitalize").first();
  readonly prevMonthButton = this.page
    .getByRole("button")
    .filter({ has: this.page.locator(".lucide-chevron-left") })
    .first();
  readonly nextMonthButton = this.page
    .getByRole("button")
    .filter({ has: this.page.locator(".lucide-chevron-right") })
    .first();
  readonly quickAddFab = this.page.getByRole("button", {
    name: /Ajouter|Nouvelle/,
  });
  readonly searchDropdown = this.page.getByLabel(/Rechercher/i);
  readonly heatmap = this.page.locator(".calendar-heatmap, [class*='heatmap']").first();

  // Navigation du header
  readonly settingsButton = this.page.getByRole("button", { name: "Paramètres" });
  readonly historyButton = this.page.getByRole("button", { name: "Historique" });
  readonly cashflowButton = this.page.getByRole("button", { name: "Cash Flow" });
  readonly evolutionButton = this.page.getByRole("button", { name: "Évolution" });
  readonly logoutButton = this.page.getByRole("button", { name: "Se déconnecter" });

  // Enveloppes
  readonly envelopeTiles = this.page.locator("[class*='bento'], [class*='envelope-card'], [class*='tile']").filter({ has: this.page.locator("h3, h4") });
  readonly envelopeNames = this.page.locator("h3, h4").filter({ hasText: /.+/ });

  async goto(): Promise<void> {
    await this.page.goto("/dashboard");
    await this.waitForDataLoaded(2_000);
    // Fermer les popups/overlays qui pourraient bloquer les interactions
    await this.dismissPopupIfPresent();
  }

  /**
   * Ferme les popups qui peuvent apparaître au premier chargement.
   */
  async dismissPopupIfPresent(): Promise<void> {
    await this.page.waitForTimeout(500);

    // Essayer Escape d'abord (ferme la plupart des modales)
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(300);

    // Popup "Activer les notifications quotidiennes ?"
    for (const label of ["Plus tard", "Non merci", "Fermer", "Annuler"]) {
      const btn = this.page.getByRole("button", { name: new RegExp(label, "i") });
      if ((await btn.count()) > 0) {
        await btn.first().click().catch(() => {});
        await this.page.waitForTimeout(300);
      }
    }

    // Si un overlay est toujours présent, cliquer à l'extérieur
    const overlay = this.page.locator(".fixed.inset-0.z-50, .fixed.inset-0.z-40").first();
    if ((await overlay.count()) > 0) {
      await overlay.click({ position: { x: 10, y: 10 }, force: true }).catch(() => {});
      await this.page.waitForTimeout(300);
    }

    // Dernier recours : press Escape à nouveau
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(300);
  }

  async expectDashboardVisible(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async getEnvelopeNames(): Promise<string[]> {
    // Récupère les noms des enveloppes depuis les tuiles
    const tiles = this.page.locator("[class*='bento'], [class*='envelope-card'], [class*='tile']");
    const names: string[] = [];
    const count = await tiles.count();
    for (let i = 0; i < count; i++) {
      const heading = tiles.nth(i).locator("h3, h4");
      if ((await heading.count()) > 0) {
        const text = await heading.first().textContent();
        if (text) names.push(text.trim());
      }
    }
    return names;
  }

  async navigateToMonth(offset: number): Promise<void> {
    const button = offset > 0 ? this.nextMonthButton : this.prevMonthButton;
    for (let i = 0; i < Math.abs(offset); i++) {
      await button.click();
      await this.page.waitForTimeout(500);
    }
    await this.waitForDataLoaded();
  }

  async openQuickAddModal(): Promise<void> {
    // Le FAB a une animation pulse (animate-fab-pulse) qui le rend
    // "unstable" pour Playwright. On force le clic.
    await this.quickAddFab.click({ force: true });
  }

  async openEnvelopeOptions(envelopeName: string): Promise<void> {
    // Localiser la tuile de l'enveloppe et ouvrir son menu contextuel
    const tile = this.page.locator("[class*='bento'], [class*='envelope-card'], [class*='tile']").filter({ hasText: envelopeName }).first();
    // Le bouton d'options (trois points) dans la tuile
    const optionsButton = tile.locator("button").last();
    if ((await optionsButton.count()) > 0) {
      await optionsButton.click();
    }
  }

  async clickEnvelope(envelopeName: string): Promise<void> {
    // Cibler la tuile bento-tile puis cliquer sur son titre (h4).
    // On évite de cliquer au centre de la tuile car les boutons
    // d'options/grip/resize avec stopPropagation peuvent intercepter le clic.
    const tile = this.page.locator(".bento-tile").filter({ hasText: envelopeName }).first();
    const heading = tile.locator("h4").first();
    await heading.click();
    await this.page.waitForURL(/\/envelopes\//, { timeout: 10_000 });
    await this.waitForDataLoaded();
  }

  async getRemainingBalance(): Promise<string> {
    return (await this.remainingBalance.textContent()) || "";
  }

  async expectEnvelopeCount(minCount: number): Promise<void> {
    const count = await this.envelopeTiles.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }
}
