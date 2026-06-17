import { BasePage } from "./base-page";
import { expect } from "@playwright/test";

/**
 * Page de connexion (/login)
 */
export class LoginPage extends BasePage {
  readonly googleButton = this.page.getByRole("button", {
    name: "Se connecter avec Google",
  });
  readonly appleButton = this.page.getByRole("button", {
    name: "Se connecter avec Apple",
  });
  readonly heading = this.page.locator("h1");
  readonly appNameText = this.page.getByText("Vizualy Budget");

  async goto(): Promise<void> {
    await this.page.goto("/login");
    await this.page.waitForTimeout(1500);
  }

  async expectLoginVisible(): Promise<void> {
    await expect(this.appNameText).toBeVisible({ timeout: 10_000 });
    await expect(this.googleButton).toBeVisible();
    await expect(this.appleButton).toBeVisible();
  }

  async expectHeadingVisible(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async clickGoogleSignIn(): Promise<void> {
    await this.googleButton.click();
  }

  async clickAppleSignIn(): Promise<void> {
    await this.appleButton.click();
  }
}
