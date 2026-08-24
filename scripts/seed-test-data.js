#!/usr/bin/env node
/**
 * seed-test-data.js
 *
 * Crée un jeu de données de test complet pour un utilisateur Firestore donné :
 * - settings/general
 * - plusieurs enveloppes
 * - beaucoup de transactions sur les 5 derniers mois
 * - activité quotidienne (dailyActivity)
 *
 * Le jeu de données est conçu pour faire remonter les notifications intelligentes
 * (dépense exceptionnelle, rythme trop rapide, enveloppe souvent dépassée, etc.)
 * sans modifier automatiquement les montants des enveloppes côté application.
 *
 * Usage :
 *   node scripts/seed-test-data.js --user <userId>
 *   node scripts/seed-test-data.js --user <userId> --confirm
 *   node scripts/seed-test-data.js --user <userId> --confirm --replace-existing
 *   node scripts/seed-test-data.js --user <userId> --confirm --env dev
 *   node scripts/seed-test-data.js --user <userId> --confirm --today 2026-05-09
 *
 * Options :
 *   --user <userId>         UID Firebase cible (obligatoire)
 *   --confirm               Écrit réellement en base (sinon dry-run)
 *   --dry-run               Force le mode simulation
 *   --replace-existing      Supprime les enveloppes, transactions et dailyActivity existants
 *   --env prod|dev          Environnement cible (défaut: dev — la production
 *                           exige --env prod explicite, cf. SEC-33)
 *   --project <projectId>   Override du projectId Firebase
 *   --today <YYYY-MM-DD>    Date d'ancrage pour générer les 5 derniers mois
 *   --help                  Affiche cette aide
 */

"use strict";

const admin = require("firebase-admin");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { loadEnvFiles, getSecretsDir } = require("./load-env");

loadEnvFiles(".env.local", ".env");

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};
const valueFlags = new Set(["--user", "--env", "--project", "--today"]);

function getPositionalArgs(argv) {
  const positionalArgs = [];

  for (let index = 0; index < argv.length; index += 1) {
    const currentArg = argv[index];

    if (currentArg.startsWith("--")) {
      if (valueFlags.has(currentArg)) {
        index += 1;
      }
      continue;
    }

    positionalArgs.push(currentArg);
  }

  return positionalArgs;
}

function printHelp() {
  console.log(`
🔥 BudgetFlow — Seed jeu de données de test

Usage :
  node scripts/seed-test-data.js --user <userId>
  node scripts/seed-test-data.js --user <userId> --confirm
  node scripts/seed-test-data.js --user <userId> --confirm --replace-existing
  npm run seed:test-data -- --env dev --user <userId>

Options :
  --user <userId>         UID Firebase cible (obligatoire)
  --confirm               Écrit réellement en base (sinon dry-run)
  --dry-run               Force le mode simulation
  --replace-existing      Supprime les enveloppes, transactions et dailyActivity existants
  --env prod|dev          Environnement cible (défaut: prod)
  --project <projectId>   Override du projectId Firebase
  --today <YYYY-MM-DD>    Date d'ancrage pour générer les 5 derniers mois
  --help                  Affiche cette aide

Notes :
  - Sans --confirm, le script ne fait qu'afficher ce qu'il écrirait.
  - Avec npm, utilisez bien "--" avant les options :
      npm run seed:test-data -- --env dev --user <userId>
  - Sans --replace-existing, les données seedées sont écrites avec des IDs stables
    pour éviter les doublons à chaque relance, mais les données existantes du user
    restent présentes.
  - Pour un environnement de test propre, utilisez --confirm --replace-existing.
`);
}

if (hasFlag("--help")) {
  printHelp();
  process.exit(0);
}

const positionalArgs = getPositionalArgs(args);
const positionalEnv =
  positionalArgs[0] === "dev" || positionalArgs[0] === "prod"
    ? positionalArgs[0]
    : null;
const positionalUserId = positionalEnv ? positionalArgs[1] || null : positionalArgs[0] || null;

