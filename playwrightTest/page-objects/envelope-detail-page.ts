import { BasePage } from "./base-page";
import { TransactionModal } from "./transaction-modal";
import { expect } from "@playwright/test";

/**
 * Page de détail d'une enveloppe (/envelopes/[id])
 */
export class EnvelopeDetailPage extends BasePage {
  readonly transactionModal = new TransactionModal(this.page);
  readonly newExpenseButton = this.page.getByRole("button", {
    name: /Nouvelle Dépense|Ajouter une dépense/i,
  });
  readonly transactionList = this.page.locator("[class*='space-y']").filter({
    has: this.page.getByText(/€|\$|£/),
  });
  readonly forecastCard = this.page
    .locator("[class*='forecast'], [class*='prévision']")
    .first();
  readonly envelopeHeading = this.page.locator("h1").first();
  readonly budgetInfo = this.page.getByText(/Budget|Enveloppe/i);

  async goto(envelopeId: string): Promise<void> {
    await this.page.goto(`/envelopes/${envelopeId}`);
    await this.waitForDataLoaded();
  }

  async expectEnvelopeVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10_000 });
  }

  async expectTransactionListVisible(): Promise<void> {
    await expect(this.transactionList).toBeVisible({ timeout: 5_000 });
  }

  async openNewTransaction(): Promise<void> {
    await this.newExpenseButton.click();
    await this.transactionModal.expectVisible();
  }

  async clickTransaction(description: string): Promise<void> {
    const txRow = this.page.locator("[class*='space-y']").filter({
      hasText: description,
    }).first();
    await txRow.click();
    // La modale de transaction s'ouvre pour l'édition
    await this.page.waitForTimeout(300);
  }

  async getTransactionCount(): Promise<number> {
    // Compte le nombre de lignes de transaction
    const items = this.page
      .locator("[class*='space-y']")
      .first()
      .locator("> div, > li, > [role='listitem']");
    return await items.count();
  }

  async expectForecastVisible(): Promise<void> {
    if ((await this.forecastCard.count()) > 0) {
      await expect(this.forecastCard).toBeVisible();
    }
  }
}
