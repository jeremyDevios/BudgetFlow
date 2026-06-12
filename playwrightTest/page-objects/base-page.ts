import { Page, expect } from "@playwright/test";

/**
 * Classe de base pour tous les Page Objects.
 * Fournit des utilitaires communs pour la navigation et les assertions.
 */
export class BasePage {
  constructor(protected page: Page) {}

  /**
   * Attend que le chargement des données soit terminé.
   * Utilise un délai au lieu de "networkidle" car Firestore
   * fait des requêtes en continu (permissions, real-time sync).
   */
  async waitForDataLoaded(timeout = 2_000): Promise<void> {
    await this.page.waitForTimeout(timeout);
  }

  /**
   * Vérifie que le fond de l'application utilise les classes de thème.
   */
  async expectAppBackground(): Promise<void> {
    await expect(this.page.locator("body")).toHaveClass(/bg-app-bg/);
  }

  /**
   * Retourne en arrière (bouton chevron-left).
   */
  async goBack(): Promise<void> {
    const backButtons = this.page
      .getByRole("button")
      .filter({ has: this.page.locator(".lucide-chevron-left") });
    if ((await backButtons.count()) > 0) {
      await backButtons.first().click();
    }
  }

  /**
   * Attend une URL spécifique.
   */
  async waitForUrl(pattern: string | RegExp, timeout = 15_000): Promise<void> {
    await this.page.waitForURL(pattern, { timeout });
  }
}
