import { BasePage } from "./base-page";
import { TransactionModal } from "./transaction-modal";
import { expect } from "@playwright/test";

/**
 * Page Historique (/history) — timeline de toutes les transactions.
 */
export class HistoryPage extends BasePage {
  readonly transactionModal = new TransactionModal(this.page);
  readonly heading = this.page.getByRole("heading", { name: /Historique|History/i });
  readonly searchInput = this.page.getByPlaceholder(/Rechercher/i);
  readonly transactionItems = this.page.locator("[class*='space-y'] > div, [class*='space-y'] > li").first();
  readonly monthDividers = this.page.getByText(/^\d{4}$|^\w+ \d{4}$/);
  readonly noTransactionsMessage = this.page.getByText(/Aucune transaction|Aucun/i);

  async goto(): Promise<void> {
    await this.page.goto("/history");
    await this.waitForDataLoaded();
  }

  async expectHistoryVisible(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectTransactionListVisible(): Promise<void> {
    // Vérifie qu'il y a au moins quelques transactions
    const items = this.page.locator("[class*='space-y'] > div, [class*='space-y'] > li");
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  }

  async search(query: string): Promise<void> {
    if ((await this.searchInput.count()) > 0) {
      await this.searchInput.fill(query);
      await this.page.waitForTimeout(500);
    }
  }

  async clearSearch(): Promise<void> {
    if ((await this.searchInput.count()) > 0) {
      await this.searchInput.fill("");
      await this.page.waitForTimeout(300);
    }
  }

  async clickFirstTransaction(): Promise<void> {
    const firstItem = this.page.locator("[class*='space-y'] > div, [class*='space-y'] > li").first();
    await firstItem.click();
    await this.page.waitForTimeout(300);
  }

  async expectFilteredResults(visibleCount: number): Promise<void> {
    const items = this.page.locator("[class*='space-y'] > div, [class*='space-y'] > li");
    const count = await items.count();
    expect(count).toBe(visibleCount);
  }
}
