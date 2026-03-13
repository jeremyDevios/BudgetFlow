#!/usr/bin/env node
/**
 * restore-firestore.js
 *
 * Réimporte un backup JSON dans Firestore.
 *
 * ⚠️  PAR DÉFAUT : mode --dry-run (simulation, aucune écriture).
 * ⚠️  Pour écrire réellement, ajouter les flags : --confirm --overwrite ou --confirm --merge
 *
 * Usage :
 *   # Simuler (sans toucher la base) :
 *   node scripts/restore-firestore.js --input ./backups/backup-2026-03-10T...json
 *
 *   # Restaurer en écrasant les documents existants :
 *   node scripts/restore-firestore.js --input ./backups/backup-2026-03-10T...json --confirm --overwrite
 *
 *   # Restaurer en fusionnant (merge) — préserve les champs non présents dans le backup :
 *   node scripts/restore-firestore.js --input ./backups/backup-2026-03-10T...json --confirm --merge
 *
 *   # Restaurer uniquement un utilisateur précis :
 *   node scripts/restore-firestore.js --input ./backups/... --user <userId> --confirm --overwrite
 *
 *   # Cibler un projet Firebase différent (ex : environnement de staging) :
 *   node scripts/restore-firestore.js --input ./backups/... --project autre-projet --confirm --overwrite
 *
 * Modes d'écriture :
 *   --overwrite   set()     → remplace entièrement chaque document
 *   --merge       set(…, {merge:true}) → fusionne avec les données existantes
 *
 * Prérequis :
 *   Même que backup-firestore.js (service-account.json ou GOOGLE_APPLICATION_CREDENTIALS)
 */

"use strict";

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ─── Arguments CLI ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const inputFile = getArg("--input");
const targetUserId = getArg("--user") || null;
const customProjectId = getArg("--project") || null;
const isDryRun = !hasFlag("--confirm");
const useOverwrite = hasFlag("--overwrite");
const useMerge = hasFlag("--merge");

if (!inputFile) {
  console.error("❌ --input <fichier.json> est requis.");
  console.error("   Usage : node scripts/restore-firestore.js --input ./backups/backup-xxx.json");
  process.exit(1);
}

if (!isDryRun && !useOverwrite && !useMerge) {
  console.error("❌ Avec --confirm, vous devez choisir --overwrite ou --merge.");
  process.exit(1);
}

if (useOverwrite && useMerge) {
  console.error("❌ --overwrite et --merge sont mutuellement exclusifs.");
  process.exit(1);
}

// ─── Chargement du backup ─────────────────────────────────────────────────────

const resolvedInput = path.resolve(process.cwd(), inputFile);
if (!fs.existsSync(resolvedInput)) {
  console.error(`❌ Fichier introuvable : ${resolvedInput}`);
  process.exit(1);
}

let backup;
try {
  backup = JSON.parse(fs.readFileSync(resolvedInput, "utf8"));
} catch (err) {
  console.error("❌ Impossible de lire le fichier JSON :", err.message);
  process.exit(1);
}

const { metadata, collections } = backup;

if (!metadata || !collections) {
  console.error("❌ Format de backup invalide (metadata ou collections manquants).");
  process.exit(1);
}

// ─── Initialisation Firebase Admin ───────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "service-account.json");

let credential;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  credential = admin.credential.applicationDefault();
} else if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  credential = admin.credential.cert(serviceAccount);
} else {
  console.error(
    "❌ Aucune credential trouvée.\n" +
    "   → Placez votre clé de service sous scripts/service-account.json"
  );
  process.exit(1);
}

const projectId = customProjectId || process.env.FIREBASE_PROJECT_ID || "budgetflow-86842";

if (!admin.apps.length) {
  admin.initializeApp({ credential, projectId });
}

const db = admin.firestore();

// ─── Désérialisation ──────────────────────────────────────────────────────────

/**
 * Reconvertit les types sérialisés (ISO 8601 → Timestamp, etc.)
 */
function deserializeDocData(data) {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    // Reconvertit les dates ISO 8601 en Timestamps Firestore
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(data)) {
      return admin.firestore.Timestamp.fromDate(new Date(data));
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(deserializeDocData);
  }

  if (typeof data === "object") {
    if (data.__type === "DocumentReference") {
      return db.doc(data.path);
    }
    if (data.__type === "GeoPoint") {
      return new admin.firestore.GeoPoint(data.latitude, data.longitude);
    }

    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = deserializeDocData(value);
    }
    return result;
  }

  return data;
}

// ─── Compteurs ────────────────────────────────────────────────────────────────

let counters = { docs: 0, collections: 0, errors: 0 };

// ─── Logique de restauration ──────────────────────────────────────────────────

/**
 * Restaure récursivement une collection depuis un objet backup.
 * @param {FirebaseFirestore.CollectionReference} colRef
 * @param {Object} colData  — objet { [docId]: { data, collections } }
 * @param {string} mergeMode — "overwrite" | "merge"
 * @param {WriteBatch[]} batches — tableau de batches en cours
 * @param {number} depth
 */
