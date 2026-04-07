#!/usr/bin/env node
/**
 * migrate-user-from-backup-to-prod.js
 *
 * Copie les donnees d'un utilisateur present dans un backup JSON (dev)
 * vers un utilisateur cible dans Firestore production.
 *
 * Credentials utilises : scripts/service-account-prod.json
 *
 * Usage:
 *   node scripts/migrate-user-from-backup-to-prod.js
 *   node scripts/migrate-user-from-backup-to-prod.js --input ./backups/backup-2026-03-26T16-56-45_full.json
 *   node scripts/migrate-user-from-backup-to-prod.js --input ./backups/backup.json --source-user <devUserId> --target-user <prodUserId>
 *   node scripts/migrate-user-from-backup-to-prod.js --input ./backups/backup.json --source-user <devUserId> --target-user <prodUserId> --yes
 *   node scripts/migrate-user-from-backup-to-prod.js --include-profile
 *
 * Notes:
 * - Par defaut, les champs profil sensibles de l'utilisateur cible sont conserves
 *   (email, displayName, photoURL, lastLogin, fcmToken, notificationsEnabled, lastTokenUpdate).
 * - Les documents existants dans les sous-collections cible qui ne sont pas dans la source
 *   ne sont pas supprimes.
 */

"use strict";

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const INPUT_ARG = getArg("--input");
const SOURCE_USER_ARG = getArg("--source-user");
const TARGET_USER_ARG = getArg("--target-user");
const AUTO_CONFIRM = hasFlag("--yes");
const INCLUDE_PROFILE = hasFlag("--include-profile");

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "service-account-prod.json");
const BACKUPS_DIR = path.resolve(__dirname, "..", "backups");

const PROFILE_KEYS_TO_PRESERVE = new Set([
  "email",
  "displayName",
  "photoURL",
  "lastLogin",
  "fcmToken",
  "notificationsEnabled",
  "lastTokenUpdate",
]);

function getLatestBackupFile() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    return null;
  }

  const files = fs
    .readdirSync(BACKUPS_DIR)
    .filter((name) => name.endsWith(".json") && name.startsWith("backup-"))
    .map((name) => {
      const fullPath = path.join(BACKUPS_DIR, name);
      const stat = fs.statSync(fullPath);
      return { name, fullPath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files.length > 0 ? files[0].fullPath : null;
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function deserializeData(data, db) {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    // Keep date strings exactly as stored in backup (app expects strings).
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => deserializeData(item, db));
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
      result[key] = deserializeData(value, db);
    }
    return result;
  }

  return data;
}

function collectStats(node) {
  let docs = 0;
  let collections = 0;

  if (!node || typeof node !== "object") {
    return { docs, collections };
  }

  for (const docObj of Object.values(node)) {
    docs += 1;
    if (docObj && docObj.collections && typeof docObj.collections === "object") {
      for (const subColData of Object.values(docObj.collections)) {
        collections += 1;
        const nested = collectStats(subColData);
        docs += nested.docs;
        collections += nested.collections;
      }
    }
  }

  return { docs, collections };
}

async function writeCollectionRecursive(colRef, colData, db, counters) {
  const entries = Object.entries(colData || {});
  if (entries.length === 0) {
    return;
  }

  counters.collections += 1;

  for (let i = 0; i < entries.length; i += 450) {
    const chunk = entries.slice(i, i + 450);
    const batch = db.batch();

    for (const [docId, docObj] of chunk) {
      const docRef = colRef.doc(docId);
      const payload = deserializeData(docObj.data || {}, db);
      batch.set(docRef, payload, { merge: false });
      counters.docs += 1;
    }

    await batch.commit();
  }

  for (const [docId, docObj] of entries) {
    const nestedCols = docObj.collections || {};
    for (const [subColId, subColData] of Object.entries(nestedCols)) {
      await writeCollectionRecursive(colRef.doc(docId).collection(subColId), subColData, db, counters);
    }
  }
}

