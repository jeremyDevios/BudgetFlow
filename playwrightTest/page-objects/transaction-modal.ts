import { Page, expect } from "@playwright/test";

/**
 * Modale de transaction — composant partagé utilisé depuis le dashboard,
 * la page détail d'enveloppe, et l'historique.
 */
export class TransactionModal {
  readonly dialog = this.page.getByRole("dialog").first();
  readonly title = this.dialog.locator("h2").first();
  readonly amountInput = this.dialog.getByLabel(/Montant/);
  readonly descriptionInput = this.dialog.getByLabel(/Description/);
  readonly dateInput = this.dialog.getByLabel(/Date/);
  readonly submitButton = this.dialog.getByRole("button", { name: /Ajouter|Enregistrer|Modifier/ });
  readonly deleteButton = this.dialog.getByRole("button", { name: /Supprimer/ });
  readonly reimbursementToggle = this.dialog.locator('[role="switch"]').first();
  readonly closeButton = this.dialog.getByRole("button", { name: /Fermer/ });
  readonly cancelButton = this.dialog.getByRole("button", { name: /Annuler/ });

  constructor(private page: Page) {}

  async expectVisible(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 5_000 });
  }

  async expectHidden(): Promise<void> {
    await expect(this.dialog).not.toBeVisible({ timeout: 5_000 });
  }

  async fillAmount(value: string): Promise<void> {
    await this.amountInput.fill(value);
  }

  async fillDescription(value: string): Promise<void> {
    await this.descriptionInput.fill(value);
  }

  async fillDate(value: string): Promise<void> {
    await this.dateInput.fill(value);
  }

  async toggleReimbursement(): Promise<void> {
    await this.reimbursementToggle.click();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.expectHidden();
  }

  async close(): Promise<void> {
    const closeBtn = this.closeButton.or(this.cancelButton);
    if ((await closeBtn.count()) > 0) {
      await closeBtn.first().click();
      await this.expectHidden();
    }
  }

  async delete(): Promise<void> {
    await this.deleteButton.click();
    // Une boîte de dialogue de confirmation peut apparaître
    this.page.once("dialog", (dialog) => dialog.accept());
    await this.expectHidden();
  }

  /**
   * Remplit et soumet une transaction complète.
   */
  async createTransaction(
    amount: string,
    description: string,
    date?: string
  ): Promise<void> {
    await this.fillAmount(amount);
    await this.fillDescription(description);
    if (date) {
      await this.fillDate(date);
    }
    await this.submit();
  }
}
