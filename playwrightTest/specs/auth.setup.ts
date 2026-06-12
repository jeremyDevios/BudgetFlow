import { test as setup, expect } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

// Charger les variables d'environnement depuis .env.local
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const AUTH_FILE = path.resolve(__dirname, "playwright.auth.json");

/**
 * Setup d'authentification pour les tests E2E.
 *
 * Utilise le bypass E2E : injecte un utilisateur factice dans localStorage
 * au lieu de passer par la popup Google (bloquée par Google dans Chromium).
 *
 * PRÉREQUIS dans .env.local :
 * - NEXT_PUBLIC_E2E_AUTH_BYPASS=true
 * - E2E_TEST_USER_UID=<uid Firebase>
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

  // Utilisateur minimal — uniquement des données sérialisables,
  // sans fonctions Firebase (problème de transfert via page.evaluate)
  const fakeUser = {
    uid: testUid,
    email: testEmail,
    displayName: "E2E Test User",
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    providerData: [
      {
        providerId: "google.com",
        uid: testUid,
        email: testEmail,
        displayName: "E2E Test User",
      },
    ],
    // Méthodes vides — Firebase User en a, mais l'app ne les appelle pas
    // dans les chemins de code qu'on teste. On les mappe à des no-ops.
    delete: null,
    getIdToken: null,
    getIdTokenResult: null,
    reload: null,
    toJSON: null,
  };

  // Aller sur la page de login
  await page.goto("/login");
  await page.waitForTimeout(1500);

  // Injecter l'utilisateur bypass dans localStorage
  // On ne passe que les champs data (pas de fonctions Firebase)
  const userPayload = {
    uid: fakeUser.uid,
    email: fakeUser.email,
    displayName: fakeUser.displayName,
    photoURL: fakeUser.photoURL,
    emailVerified: fakeUser.emailVerified,
    isAnonymous: fakeUser.isAnonymous,
    providerData: fakeUser.providerData,
  };

  await page.evaluate((u) => {
    window.localStorage.setItem("e2e_user", JSON.stringify(u));
  }, userPayload);

  console.log("💉 Utilisateur bypass injecté dans localStorage.");

  // Naviguer vers le dashboard — AuthContext détectera le bypass
  await page.goto("/dashboard");
  // Ne pas attendre networkidle : Firestore peut continuer à faire
  // des requêtes en arrière-plan (permissions, settings, etc.)
  await page.waitForTimeout(2_000);

  // Attendre que le dashboard se charge
  const currentUrl = page.url();

  if (currentUrl.includes("/onboarding")) {
    console.log("⚠️  Utilisateur NON onboardé — redirigé vers /onboarding");
    console.log(
      "   Lance le seed avec --user " + testUid + " pour créer ses données,"
    );
    console.log("   ou complète l'onboarding manuellement dans le navigateur.");
  } else if (currentUrl.includes("/dashboard")) {
    await expect(page.getByText("Mes Enveloppes")).toBeVisible({
      timeout: 15_000,
    });
    console.log("✅ Dashboard atteint !");
  }

  // Sauvegarder l'état (inclut localStorage avec e2e_user)
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✅ Auth state sauvegardé: ${AUTH_FILE}`);
});
