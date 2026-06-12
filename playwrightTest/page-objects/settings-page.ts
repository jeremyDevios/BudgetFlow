import { BasePage } from "./base-page";
import { expect } from "@playwright/test";

/**
 * Page des paramètres (/settings)
 */
export class SettingsPage extends BasePage {
  readonly heading = this.page.getByRole("heading", { name: /Paramètres|Settings/i });

  // Sections
  readonly profileSection = this.page.getByText(/Profil/i);
  readonly appearanceSection = this.page.getByText(/Apparence/i);
  readonly currencySection = this.page.getByText(/Monnaie|Devise/i);
  readonly privacySection = this.page.getByText(/Confidentialité|Privacy/i);
  readonly budgetSection = this.page.getByText(/Budget Global/i);
  readonly envelopesSection = this.page.getByText(/Enveloppes/i);
  readonly notificationsSection = this.page.getByText(/Notifications/i);

  // Budget Global
  readonly incomeInput = this.page.getByLabel(/Revenus|Salaire|income/i);
  readonly fixedCostsInput = this.page.getByLabel(/Frais Fixes|Charges/i);
  readonly savingsInput = this.page.getByLabel(/Épargne|Savings/i);
  readonly currencySelect = this.page.getByRole("combobox").first();
  readonly balanceIndicator = this.page.getByText(/Disponible pour les enveloppes/i);

  // Confidentialité
  readonly anonymousToggle = this.page.locator('[role="switch"]').first();

  // Enveloppes
  readonly newEnvelopeButton = this.page.getByRole("button", {
    name: /Nouvelle|Créer une enveloppe/i,
  });

  // Notifications
  readonly notificationButton = this.page.getByRole("button", { name: /Activer|Notifications/i });

  // Compte
  readonly deleteAccountButton = this.page.getByRole("button", { name: /Supprimer/i });

  // En-tête de l'utilisateur
  readonly userEmail = this.page.locator("text=@");

  async goto(): Promise<void> {
    await this.page.goto("/settings");
    await this.waitForDataLoaded(2_000);
    // Fermer les popups éventuelles
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(300);
  }

  async expectSettingsVisible(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectAllSectionsVisible(): Promise<void> {
    await expect(this.profileSection.first()).toBeVisible();
    await expect(this.appearanceSection.first()).toBeVisible();
    await expect(this.budgetSection.first()).toBeVisible();
    await expect(this.envelopesSection.first()).toBeVisible();
  }

  async updateIncome(value: string): Promise<void> {
    if ((await this.incomeInput.count()) > 0) {
      await this.incomeInput.fill(value);
      await this.incomeInput.press("Tab");
      await this.page.waitForTimeout(500);
    }
  }

  async updateCurrency(code: string): Promise<void> {
    if ((await this.currencySelect.count()) > 0) {
      await this.currencySelect.selectOption(code);
      await this.page.waitForTimeout(500);
    }
  }

  async toggleAnonymousMode(): Promise<void> {
    if ((await this.anonymousToggle.count()) > 0) {
      await this.anonymousToggle.click();
      await this.page.waitForTimeout(300);
    }
  }

  async clickNewEnvelope(): Promise<void> {
    await this.newEnvelopeButton.click();
  }

  async expectUserEmailVisible(): Promise<void> {
    await expect(this.userEmail.first()).toBeVisible({ timeout: 5_000 });
  }
}
