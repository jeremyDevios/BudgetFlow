import { BasePage } from "./base-page";
import { expect } from "@playwright/test";

/**
 * Page d'onboarding (/onboarding) — wizard en 2 étapes.
 *
 * Les inputs n'ont pas d'attribut id/htmlFor, donc on ne peut pas utiliser
 * getByLabel(). On cible les spinbutton par leur position dans le DOM.
 */
export class OnboardingPage extends BasePage {
  // Step 1 — les 3 premiers spinbutton de la page
  readonly incomeInput = this.page.getByRole("spinbutton").first();
  readonly fixedCostsInput = this.page.getByRole("spinbutton").nth(1);
  readonly savingsInput = this.page.getByRole("spinbutton").nth(2);

  readonly step1Heading = this.page.getByRole("heading", {
    name: "Commençons par les bases",
  });
  readonly continueButton = this.page.getByRole("button", {
    name: "Continuer",
  });

  // Step 2
  readonly step2Heading = this.page.getByRole("heading", {
    name: "Vos Enveloppes",
  });
  readonly finishButton = this.page.getByRole("button", { name: "Terminer" });
  readonly addEnvelopeButton = this.page.getByRole("button", {
    name: "Créer une enveloppe",
  });

  // Compteur de budget disponible.
  // Étape 1 : "Capacité pour vos enveloppes :"
  // Étape 2 : "Reste à attribuer :""
  readonly availableCounter = this.page
    .locator("text=vos enveloppes")
    .first();

  async goto(): Promise<void> {
    await this.page.goto("/onboarding");
    await this.page.waitForTimeout(1500);
  }

  async expectStep1Visible(): Promise<void> {
    await expect(this.step1Heading).toBeVisible({ timeout: 10_000 });
  }

  async expectStep2Visible(): Promise<void> {
    await expect(this.step2Heading).toBeVisible({ timeout: 10_000 });
  }

  async fillStep1(
    income: string,
    fixed: string,
    savings: string
  ): Promise<void> {
    await this.incomeInput.fill(income);
    await this.fixedCostsInput.fill(fixed);
    await this.savingsInput.fill(savings);
  }

  async clickContinue(): Promise<void> {
    await this.continueButton.click();
    await this.waitForDataLoaded();
  }

  async completeStep1(
    income = "2500",
    fixed = "1200",
    savings = "300"
  ): Promise<void> {
    await this.fillStep1(income, fixed, savings);
    await this.clickContinue();
    await this.expectStep2Visible();
  }

  async completeStep2(): Promise<void> {
    await this.finishButton.click();
    await this.page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await this.waitForDataLoaded();
  }

  async completeFullOnboarding(
    income = "2500",
    fixed = "1200",
    savings = "300"
  ): Promise<void> {
    await this.completeStep1(income, fixed, savings);
    await this.completeStep2();
  }

  /**
   * Vérifie que les 3 enveloppes par défaut sont visibles à l'étape 2.
   */
  async expectDefaultEnvelopes(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "Courses" })
    ).toBeVisible();
    await expect(
      this.page.getByRole("heading", { name: "Essence" })
    ).toBeVisible();
    await expect(
      this.page.getByRole("heading", { name: "Loisirs" })
    ).toBeVisible();
  }

  /**
   * Modifie le budget d'une enveloppe à l'étape 2.
   */
  async setEnvelopeBudget(name: string, budget: string): Promise<void> {
    const envelopeRow = this.page
      .locator("div")
      .filter({ hasText: name })
      .first();
    const input = envelopeRow.getByRole("spinbutton");
    await input.fill(budget);
  }
}
