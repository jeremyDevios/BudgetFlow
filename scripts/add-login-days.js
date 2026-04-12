#!/usr/bin/env node
/**
 * add-login-days.js
 *
 * Ajoute des jours de connexion dans la collection dailyActivity d'un utilisateur.
 * Chaque document créé suit la structure : { loggedIn: true, date: "YYYY-MM-DD" }
 *
 * Usage :
 *   node scripts/add-login-days.js --user <userId> --from 2026-03-01 --to 2026-04-11
 *   node scripts/add-login-days.js --user <userId> --date 2026-04-11
 *   node scripts/add-login-days.js --user <userId> --from 2026-03-01 --to 2026-04-11 --env dev
 *
 * Options :
 *   --user  <userId>     (obligatoire) UID Firebase de l'utilisateur
 *   --date  <YYYY-MM-DD> Ajouter un seul jour
 *   --from  <YYYY-MM-DD> Début de la plage (inclusif)
 *   --to    <YYYY-MM-DD> Fin de la plage (inclusif)
 *   --env   prod|dev     Environnement cible (défaut: prod)
 *   --dry-run            Affiche les jours sans écrire en base
 *
 * Prérequis :
 *   scripts/service-account.json  (clé de service Firebase — jamais committer)
 */

"use strict";

const admin = require("firebase-admin");
const fs    = require("fs");
const path  = require("path");

// ─── Arguments CLI ────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const hasFlag = (flag) => args.includes(flag);

const userId = getArg("--user");
const single = getArg("--date");
const from   = getArg("--from");
const to     = getArg("--to");
const dryRun = hasFlag("--dry-run");

if (!userId) {
  console.error("❌  --user <userId> est obligatoire.");
  process.exit(1);
}
if (!single && !(from && to)) {
  console.error("❌  Fournissez --date <YYYY-MM-DD>  ou  --from <YYYY-MM-DD> --to <YYYY-MM-DD>.");
  process.exit(1);
}

// ─── Initialisation Firebase Admin ───────────────────────────────────────────

const env = getArg("--env") || "prod"; // prod | dev
const SA_CANDIDATES = [
  path.resolve(__dirname, `service-account-${env}.json`),
  path.resolve(__dirname, "service-account.json"),
];

let credential;
let serviceAccount = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  credential = admin.credential.applicationDefault();
  console.log("🔑 Credentials : GOOGLE_APPLICATION_CREDENTIALS");
} else {
  const found = SA_CANDIDATES.find(fs.existsSync);
  if (!found) {
    console.error(
      `❌ Aucune credential trouvée pour --env ${env}.\n` +
      `   → Attendu : scripts/service-account-${env}.json  ou  scripts/service-account.json\n` +
      "   → ou définissez GOOGLE_APPLICATION_CREDENTIALS"
    );
    process.exit(1);
  }
  serviceAccount = JSON.parse(fs.readFileSync(found, "utf8"));
  credential = admin.credential.cert(serviceAccount);
  console.log(`🔑 Credentials : ${path.basename(found)}  (--env ${env})`);
}

const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id || "budgetflow-86842";

if (!admin.apps.length) {
  admin.initializeApp({ credential, projectId });
}

const db = admin.firestore();

// ─── Génération des dates ─────────────────────────────────────────────────────

function parseLocalDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildDateRange(fromStr, toStr) {
  const dates = [];
  const current = parseLocalDate(fromStr);
  const end     = parseLocalDate(toStr);
  while (current <= end) {
    dates.push(toDateString(new Date(current)));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

const dates = single ? [single] : buildDateRange(from, to);

if (dates.length === 0) {
  console.error("❌ Aucune date à ajouter (vérifiez que --from <= --to).");
  process.exit(1);
}

// ─── Écriture en base ─────────────────────────────────────────────────────────

async function run() {
  console.log(`\n👤 Utilisateur : ${userId}`);
  console.log(`📅 Jours à ajouter (${dates.length}) : ${dates[0]}${dates.length > 1 ? ` → ${dates[dates.length - 1]}` : ""}`);
  if (dryRun) console.log("🔍 Mode dry-run — aucune écriture.\n");

  let written = 0;
  let skipped = 0;

  for (const dateStr of dates) {
    const ref = db.collection("users").doc(userId).collection("dailyActivity").doc(dateStr);

    if (dryRun) {
      console.log(`  [dry-run] ${dateStr}`);
      continue;
    }

    try {
      const snap = await ref.get();
      if (snap.exists) {
        console.log(`  ⏭  ${dateStr}  (déjà présent)`);
        skipped++;
      } else {
        await ref.set({ loggedIn: true, date: dateStr });
        console.log(`  ✅ ${dateStr}`);
        written++;
      }
    } catch (err) {
      console.error(`  ❌ ${dateStr} — ${err.message}`);
    }
  }

  console.log(`\n✔  Terminé — ${written} écrit(s), ${skipped} ignoré(s) (déjà présents).`);
}

run().catch((err) => {
  console.error("❌ Erreur fatale :", err.message);
  process.exit(1);
});
