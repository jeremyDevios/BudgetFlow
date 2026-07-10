import { defineConfig, devices } from "@playwright/test";
import path from "path";

const PORT = 8091;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "../playwrightWorkspace/reports", open: "never" }],
    ["json", { outputFile: "../playwrightWorkspace/test-results/results.json" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  globalSetup: path.resolve(__dirname, "global-setup.ts"),
  globalTeardown: path.resolve(__dirname, "global-teardown.ts"),
  projects: [
    {
      name: "auth-setup",
      testMatch: "auth.setup.ts",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "unauthenticated",
      use: {
        ...devices["Desktop Chrome"],
      },
      testMatch: "**/public-flow.spec.ts",
    },
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.resolve(__dirname, "specs", "playwright.auth.json"),
      },
      dependencies: ["auth-setup"],
      testIgnore: "**/{public-flow,onboarding-flow}.spec.ts",
    },
    {
      name: "onboarding",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.resolve(__dirname, "specs", "playwright.onboarding.json"),
      },
      testMatch: "**/onboarding-flow.spec.ts",
      dependencies: ["auth-setup"],
    },
  ],
  webServer: {
    command: "npm run dev -- --webpack",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