function buildTargetRootData(sourceRootData, targetRootData) {
  if (INCLUDE_PROFILE) {
    return sourceRootData;
  }

  const result = { ...sourceRootData };
  for (const key of PROFILE_KEYS_TO_PRESERVE) {
    if (Object.prototype.hasOwnProperty.call(targetRootData, key)) {
      result[key] = targetRootData[key];
    }
  }
  return result;
}

async function main() {
  console.log("\nBudgetFlow - Migration user backup -> prod\n");

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("Erreur: fichier introuvable: " + SERVICE_ACCOUNT_PATH);
    process.exit(1);
  }

  const inputPath = INPUT_ARG
    ? path.resolve(process.cwd(), INPUT_ARG)
    : getLatestBackupFile();

  if (!inputPath) {
    console.error("Erreur: aucun fichier backup trouve. Utilisez --input <chemin>.");
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error("Erreur: backup introuvable: " + inputPath);
    process.exit(1);
  }

  let backup;
  try {
    backup = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  } catch (err) {
    console.error("Erreur: impossible de lire le backup JSON: " + err.message);
    process.exit(1);
  }

  if (!backup || !backup.collections || !backup.collections.users) {
    console.error("Erreur: format backup invalide (collections.users manquant).");
    process.exit(1);
  }

  const sourceUserId = SOURCE_USER_ARG || (await ask("UserId source (dans le backup dev): "));
  const targetUserId = TARGET_USER_ARG || (await ask("UserId cible (en prod): "));

  if (!sourceUserId || !targetUserId) {
    console.error("Erreur: source-user et target-user sont requis.");
    process.exit(1);
  }

  const sourceUser = backup.collections.users[sourceUserId];
  if (!sourceUser) {
    const available = Object.keys(backup.collections.users);
    const sample = available.slice(0, 15).join(", ");
    console.error("Erreur: user source absent du backup: " + sourceUserId);
    console.error("Users disponibles (extrait): " + sample + (available.length > 15 ? " ..." : ""));
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  const projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || "budgetflow-86842";

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  }

  const db = admin.firestore();

  const sourceRoot = sourceUser.data || {};
  const sourceSubcollections = sourceUser.collections || {};

  const targetRef = db.collection("users").doc(targetUserId);
  const targetSnap = await targetRef.get();
  const targetRoot = targetSnap.exists ? targetSnap.data() : {};

  const rootToWrite = deserializeData(buildTargetRootData(sourceRoot, targetRoot), db);
  const stats = collectStats(sourceSubcollections);

  console.log("Backup   : " + inputPath);
  console.log("Projet   : " + projectId + " (prod)");
  console.log("Source   : users/" + sourceUserId);
  console.log("Cible    : users/" + targetUserId);
  console.log("Profil   : " + (INCLUDE_PROFILE ? "copie complete du document user" : "conserve les champs profil de la cible"));
  console.log("Ecritures: 1 document racine + " + stats.docs + " documents de sous-collections");

  if (!AUTO_CONFIRM) {
    const answer = await ask('Confirmer la migration en production ? Tapez "MIGRER" pour continuer: ');
    if (answer !== "MIGRER") {
      console.log("Operation annulee.");
      process.exit(0);
    }
  }

  await targetRef.set(rootToWrite, { merge: true });

  const counters = { docs: 0, collections: 0 };
  for (const [subColId, subColData] of Object.entries(sourceSubcollections)) {
    await writeCollectionRecursive(targetRef.collection(subColId), subColData, db, counters);
  }

  console.log("\nMigration terminee.");
  console.log("Document racine ecrit: users/" + targetUserId);
  console.log("Documents sous-collections ecrits: " + counters.docs);
  console.log("Sous-collections traversees: " + counters.collections);
  console.log("\nImportant: les documents existants cote cible qui ne sont pas dans le backup n'ont pas ete supprimes.");
  console.log("Si vous voulez un miroir strict, il faut nettoyer la cible avant injection.");
  console.log("");
}

main().catch((err) => {
  console.error("\nErreur fatale: " + err.message);
  process.exit(1);
});
