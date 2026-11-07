/**
 * Tests des règles Firestore (firestore.rules) — multi-budget & non-régression.
 *
 * Exécution (nécessite l'émulateur Firestore, donc Java) :
 *   npm run test:rules
 *
 * Le harnais @firebase/rules-unit-testing génère des tokens de test locaux
 * (l'émulateur Auth n'est pas requis) ; la règle isAuthenticated() exige
 * firebase.sign_in_provider, fourni via les options de contexte.
 *
 * Couverture :
 *   1. Non-régression des payloads legacy (settings / enveloppe / transaction).
 *   2. Slots de budgets : limite de 5, validation, immuabilité de createdAt.
 *   3. budgetIsLive : soft-delete → sous-collections non écrivables.
 *   4. Intégrité référentielle : une dépense ne référence qu'une enveloppe
 *      du MÊME budget.
 *   5. Quota de 50 enveloppes PAR budget (compteurs par slot) + quota legacy.
 *   6. state/currentBudget : uniquement 'default' ou un budget vivant.
 *   7. Réglages financiers & revenus variables par budget.
 */
const { readFileSync } = require("node:fs");

const PROJECT_ID = "budgetflow-rules-test";

// ── Payloads legacy (format des anciens clients — aucune clé nouvelle) ──────

const LEGACY_ENVELOPE = {
  name: "Courses",
  budget: 300,
  spent: 0,
  icon: "ShoppingCart",
  color: "bg-purple-500",
  order: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  isTemporary: false,
  activeMonths: [],
};

const LEGACY_TRANSACTION = {
  amount: 12.5,
  envelopeId: "env-legacy",
  date: "2026-11-02",
  createdAt: "2026-11-02T10:00:00Z",
  updatedAt: "2026-11-02T10:00:00Z",
  description: "Courses",
  isReimbursement: false,
};