async function restoreCollection(colRef, colData, mergeMode, batches, depth = 0) {
  const pad = "  ".repeat(depth);
  counters.collections++;

  // Firestore batch : max 500 opérations par batch
  let currentBatch = batches[batches.length - 1];
  let batchOpsCount = batches.reduce((_, b) => b._opCount ?? 0, 0);

  for (const [docId, docObj] of Object.entries(colData)) {
    const docRef = colRef.doc(docId);
    const rawData = docObj.data || {};
    const deserializedData = deserializeDocData(rawData);

    if (isDryRun) {
      console.log(`${pad}  [DRY-RUN] Écriture ${mergeMode.toUpperCase()} → ${docRef.path}`);
    } else {
      // Rotation du batch si proche de la limite
      if (batchOpsCount >= 490) {
        batches.push(db.batch());
        currentBatch = batches[batches.length - 1];
        batchOpsCount = 0;
      }

      if (mergeMode === "merge") {
        currentBatch.set(docRef, deserializedData, { merge: true });
      } else {
        currentBatch.set(docRef, deserializedData);
      }
      batchOpsCount++;
    }

    counters.docs++;

    // Sous-collections
    if (docObj.collections) {
      for (const [subColId, subColData] of Object.entries(docObj.collections)) {
        console.log(`${pad}    📁 ${subColId}/`);
        await restoreCollection(
          docRef.collection(subColId),
          subColData,
          mergeMode,
          batches,
          depth + 1
        );
      }
    }
  }
}

// ─── Confirmation interactive ─────────────────────────────────────────────────

function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ─── Script principal ─────────────────────────────────────────────────────────

async function main() {
  const writeMode = isDryRun ? "DRY-RUN (simulation)" : useOverwrite ? "OVERWRITE (écrasement)" : "MERGE (fusion)";

  console.log(`\n🔥 BudgetFlow — Restore Firestore`);
  console.log(`   Fichier backup : ${resolvedInput}`);
  console.log(`   Backup du      : ${metadata.timestamp}`);
  console.log(`   Projet source  : ${metadata.projectId}`);
  console.log(`   Projet cible   : ${projectId}`);
  console.log(`   Mode           : ${writeMode}`);
  if (targetUserId) {
    console.log(`   Utilisateur    : ${targetUserId}`);
  }
  console.log("");

  if (isDryRun) {
    console.log("ℹ️  Mode simulation : aucune donnée ne sera écrite.");
    console.log("   Ajoutez --confirm --overwrite ou --confirm --merge pour écrire.\n");
  }

  // Confirmation obligatoire si écriture réelle sur le projet de production
  if (!isDryRun && projectId === metadata.projectId) {
    console.warn(
      "⚠️  ATTENTION : vous restaurez vers le MÊME projet que le backup (" + projectId + ").\n" +
      "   Les données existantes seront " + (useOverwrite ? "ÉCRASÉES" : "fusionnées") + "."
    );
    const answer = await askConfirmation(
      '   Tapez "RESTAURER" pour confirmer, ou autre chose pour annuler : '
    );
    if (answer !== "restaurer") {
      console.log("⛔ Restauration annulée.");
      process.exit(0);
    }
    console.log("");
  }

  const mergeMode = useMerge ? "merge" : "overwrite";
  const batches = [db.batch()];
  const collectionsToRestore = {};

  // Filtrage par utilisateur si demandé
  if (targetUserId && collections.users) {
    if (!collections.users[targetUserId]) {
      console.error(`❌ L'utilisateur ${targetUserId} n'est pas présent dans ce backup.`);
      console.error("   Utilisateurs disponibles :", Object.keys(collections.users).join(", "));
      process.exit(1);
    }
    collectionsToRestore.users = { [targetUserId]: collections.users[targetUserId] };
  } else {
    Object.assign(collectionsToRestore, collections);
  }

  // Parcours des collections racines
  for (const [colId, colData] of Object.entries(collectionsToRestore)) {
    console.log(`\n📁 ${colId}/`);
    await restoreCollection(db.collection(colId), colData, mergeMode, batches);
  }

  // Envoi des batches
  if (!isDryRun) {
    console.log(`\n⬆️  Envoi de ${batches.length} batch(es) vers Firestore…`);
    for (let i = 0; i < batches.length; i++) {
      try {
        await batches[i].commit();
        process.stdout.write(`   Batch ${i + 1}/${batches.length} ✅\n`);
      } catch (err) {
        console.error(`   Batch ${i + 1}/${batches.length} ❌ :`, err.message);
        counters.errors++;
      }
    }
  }

  // Résumé
  console.log(`\n${isDryRun ? "✅ Simulation terminée" : counters.errors === 0 ? "✅ Restauration réussie" : "⚠️  Restauration terminée avec erreurs"}`);
  console.log(`   Documents traités : ${counters.docs}`);
  console.log(`   Collections       : ${counters.collections}`);
  if (!isDryRun) {
    console.log(`   Erreurs           : ${counters.errors}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Erreur fatale :", err.message);
  process.exit(1);
});