const userId = getArg("--user") || positionalUserId;
// SEC-33 : défaut `dev` — écrire en production doit être un choix explicite.
const env = getArg("--env") || positionalEnv || "dev";
const customProjectId = getArg("--project");
const todayArg = getArg("--today");
const replaceExisting = hasFlag("--replace-existing");
const isDryRun = hasFlag("--dry-run") || !hasFlag("--confirm");

if (!userId) {
  console.error("❌ --user <userId> est obligatoire.");
  process.exit(1);
}

const anchorDate = todayArg ? parseLocalDate(todayArg) : new Date();
if (!Number.isFinite(anchorDate.getTime())) {
  console.error("❌ --today doit être au format YYYY-MM-DD.");
  process.exit(1);
}

const SEED_PREFIX = "seed";
const BATCH_LIMIT = 400;

function parseLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(Number.NaN);
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1, 12, 0, 0, 0);
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function clampDay(monthDate, day) {
  return Math.min(Math.max(day, 1), daysInMonth(monthDate));
}

function buildIsoDate(monthDate, day, hour, minute) {
  const safeDay = clampDay(monthDate, day);
  return new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    safeDay,
    hour,
    minute,
    0,
    0
  ).toISOString();
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value) {
  return `${roundCurrency(value).toFixed(2)} €`;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function allocateWeightedAmounts(total, pattern) {
  const allocated = [];
  let consumed = 0;

  for (let index = 0; index < pattern.length; index += 1) {
    if (index === pattern.length - 1) {
      allocated.push(roundCurrency(total - consumed));
      continue;
    }

    const amount = roundCurrency(total * pattern[index].weight);
    allocated.push(amount);
    consumed += amount;
  }

  return allocated;
}

function buildWeightedTransactions({ envelopeId, monthDate, total, pattern, transactionPrefix }) {
  const amounts = allocateWeightedAmounts(total, pattern);

  return pattern.map((entry, index) => {
    const amount = amounts[index];
    const slug = slugify(entry.label || `tx-${index + 1}`);
    const date = buildIsoDate(monthDate, entry.day, 9 + (index % 6), index % 2 === 0 ? 15 : 45);

    return {
      id: `${SEED_PREFIX}-tx-${transactionPrefix}-${toMonthKey(monthDate)}-${String(index + 1).padStart(2, "0")}-${slug}`,
      envelopeId,
      amount,
      description: entry.label,
      date,
      createdAt: date,
    };
  });
}

function buildFixedTransactions({ envelopeId, monthDate, entries, transactionPrefix }) {
  return entries.map((entry, index) => {
    const slug = slugify(entry.label || `tx-${index + 1}`);
    const date = buildIsoDate(monthDate, entry.day, 8 + (index % 8), index % 2 === 0 ? 5 : 35);

    return {
      id: `${SEED_PREFIX}-tx-${transactionPrefix}-${toMonthKey(monthDate)}-${String(index + 1).padStart(2, "0")}-${slug}`,
      envelopeId,
      amount: roundCurrency(entry.amount),
      description: entry.label,
      date,
      createdAt: date,
    };
  });
}

function createMonthContexts(today) {
  const currentMonth = startOfMonth(today);
  const contexts = [];

  for (let offset = 4; offset >= 0; offset -= 1) {
    const monthDate = addMonths(currentMonth, -offset);
    contexts.push({
      monthDate,
      monthKey: toMonthKey(monthDate),
      isCurrentMonth: offset === 0,
    });
  }

  return contexts;
}

function createActivityDocs(monthContexts, today) {
  const oldestMonth = monthContexts[0].monthDate;
  const endDate = startOfDay(today);
  const docs = [];
  const cursor = new Date(oldestMonth);

  while (cursor <= endDate) {
    const day = cursor.getDay();
    const isWeekend = day === 0 || day === 6;

    if (!isWeekend || day === 6) {
      const dateKey = toDateKey(cursor);
      docs.push({
        id: dateKey,
        data: {
          loggedIn: true,
          date: dateKey,
        },
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return docs;
}

function buildSeedDataset(today) {
  const monthContexts = createMonthContexts(today);

  const envelopePlans = [
    {
      id: `${SEED_PREFIX}-env-courses`,
      name: "Courses",
      icon: "ShoppingCart",
      color: "bg-blue-500",
      budget: 420,
      order: 0,
      buildHistorical(monthDate, total) {
        return buildWeightedTransactions({
          envelopeId: this.id,
          monthDate,
          total,
          transactionPrefix: "courses",
          pattern: [
            { label: "Carrefour", day: 2, weight: 0.22 },
            { label: "Marche local", day: 5, weight: 0.1 },
            { label: "Boulangerie", day: 8, weight: 0.08 },
            { label: "Drive hebdo", day: 11, weight: 0.2 },
            { label: "Primeur", day: 15, weight: 0.1 },
            { label: "Picard", day: 19, weight: 0.12 },
            { label: "Superette", day: 23, weight: 0.08 },
            { label: "Courses fin de mois", day: 27, weight: 0.1 },
          ],
        });
      },
      buildCurrent(monthDate) {
        return buildFixedTransactions({
          envelopeId: this.id,
          monthDate,
          transactionPrefix: "courses",
          entries: [
            { label: "Carrefour", amount: 32.4, day: 1 },
            { label: "Marche local", amount: 19.8, day: 2 },
            { label: "Boulangerie", amount: 14.5, day: 3 },
            { label: "Drive hebdo", amount: 41.2, day: 4 },
            { label: "Primeur", amount: 23.7, day: 6 },
            { label: "Picard", amount: 36.4, day: 8 },
          ],
        });
      },
      historicalTotals: [348, 362, 371, 356],
    },
    {
      id: `${SEED_PREFIX}-env-transport`,
      name: "Transport",
      icon: "Bus",
      color: "bg-orange-500",
      budget: 140,
      order: 1,
      buildHistorical(monthDate, total) {
        return buildWeightedTransactions({
          envelopeId: this.id,
          monthDate,
          total,
          transactionPrefix: "transport",
          pattern: [
            { label: "Essence", day: 2, weight: 0.26 },
            { label: "Parking", day: 4, weight: 0.08 },
            { label: "Plein station", day: 9, weight: 0.24 },
            { label: "Peage", day: 13, weight: 0.06 },
            { label: "Essence", day: 17, weight: 0.2 },
            { label: "Lavage auto", day: 22, weight: 0.06 },
            { label: "Recharge transport", day: 26, weight: 0.1 },
          ],
        });
      },
      buildCurrent(monthDate) {
        return buildFixedTransactions({
          envelopeId: this.id,
          monthDate,
          transactionPrefix: "transport",
          entries: [
            { label: "Essence", amount: 44, day: 1 },
            { label: "Parking", amount: 14, day: 2 },
            { label: "Plein station", amount: 51, day: 4 },
            { label: "Recharge transport", amount: 19, day: 6 },
            { label: "Essence", amount: 28, day: 8 },
          ],
        });
      },
      historicalTotals: [175, 182, 188, 195],
    },
    {
      id: `${SEED_PREFIX}-env-loisirs`,
      name: "Loisirs",
      icon: "Gamepad2",
      color: "bg-purple-500",
      budget: 260,
      order: 2,
      buildHistorical(monthDate, total) {
        return buildWeightedTransactions({
          envelopeId: this.id,
          monthDate,
          total,
          transactionPrefix: "loisirs",
          pattern: [
            { label: "Cinema", day: 3, weight: 0.18 },
            { label: "Jeu mobile", day: 7, weight: 0.14 },
            { label: "Librairie", day: 12, weight: 0.2 },
            { label: "Streaming evenement", day: 18, weight: 0.16 },
            { label: "Sortie parc", day: 22, weight: 0.14 },
            { label: "Petit plaisir", day: 27, weight: 0.18 },
          ],
        });
      },
      buildCurrent(monthDate) {
        return buildFixedTransactions({
          envelopeId: this.id,
          monthDate,
          transactionPrefix: "loisirs",
          entries: [
            { label: "Cinema", amount: 18, day: 2 },
            { label: "Jeu mobile", amount: 12, day: 4 },
            { label: "Librairie", amount: 22, day: 7 },
          ],
        });
      },
      historicalTotals: [72, 88, 81, 95],
    },
    {
      id: `${SEED_PREFIX}-env-abonnements`,
      name: "Abonnements",
      icon: "Music",
      color: "bg-pink-500",
      budget: 90,
      order: 3,
      buildHistorical(monthDate) {
        return buildFixedTransactions({
          envelopeId: this.id,
          monthDate,
          transactionPrefix: "abonnements",
          entries: [
            { label: "Netflix Premium", amount: 22.99, day: 1 },
            { label: "Spotify", amount: 11.99, day: 2 },
            { label: "Salle de sport", amount: 39.9, day: 4 },
            { label: "Adobe Creative Cloud", amount: 28.5, day: 6 },
            { label: "iCloud+", amount: 9.99, day: 8 },
          ],
        });
      },
      buildCurrent(monthDate) {
        return this.buildHistorical(monthDate);
      },
      historicalTotals: [0, 0, 0, 0],
    },
    {
      id: `${SEED_PREFIX}-env-sante`,
      name: "Sante",
      icon: "Heart",
      color: "bg-red-500",
      budget: 150,
      order: 4,
      buildHistorical(monthDate, _total, monthIndex) {
        const historicalEntries = [
          [
            { label: "Pharmacie", amount: 12, day: 5 },
            { label: "Medecin generaliste", amount: 14, day: 19 },
          ],
          [
            { label: "Pharmacie", amount: 18, day: 8 },
          ],
          [
            { label: "Pharmacie", amount: 16, day: 3 },
            { label: "Laboratoire", amount: 18, day: 16 },
          ],
          [
            { label: "Opticien", amount: 22, day: 10 },
          ],
        ];

        return buildFixedTransactions({
          envelopeId: this.id,
          monthDate,
          transactionPrefix: "sante",
          entries: historicalEntries[monthIndex],
        });
      },
      buildCurrent(monthDate) {
        return buildFixedTransactions({
          envelopeId: this.id,
          monthDate,
          transactionPrefix: "sante",
          entries: [
            { label: "Dentiste urgence", amount: 240, day: 2 },
            { label: "Pharmacie", amount: 24, day: 5 },
            { label: "Medecin specialiste", amount: 18, day: 8 },
          ],
        });
      },
      historicalTotals: [26, 18, 34, 22],
    },
    {
      id: `${SEED_PREFIX}-env-maison`,
      name: "Maison",
      icon: "Hammer",
      color: "bg-emerald-500",
      budget: 320,
      order: 5,
      buildHistorical(monthDate, total) {
        return buildWeightedTransactions({
          envelopeId: this.id,
          monthDate,
          total,
          transactionPrefix: "maison",
          pattern: [
            { label: "Bricolage", day: 2, weight: 0.16 },
            { label: "Entretien maison", day: 6, weight: 0.14 },
            { label: "Petite reparation", day: 11, weight: 0.18 },
            { label: "Decorations", day: 15, weight: 0.12 },
            { label: "Rangement", day: 20, weight: 0.18 },
            { label: "Maison du quotidien", day: 26, weight: 0.22 },
          ],
        });
      },
      buildCurrent(monthDate) {
        return buildFixedTransactions({
          envelopeId: this.id,
          monthDate,
          transactionPrefix: "maison",
          entries: [
            { label: "Bricolage", amount: 28, day: 1 },
            { label: "Entretien maison", amount: 16, day: 3 },
            { label: "Petite reparation", amount: 21, day: 4 },
            { label: "Maison du quotidien", amount: 53, day: 8 },
          ],
        });
      },
      historicalTotals: [252, 267, 281, 259],
    },
    {
      id: `${SEED_PREFIX}-env-sorties`,
      name: "Sorties",
      icon: "Coffee",
      color: "bg-amber-500",
      budget: 220,
      order: 6,
      buildHistorical(monthDate, total) {
        return buildWeightedTransactions({
          envelopeId: this.id,
          monthDate,
          total,
          transactionPrefix: "sorties",
          pattern: [
            { label: "Restaurant", day: 2, weight: 0.24 },
            { label: "Cafe", day: 5, weight: 0.1 },
            { label: "Afterwork", day: 9, weight: 0.16 },
            { label: "Livraison", day: 13, weight: 0.18 },
            { label: "Dejeuner exterieur", day: 18, weight: 0.14 },
            { label: "Brunch", day: 24, weight: 0.18 },
          ],
        });
      },
      buildCurrent(monthDate) {
        return buildFixedTransactions({
          envelopeId: this.id,
          monthDate,
          transactionPrefix: "sorties",
          entries: [
            { label: "Restaurant", amount: 46, day: 1 },
            { label: "Cafe", amount: 18, day: 2 },
            { label: "Afterwork", amount: 39, day: 3 },
            { label: "Livraison", amount: 44, day: 4 },
            { label: "Dejeuner exterieur", amount: 31, day: 6 },
            { label: "Brunch", amount: 52, day: 7 },
            { label: "Restaurant", amount: 54, day: 8 },
          ],
        });
      },
      historicalTotals: [162, 178, 185, 171],
    },
  ];

  const transactions = [];
  const currentSpentByEnvelope = {};
  const monthBreakdown = {};

  for (const context of monthContexts) {
    monthBreakdown[context.monthKey] = {};
  }

  envelopePlans.forEach((plan) => {
    monthContexts.forEach((context, contextIndex) => {
      const monthTransactions = context.isCurrentMonth
        ? plan.buildCurrent(context.monthDate)
        : plan.buildHistorical(
            context.monthDate,
            plan.historicalTotals[contextIndex],
            contextIndex
          );

      const monthTotal = roundCurrency(
        monthTransactions.reduce((sum, transaction) => sum + transaction.amount, 0)
      );

      monthBreakdown[context.monthKey][plan.name] = monthTotal;

      if (context.isCurrentMonth) {
        currentSpentByEnvelope[plan.id] = monthTotal;
      }

      transactions.push(...monthTransactions);
    });
  });

  transactions.sort((left, right) => left.date.localeCompare(right.date));

  const oldestMonthStart = startOfMonth(monthContexts[0].monthDate).toISOString();
  const nowIso = new Date().toISOString();
  const dailyActivity = createActivityDocs(monthContexts, today);

  const envelopes = envelopePlans.map((plan) => ({
    id: plan.id,
    data: {
      name: plan.name,
      icon: plan.icon,
      color: plan.color,
      budget: plan.budget,
      spent: currentSpentByEnvelope[plan.id] || 0,
      order: plan.order,
      createdAt: oldestMonthStart,
    },
  }));

  return {
    monthContexts,
    envelopes,
    transactions,
    dailyActivity,
    settings: {
      monthlyIncome: 4200,
      fixedCosts: 1500,
      monthlySavings: 500,
      currency: "EUR",
      isOnboarded: true,
      createdAt: oldestMonthStart,
      updatedAt: nowIso,
    },
    monthBreakdown,
  };
}

function resolveFirebaseCredential(targetEnv) {
  // SEC-25 : comptes de service déplacés hors de l'arbre du projet par
  // scripts/migrate-secrets.js — emplacement externe en priorité, repli
  // sur les emplacements historiques.
  const serviceAccountCandidates = [
    path.join(getSecretsDir(), "service-accounts", `service-account-${targetEnv}.json`),
    path.join(getSecretsDir(), "service-accounts", "service-account.json"),
    path.resolve(__dirname, `service-account-${targetEnv}.json`),
    path.resolve(__dirname, "service-account.json"),
  ];

  let credential;
  let serviceAccount = null;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
    console.log("🔑 Credentials : GOOGLE_APPLICATION_CREDENTIALS");
  } else {
    const found = serviceAccountCandidates.find(fs.existsSync);
    if (!found) {
      console.error(
        `❌ Aucune credential trouvée pour --env ${targetEnv}.\n` +
          `   → Attendu : ${getSecretsDir()}/service-accounts/service-account-${targetEnv}.json\n` +
          `     ou scripts/service-account-${targetEnv}.json (emplacement historique)\n` +
          "   → ou définissez GOOGLE_APPLICATION_CREDENTIALS"
      );
      process.exit(1);
    }

    serviceAccount = JSON.parse(fs.readFileSync(found, "utf8"));
    credential = admin.credential.cert(serviceAccount);
    console.log(`🔑 Credentials : ${path.basename(found)}  (--env ${targetEnv})`);
  }

  return {
    credential,
    serviceAccount,
  };
}

async function deleteDocumentsInChunks(documents, label) {
  if (documents.length === 0) {
    console.log(`🧹 ${label} : rien à supprimer`);
    return;
  }

  if (isDryRun) {
    console.log(`🧹 [dry-run] ${label} : ${documents.length} document(s) seraient supprimé(s)`);
    return;
  }

  for (let index = 0; index < documents.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = documents.slice(index, index + BATCH_LIMIT);

    chunk.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
  }

  console.log(`🧹 ${label} : ${documents.length} document(s) supprimé(s)`);
}

async function writeDocumentsInChunks(operations, label) {
  if (operations.length === 0) {
    console.log(`✍️ ${label} : aucune écriture`);
    return;
  }

  if (isDryRun) {
    console.log(`✍️ [dry-run] ${label} : ${operations.length} document(s) seraient écrits`);
    return;
  }

  for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = operations.slice(index, index + BATCH_LIMIT);

    chunk.forEach((operation) => {
      if (operation.options) {
        batch.set(operation.ref, operation.data, operation.options);
      } else {
        batch.set(operation.ref, operation.data);
      }
    });

    await batch.commit();
  }

  console.log(`✍️ ${label} : ${operations.length} document(s) écrits`);
}

function logDatasetSummary(dataset) {
  const currentMonthKey = dataset.monthContexts[dataset.monthContexts.length - 1].monthKey;
  const currentMonthEnvelopeSpend = dataset.envelopes
    .slice()
    .sort((left, right) => left.data.order - right.data.order)
    .map((envelope) => `${envelope.data.name}: ${formatCurrency(envelope.data.spent)}`);

  console.log(`\n📦 Jeu de données prêt pour ${userId}`);
  console.log(`📅 Fenêtre : ${dataset.monthContexts[0].monthKey} → ${currentMonthKey}`);
  console.log(`📊 Enveloppes : ${dataset.envelopes.length}`);
  console.log(`🧾 Transactions : ${dataset.transactions.length}`);
  console.log(`🔥 Daily activity : ${dataset.dailyActivity.length} jours`);
  console.log(`💶 Dépenses mois courant : ${currentMonthEnvelopeSpend.join(" | ")}`);

  console.log("\n📈 Répartition mensuelle :");
  Object.entries(dataset.monthBreakdown).forEach(([monthKey, envelopeTotals]) => {
    const line = Object.entries(envelopeTotals)
      .map(([name, total]) => `${name} ${formatCurrency(total)}`)
      .join(" | ");
    console.log(`  - ${monthKey}: ${line}`);
  });

  console.log("");
}

let db;

async function main() {
  const { credential, serviceAccount } = resolveFirebaseCredential(env);
  const envProjectId = process.env.FIREBASE_PROJECT_ID || null;
  const projectId =
    customProjectId ||
    serviceAccount?.project_id ||
    envProjectId ||
    "budgetflow-86842";

  if (
    !customProjectId &&
    serviceAccount?.project_id &&
    envProjectId &&
    serviceAccount.project_id !== envProjectId
  ) {
    console.log(
      `⚠️ FIREBASE_PROJECT_ID=${envProjectId} ignoré : le compte de service cible ${serviceAccount.project_id}.`
    );
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential, projectId });
  }

  db = admin.firestore();

  const dataset = buildSeedDataset(anchorDate);
  logDatasetSummary(dataset);

  console.log(`🎯 Projet Firebase : ${projectId}`);
  console.log(`👤 Utilisateur : ${userId}`);
  console.log(`🧪 Mode : ${isDryRun ? "dry-run" : "écriture réelle"}`);
  console.log(`🧹 Replace existing : ${replaceExisting ? "oui" : "non"}`);

  const userRef = db.collection("users").doc(userId);
  const settingsRef = userRef.collection("settings").doc("general");
  const envelopesRef = userRef.collection("envelopes");
  const transactionsRef = userRef.collection("transactions");
  const dailyActivityRef = userRef.collection("dailyActivity");

  const [userSnap, existingEnvelopesSnap, existingTransactionsSnap, existingActivitySnap] =
    await Promise.all([
      userRef.get(),
      envelopesRef.get(),
      transactionsRef.get(),
      replaceExisting ? dailyActivityRef.get() : Promise.resolve(null),
    ]);

  const existingUserData = userSnap.exists ? userSnap.data() : {};
  const nowIso = new Date().toISOString();

  const userProfile = {
    displayName:
      typeof existingUserData.displayName === "string" && existingUserData.displayName.trim()
        ? existingUserData.displayName
        : `BudgetFlow Test ${userId.slice(0, 6)}`,
    email:
      typeof existingUserData.email === "string" && existingUserData.email.trim()
        ? existingUserData.email
        : `${userId.slice(0, 12)}@budgetflow.test`,
    photoURL: typeof existingUserData.photoURL === "string" ? existingUserData.photoURL : "",
    notificationsEnabled:
      typeof existingUserData.notificationsEnabled === "boolean"
        ? existingUserData.notificationsEnabled
        : false,
    lastLogin: nowIso,
    lastTokenUpdate:
      typeof existingUserData.lastTokenUpdate === "string"
        ? existingUserData.lastTokenUpdate
        : nowIso,
  };

  const seedEnvelopeIds = new Set(dataset.envelopes.map((envelope) => envelope.id));
  const seedTransactionIds = new Set(dataset.transactions.map((transaction) => transaction.id));

  const envelopesToDelete = replaceExisting
    ? existingEnvelopesSnap.docs
    : existingEnvelopesSnap.docs.filter((docSnap) => seedEnvelopeIds.has(docSnap.id));
  const transactionsToDelete = replaceExisting
    ? existingTransactionsSnap.docs
    : existingTransactionsSnap.docs.filter((docSnap) => seedTransactionIds.has(docSnap.id));
  const activityToDelete = replaceExisting && existingActivitySnap ? existingActivitySnap.docs : [];

  await deleteDocumentsInChunks(envelopesToDelete, "Enveloppes");
  await deleteDocumentsInChunks(transactionsToDelete, "Transactions");
  await deleteDocumentsInChunks(activityToDelete, "Daily activity");

  const writeOperations = [
    {
      ref: userRef,
      data: userProfile,
      options: { merge: true },
    },
    {
      ref: settingsRef,
      data: dataset.settings,
      options: { merge: true },
    },
  ];

  dataset.envelopes.forEach((envelope) => {
    writeOperations.push({
      ref: envelopesRef.doc(envelope.id),
      data: envelope.data,
      options: undefined,
    });
  });

  dataset.transactions.forEach((transaction) => {
    writeOperations.push({
      ref: transactionsRef.doc(transaction.id),
      data: {
        amount: transaction.amount,
        description: transaction.description,
        envelopeId: transaction.envelopeId,
        date: transaction.date,
        createdAt: transaction.createdAt,
      },
      options: undefined,
    });
  });

  dataset.dailyActivity.forEach((entry) => {
    writeOperations.push({
      ref: dailyActivityRef.doc(entry.id),
      data: entry.data,
      options: undefined,
    });
  });

  await writeDocumentsInChunks(writeOperations, "Seed global");

  console.log(
    `\n✅ ${isDryRun ? "Simulation terminée" : "Jeu de données injecté"} pour ${userId}.`
  );
  console.log(
    replaceExisting
      ? "ℹ️ Les enveloppes, transactions et jours d'activité existants ont été remplacés."
      : "ℹ️ Les documents seedés ont été écrits avec des IDs stables sans supprimer les autres données du user."
  );
  console.log(
    "💡 Pour un compte de test totalement propre, relancez avec --confirm --replace-existing."
  );
}

main().catch((error) => {
  console.error("\n❌ Erreur fatale :", error.message);
  process.exit(1);
});
