import { test as setup, expect } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

// Charger les variables d'environnement depuis .env.local
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const AUTH_FILE = path.resolve(__dirname, "playwright.auth.json");
const ONBOARDING_AUTH_FILE = path.resolve(
  __dirname,
  "playwright.onboarding.json"
);

/**
 * Crée un utilisateur factice pour le bypass E2E.
 */
function makeFakeUser(uid: string, email: string) {
  return {
    uid,
    email,
    displayName: "E2E Test User",
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    providerData: [
      {
        providerId: "google.com",
        uid,
        email,
        displayName: "E2E Test User",
      },
    ],
    // Méthodes vides — Firebase User en a, mais l'app ne les appelle pas
    delete: null,
    getIdToken: null,
    getIdTokenResult: null,
    reload: null,
    toJSON: null,
  };
}

/**
 * Injecte l'utilisateur bypass dans localStorage et navigue vers /dashboard.
 * Retourne l'URL finale après redirection éventuelle.
 */
async function injectAndNavigate(
  page: import("@playwright/test").Page,
  uid: string,
  email: string
): Promise<string> {
  const fakeUser = makeFakeUser(uid, email);

  const userPayload = {
    uid: fakeUser.uid,
    email: fakeUser.email,
    displayName: fakeUser.displayName,
    photoURL: fakeUser.photoURL,
    emailVerified: fakeUser.emailVerified,
    isAnonymous: fakeUser.isAnonymous,
    providerData: fakeUser.providerData,
  };

  await page.goto("/login");
  await page.waitForTimeout(1500);

  await page.evaluate((u) => {
    window.localStorage.setItem("e2e_user", JSON.stringify(u));
  }, userPayload);

  console.log(`💉 Utilisateur bypass injecté: ${uid}`);

  await page.goto("/dashboard");
  await page.waitForTimeout(2_000);

  return page.url();
}

/**
 * Setup d'authentification pour les tests E2E.
 *
 * Utilise le bypass E2E : injecte un utilisateur factice dans localStorage
 * au lieu de passer par la popup Google (bloquée par Google dans Chromium).
 *
 * Génère deux fichiers d'état :
 * - playwright.auth.json : utilisateur onboardé (dashboard)
 * - playwright.onboarding.json : utilisateur NON onboardé (onboarding)
 *
 * PRÉREQUIS dans .env.local :
 * - NEXT_PUBLIC_E2E_AUTH_BYPASS=true
 * - E2E_TEST_USER_UID=<uid Firebase>  (utilisateur déjà onboardé via seed)
 */
setup("authenticate", async ({ page }) => {
  setup.setTimeout(30_000);

  const testUid = process.env.E2E_TEST_USER_UID;
  if (!testUid) {
    throw new Error(
      "E2E_TEST_USER_UID manquant ! Ajoute-le dans .env.local"
    );
  }
  const testEmail =
    process.env.E2E_TEST_USER_EMAIL || "e2e@budgetflow.test";

  console.log(`🔐 Setup auth E2E (bypass) — uid: ${testUid}`);

  // ─── 1. Auth pour utilisateur onboardé ───────────────────────────
  const dashboardUrl = await injectAndNavigate(page, testUid, testEmail);

  if (dashboardUrl.includes("/onboarding")) {
    console.log("⚠️  Utilisateur NON onboardé — redirigé vers /onboarding");
    console.log(
      "   Lance le seed avec --user " + testUid + " pour créer ses données,"
    );
    console.log("   ou complète l'onboarding manuellement dans le navigateur.");
  } else if (dashboardUrl.includes("/dashboard")) {
    await expect(page.getByText("Mes Enveloppes")).toBeVisible({
      timeout: 15_000,
    });
    console.log("✅ Dashboard atteint !");
  }

  // Sauvegarder l'état (inclut localStorage avec e2e_user)
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✅ Auth state sauvegardé: ${AUTH_FILE}`);

  // ─── 2. Auth pour utilisateur NON onboardé ───────────────────────
  // UID unique par run (timestamp) pour éviter qu'un test qui termine
  // l'onboarding ne contamine les runs suivants via isOnboarded: true.
  const onboardingUid = `e2e-onboarding-${Date.now()}`;
  const onboardingEmail = `onboarding-${Date.now()}@budgetflow.test`;

  console.log(`🔐 Setup auth E2E onboarding — uid: ${onboardingUid}`);

  const onboardingUrl = await injectAndNavigate(
    page,
    onboardingUid,
    onboardingEmail
  );

  if (onboardingUrl.includes("/onboarding")) {
    console.log("✅ Redirigé vers /onboarding !");
  } else {
    console.warn(
      `⚠️  Attendu /onboarding mais reçu: ${onboardingUrl}`
    );
  }

  await page.context().storageState({ path: ONBOARDING_AUTH_FILE });
  console.log(`✅ Onboarding auth state sauvegardé: ${ONBOARDING_AUTH_FILE}`);
});
