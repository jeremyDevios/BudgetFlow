import { BasePage } from "./base-page";
import { expect } from "@playwright/test";

/**
 * Page d'accueil (landing page : /)
 */
export class LandingPage extends BasePage {
  readonly commencerLink = this.page.getByRole("link", { name: "Commencer" });
  readonly heading = this.page.locator("h1");
  readonly subheading = this.page.locator("h2").first();

  async goto(): Promise<void> {
    await this.page.goto("/", { waitUntil: "networkidle" });
    // Attendre que le lien "Commencer" soit visible = la page a fini de render
    await this.commencerLink.waitFor({ state: "visible", timeout: 15_000 });
  }

  async expectLandingVisible(): Promise<void> {
    await expect(this.commencerLink).toBeVisible({ timeout: 15_000 });
    await expect(this.heading).toBeVisible();
  }

  async clickCommencer(): Promise<void> {
    await this.commencerLink.click();
    await this.page.waitForURL(/\/login$/);
  }

  /**
   * Vérifie que la landing page contient les éléments marketing attendus.
   */
  async expectMarketingContent(): Promise<void> {
    // La landing page a un titre avec le nom de l'app
    await expect(this.heading).toContainText(/Budget|Flow/i);
    // Le bouton CTA est présent
    await expect(this.commencerLink).toBeVisible();
  }
}