const LEGACY_SETTINGS = {
  monthlyIncome: 3200,
  fixedCosts: 900,
  monthlySavings: 400,
  isOnboarded: true,
  currency: "EUR",
  bentoPreset: "balanced",
  anonymousMode: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

// ── Fabriques de payloads valides ────────────────────────────────────────────

function validBudget(overrides = {}) {
  return {
    name: "Compte joint",
    icon: "Users",
    color: "bg-emerald-500",
    createdAt: "2026-11-03T00:00:00Z",
    updatedAt: "2026-11-03T00:00:00Z",
    ...overrides,
  };
}

function validEnvelope(overrides = {}) {
  return { ...LEGACY_ENVELOPE, ...overrides };
}

function validTransaction(envelopeId) {
  return { ...LEGACY_TRANSACTION, envelopeId };
}

function validIncome() {
  return {
    amount: 1000,
    type: "income",
    source: "Salaire",
    date: "2026-11-01",
    createdAt: "2026-11-01T08:00:00Z",
    updatedAt: "2026-11-01T08:00:00Z",
  };
}

async function main() {
  const { initializeTestEnvironment, assertFails, assertSucceeds } = await import(
    "@firebase/rules-unit-testing"
  );

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const [host, port] = emulatorHost.split(":");

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });

  const context = (uid) =>
    testEnv.authenticatedContext(uid, {
      firebase: { sign_in_provider: "google.com" },
    });

  let passed = 0;
  const failures = [];

  async function expectAllow(name, promiseFactory) {
    try {
      await assertSucceeds(promiseFactory());
      passed += 1;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      failures.push(`✗ ${name} — attendait un succès : ${error.message}`);
    }
  }

  async function expectDeny(name, promiseFactory) {
    try {
      await assertFails(promiseFactory());
      passed += 1;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      failures.push(`✗ ${name} — attendait un refus : ${error.message}`);
    }
  }

  console.log("1. Non-régression — payloads legacy");
  {
    const ctx = context("alice");
    await expectAllow("settings legacy accepté", () =>
      ctx.firestore().doc("users/alice/settings/general").set(LEGACY_SETTINGS)
    );
    await expectAllow("enveloppe legacy acceptée", () =>
      ctx.firestore().doc("users/alice/envelopes/env-legacy").set(LEGACY_ENVELOPE)
    );
    await expectAllow("transaction legacy acceptée", () =>
      ctx
        .firestore()
        .doc("users/alice/transactions/tx-legacy")
        .set(LEGACY_TRANSACTION)
    );
  }

  console.log("2. Budgets — slots & validation");
  {
    const ctx = context("alice");
    await expectAllow("création budget-1", () =>
      ctx.firestore().doc("users/alice/budgets/budget-1").set(validBudget())
    );
    await expectDeny("création budget-6 refusée (limite de 5)", () =>
      ctx.firestore().doc("users/alice/budgets/budget-6").set(validBudget())
    );
    await expectDeny("création slot hors liste refusée", () =>
      ctx.firestore().doc("users/alice/budgets/budget-0").set(validBudget())
    );
    await expectDeny("payload budget invalide refusé (nom > 50)", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-2")
        .set(validBudget({ name: "x".repeat(51) }))
    );
    await expectDeny("createdAt immuable", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-1")
        .set(validBudget({ createdAt: "2026-01-01T00:00:00Z" }))
    );
    const anon = testEnv.unauthenticatedContext();
    await expectDeny("création non authentifiée refusée", () =>
      anon.firestore().doc("users/alice/budgets/budget-3").set(validBudget())
    );
    const bob = context("bob");
    await expectDeny("création sur le compte d'autrui refusée", () =>
      bob.firestore().doc("users/alice/budgets/budget-3").set(validBudget())
    );
  }

  console.log("3. budgetIsLive — soft-delete");
  {
    const ctx = context("alice");
    await expectAllow("enveloppe dans un budget vivant", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-1/envelopes/env-a")
        .set(validEnvelope())
    );
    await expectAllow("soft-delete du budget", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-1")
        .set(validBudget({ deletedAt: "2026-11-03T12:00:00Z" }))
    );
    await expectDeny("écriture enveloppe après soft-delete refusée", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-1/envelopes/env-b")
        .set(validEnvelope())
    );
    await expectDeny("écriture transaction après soft-delete refusée", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-1/transactions/tx-a")
        .set(validTransaction("env-a"))
    );
  }

  console.log("4. Intégrité référentielle");
  {
    const ctx = context("alice");
    await expectAllow("création budget-2", () =>
      ctx.firestore().doc("users/alice/budgets/budget-2").set(validBudget())
    );
    await expectAllow("enveloppe du budget-2", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-2/envelopes/env-2")
        .set(validEnvelope())
    );
    await expectAllow("dépense vers une enveloppe du même budget", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-2/transactions/tx-ok")
        .set(validTransaction("env-2"))
    );
    await expectDeny("dépense vers une enveloppe d'un AUTRE budget refusée", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-2/transactions/tx-bad")
        .set(validTransaction("env-a"))
    );
    await expectDeny("dépense vers une enveloppe legacy refusée", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-2/transactions/tx-legacy-2")
        .set(validTransaction("env-legacy"))
    );
    await expectAllow("revenu sans enveloppe accepté", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-2/transactions/tx-income")
        .set(validIncome())
    );
  }

  console.log("5. Quota — 50 enveloppes PAR budget");
  {
    const ctx = context("alice");
    await expectAllow("compteur 50/50 écrit (doc ≤ 40 clés)", () =>
      ctx
        .firestore()
        .doc("counters/alice")
        .set({ envelopeCount: 50, envelopeCounts: { "budget-2": 50 } })
    );
    await expectDeny("51e enveloppe du budget-2 refusée", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-2/envelopes/env-q2")
        .set(validEnvelope())
    );
    await expectAllow("création budget-3", () =>
      ctx.firestore().doc("users/alice/budgets/budget-3").set(validBudget())
    );
    await expectAllow("quota du slot budget-3 non affecté", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-3/envelopes/env-q3")
        .set(validEnvelope())
    );
    await expectDeny("quota legacy inchangé : 51e enveloppe refusée", () =>
      ctx
        .firestore()
        .doc("users/alice/envelopes/env-51")
        .set(LEGACY_ENVELOPE)
    );
  }

  console.log("6. state/currentBudget");
  {
    const ctx = context("alice");
    await expectAllow("switch vers le défaut", () =>
      ctx
        .firestore()
        .doc("users/alice/state/currentBudget")
        .set({ budgetId: "default", updatedAt: "2026-11-03T00:00:00Z" })
    );
    await expectAllow("switch vers un budget vivant", () =>
      ctx
        .firestore()
        .doc("users/alice/state/currentBudget")
        .set({ budgetId: "budget-2", updatedAt: "2026-11-03T00:00:00Z" })
    );
    await expectDeny("switch vers un budget soft-deleté refusé", () =>
      ctx
        .firestore()
        .doc("users/alice/state/currentBudget")
        .set({ budgetId: "budget-1", updatedAt: "2026-11-03T00:00:00Z" })
    );
    await expectDeny("switch vers un id inconnu refusé", () =>
      ctx
        .firestore()
        .doc("users/alice/state/currentBudget")
        .set({ budgetId: "budget-9", updatedAt: "2026-11-03T00:00:00Z" })
    );
    await expectDeny("champ parasite refusé (hasOnly)", () =>
      ctx
        .firestore()
        .doc("users/alice/state/currentBudget")
        .set({
          budgetId: "budget-2",
          updatedAt: "2026-11-03T00:00:00Z",
          hack: true,
        })
    );
  }

  console.log("7. Réglages & revenus par budget");
  {
    const ctx = context("alice");
    await expectAllow("settings d'un budget vivant", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-2/settings/general")
        .set(LEGACY_SETTINGS)
    );
    await expectAllow("monthlyIncomes d'un budget vivant", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-2/monthlyIncomes/2026-11")
        .set({ amount: 2000 })
    );
    await expectDeny("settings d'un budget soft-deleté refusés", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-1/settings/general")
        .set(LEGACY_SETTINGS)
    );
    await expectDeny("monthlyIncomes d'un budget soft-deleté refusés", () =>
      ctx
        .firestore()
        .doc("users/alice/budgets/budget-1/monthlyIncomes/2026-11")
        .set({ amount: 2000 })
    );
  }

  await testEnv.cleanup();

  if (failures.length > 0) {
    console.error(`\n${failures.length} échec(s) :\n`);
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }

  console.log(`\n${passed} tests de règles OK`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
