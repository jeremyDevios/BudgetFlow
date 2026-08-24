import { test as setup, expect } from "@playwright/test";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import admin from "firebase-admin";

// Charger les variables d'environnement depuis .env.local
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
// SEC-25 : les clés privées Firebase (FIREBASE_PRIVATE_KEY, …) ont été
// déplacées hors de l'arbre du projet par scripts/migrate-secrets.js —
// compléter avec le fichier externe (sans écraser les valeurs existantes).
dotenv.config({
  path: path.resolve(
    process.env.BUDGETFLOW_SECRETS_DIR ||
      path.join(os.homedir(), ".config", "budgetflow"),
    "env",
    "dev.env"
  ),
});

const AUTH_FILE = path.resolve(__dirname, "playwright.auth.json");
const ONBOARDING_AUTH_FILE = path.resolve(
  __dirname,
  "playwright.onboarding.json"
);

/**
 * Initialise Firebase Admin (si pas déjà fait) et retourne l'auth admin.
 * Réutilise les credentials configurés dans .env.local.
 */
function getAdminAuth(): admin.auth.Auth {
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY " +
        "sont requises dans .env.local pour générer des custom tokens E2E."
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
  return admin.auth();
}

/**
 * Génère un custom token Firebase pour l'UID donné et l'injecte dans
 * localStorage afin que AuthContext crée une VRAIE session Firebase Auth.
 */
async function injectCustomToken(
  page: import("@playwright/test").Page,
  uid: string
): Promise<void> {
  const customToken = await getAdminAuth().createCustomToken(uid);
  await page.evaluate((token: string) => {
    window.localStorage.setItem("e2e_token", token);
  }, customToken);
  console.log(`🔑 Custom token injecté pour uid: ${uid}`);
}

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
 * Injecte l'utilisateur bypass dans localStorage, navigue vers /dashboard
 * pour vérifier le bypass, puis injecte un custom token Firebase Admin
 * QUI SERA UTILISÉ PAR LES TESTS (pas par l'auth setup elle-même).
 *
 * Le token est injecté APRÈS la navigation pour qu'il ne soit pas consommé
 * par AuthContext pendant l'auth setup — il reste dans le storage state
 * sauvegardé pour que chaque test puisse l'utiliser avec signInWithCustomToken.
 *
 * Retourne l'URL finale après redirection éventuelle.
 */
async function injectAndNavigate(
  page: import("@playwright/test").Page,
  uid: string,
  email: string,
  options: { withCustomToken?: boolean } = {}
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

  // PAS de custom token avant la navigation : on laisse AuthContext
  // utiliser le bypass classique (faux user React) pour cette phase
  // de vérification.

  await page.goto("/dashboard");
  await page.waitForTimeout(2_000);

  // MAINTENANT on injecte le custom token dans localStorage.
  // AuthContext ne le verra pas pendant cette navigation (la page est
  // déjà chargée), donc le token survit dans le storage state pour les tests.
  if (options.withCustomToken !== false) {
    await injectCustomToken(page, uid);
  }

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
