import { BasePage } from "./base-page";
import { expect } from "@playwright/test";

/**
 * Page Cash Flow (/cashflow) — diagramme Sankey.
 */
export class CashflowPage extends BasePage {
  readonly heading = this.page.getByRole("heading", { name: /Cash Flow|Cashflow/i });
  readonly sankeyChart = this.page.locator("svg").first();
  readonly totalIncome = this.page.getByText(/Revenu Total|Revenus/i);
  readonly totalAllocated = this.page.getByText(/Total Alloué|Alloué/i);
  readonly envelopesList = this.page.locator("[class*='envelope'], [class*='enveloppe']");
  readonly noDataMessage = this.page.getByText(/Aucun|Pas de données|pas encore/i);

  async goto(): Promise<void> {
    await this.page.goto("/cashflow");
    await this.waitForDataLoaded();
  }

  async expectCashflowVisible(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectSankeyVisible(): Promise<void> {
    await expect(this.sankeyChart).toBeVisible({ timeout: 10_000 });
  }

  async expectSummaryCards(): Promise<void> {
    await expect(this.totalIncome.first()).toBeVisible({ timeout: 5_000 });
    await expect(this.totalAllocated.first()).toBeVisible({ timeout: 5_000 });
  }

  async expectEnvelopesListed(): Promise<void> {
    const count = await this.envelopesList.count();
    expect(count).toBeGreaterThan(0);
  }
}
