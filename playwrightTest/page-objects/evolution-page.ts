import { BasePage } from "./base-page";
import { expect } from "@playwright/test";

/**
 * Page Évolution (/evolution) — graphique d'épargne mensuelle.
 */
export class EvolutionPage extends BasePage {
  readonly heading = this.page.getByRole("heading", { name: /Évolution|Evolution/i });
  readonly chart = this.page.locator("svg").first();
  readonly monthDetails = this.page.getByText(/Détails mensuels|Mensuel/i);
  readonly totalSpent = this.page.getByText(/Total dépenses|Dépensé/i);
  readonly totalSaved = this.page.getByText(/Total économies|Économies|Épargné/i);
  readonly monthRows = this.page.locator("[class*='space-y'] > div").first();
  readonly noDataMessage = this.page.getByText(/Aucun|Pas assez|pas encore/i);

  async goto(): Promise<void> {
    await this.page.goto("/evolution");
    await this.waitForDataLoaded();
  }

  async expectEvolutionVisible(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectChartVisible(): Promise<void> {
    await expect(this.chart).toBeVisible({ timeout: 10_000 });
  }

  async expectMonthDetailsVisible(): Promise<void> {
    await expect(this.monthDetails.first()).toBeVisible({ timeout: 5_000 });
  }

  async expectSummaryVisible(): Promise<void> {
    await expect(this.totalSpent.first()).toBeVisible({ timeout: 5_000 });
    await expect(this.totalSaved.first()).toBeVisible({ timeout: 5_000 });
  }

  async expectMonthRowsExist(): Promise<void> {
    const count = await this.page.locator("[class*='space-y'] > div").count();
    expect(count).toBeGreaterThan(0);
  }

  async hoverChartPoint(): Promise<void> {
    // Survole un point du graphique pour afficher le tooltip
    const chartArea = this.chart.locator("path, circle, rect").first();
    if ((await chartArea.count()) > 0) {
      await chartArea.hover();
      await this.page.waitForTimeout(500);
    }
  }
}
