#!/usr/bin/env node
/**
 * backup-firestore.js
 *
 * Exporte toutes les données Firestore de BudgetFlow dans un fichier JSON local.
 * Ce script est EN LECTURE SEULE — aucune écriture sur la base de données.
 *
 * Usage :
 *   node scripts/backup-firestore.js
 *   node scripts/backup-firestore.js --output ./backups/custom-name.json
 *   node scripts/backup-firestore.js --user <userId>   ← backup d'un seul utilisateur
 *   node scripts/backup-firestore.js --env prod|dev
 *   node scripts/backup-firestore.js --project mon-projet-firebase
 *
 * Prérequis :
 *   1. Générer une clé de compte de service dans Firebase Console :
 *      Paramètres du projet → Comptes de service → Générer une nouvelle clé privée
 *   2. Sauvegarder le fichier JSON obtenu sous : scripts/service-account.json
 *      (ce fichier est ignoré par git — ne jamais le committer)
 *   3. Variables d'environnement (alternative à service-account.json) :
 *      GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/service-account.json
 *      FIREBASE_PROJECT_ID=budgetflow-86842
 */

"use strict";

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const { resolveFirebaseAdminConfig } = require("./firebase-admin-config");

// ─── Résolution des arguments CLI ────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

function printHelp() {
  console.log(`
🔥 BudgetFlow — Backup Firestore

Usage :
  node scripts/backup-firestore.js
  node scripts/backup-firestore.js --user <userId>
  node scripts/backup-firestore.js --output ./backups/mon-backup.json
  node scripts/backup-firestore.js --env prod
  node scripts/backup-firestore.js --project mon-projet-firebase

Options :
  --user <userId>       Backup d'un utilisateur précis
  --output <fichier>    Chemin du fichier JSON de sortie
  --env prod|dev        Choix de la clé scripts/service-account-*.json
  --project <projectId> Override explicite du projet Firebase
  --help                Affiche cette aide
`);
}

if (hasFlag("--help")) {
  printHelp();
  process.exit(0);
}

const targetUserId = getArg("--user") || null;
const customOutput = getArg("--output") || null;
const targetEnv = getArg("--env") || "prod";
const customProjectId = getArg("--project") || null;

// ─── Initialisation Firebase Admin ───────────────────────────────────────────

let resolvedConfig;
try {
  resolvedConfig = resolveFirebaseAdminConfig({
    env: targetEnv,
    customProjectId,
  });
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}

const { credential, credentialSource, projectId, warnings } = resolvedConfig;

console.log(`🔑 Credentials : ${credentialSource}${credentialSource !== "GOOGLE_APPLICATION_CREDENTIALS" ? `  (--env ${targetEnv})` : ""}`);
for (const warning of warnings) {
  console.log(`⚠️ ${warning}`);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential, projectId });
}

const db = admin.firestore();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sérialise un document Firestore : convertit les Timestamps en ISO 8601,
 * les DocumentReferences en chemin string, les GeoPoints en objet lat/lng.
 */
function serializeDocData(data) {
  if (data === null || data === undefined) return data;

  if (typeof data.toDate === "function") {
    // Firestore Timestamp
    return data.toDate().toISOString();
  }

  if (data instanceof admin.firestore.DocumentReference) {
    return { __type: "DocumentReference", path: data.path };
  }

  if (data instanceof admin.firestore.GeoPoint) {
    return { __type: "GeoPoint", latitude: data.latitude, longitude: data.longitude };
  }

  if (Array.isArray(data)) {
    return data.map(serializeDocData);
  }

  if (typeof data === "object") {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeDocData(value);
    }
    return result;
  }

  return data;
}

/**
 * Exporte une sous-collection complète d'un document parent.
 * Retourne un objet { [docId]: { data, subcollections } }
 */
async function exportCollection(collectionRef, depth = 0) {
  const snapshot = await collectionRef.get();
  const result = {};
  const pad = "  ".repeat(depth);

  for (const doc of snapshot.docs) {
    process.stdout.write(`${pad}  📄 ${doc.id}\n`);
    const docData = { data: serializeDocData(doc.data()) };

    // Récupère les sous-collections (recursif, max profondeur raisonnable)
    if (depth < 3) {
      const subCollections = await doc.ref.listCollections();
      if (subCollections.length > 0) {
        docData.collections = {};
        for (const subCol of subCollections) {
          process.stdout.write(`${pad}    📁 ${subCol.id}/\n`);
          docData.collections[subCol.id] = await exportCollection(subCol, depth + 1);
        }
      }
    }

    result[doc.id] = docData;
  }

  return result;
}

// ─── Script principal ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔥 BudgetFlow — Backup Firestore`);
  console.log(`   Projet : ${projectId}`);
  if (targetUserId) {
    console.log(`   Utilisateur ciblé : ${targetUserId}`);
  }
  console.log("");

  const backup = {
    metadata: {
      timestamp: new Date().toISOString(),
      projectId,
      version: "1.0",
      targetUserId: targetUserId || "all",
      tool: "backup-firestore.js",
    },
    collections: {},
  };

  // Liste les collections racines
  let rootCollections;
  try {
    rootCollections = await db.listCollections();
  } catch (err) {
    console.error("❌ Impossible de lister les collections. Vérifiez les permissions du compte de service.");
    console.error("   Détail :", err.message);
    process.exit(1);
  }

  for (const colRef of rootCollections) {
    const colId = colRef.id;
    console.log(`📁 Collection : ${colId}/`);

    if (colId === "users" && targetUserId) {
      // Mode single-user : on ne récupère que ce document
      const userDocRef = db.collection("users").doc(targetUserId);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        console.error(`❌ L'utilisateur ${targetUserId} n'existe pas dans Firestore.`);
        process.exit(1);
      }

      const docData = { data: serializeDocData(userDoc.data()) };
      const subCollections = await userDocRef.listCollections();

      if (subCollections.length > 0) {
        docData.collections = {};
        for (const subCol of subCollections) {
          console.log(`  📁 ${subCol.id}/`);
          docData.collections[subCol.id] = await exportCollection(subCol, 1);
        }
      }

      backup.collections["users"] = { [targetUserId]: docData };
    } else {
      backup.collections[colId] = await exportCollection(colRef, 0);
    }
  }

  // ─── Écriture du fichier ───────────────────────────────────────────────────

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = targetUserId ? `_user-${targetUserId.slice(0, 8)}` : "_full";
  const defaultFilename = `backup-${timestamp}${suffix}.json`;

  const backupsDir = path.resolve(__dirname, "..", "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const outputPath = customOutput
    ? path.resolve(process.cwd(), customOutput)
    : path.join(backupsDir, defaultFilename);

  const json = JSON.stringify(backup, null, 2);
  fs.writeFileSync(outputPath, json, "utf8");

  const sizeKB = (Buffer.byteLength(json, "utf8") / 1024).toFixed(1);

  console.log(`\n✅ Backup terminé !`);
  console.log(`   Fichier : ${outputPath}`);
  console.log(`   Taille  : ${sizeKB} KB`);

  // Résumé
  const usersExported = backup.collections.users
    ? Object.keys(backup.collections.users).length
    : 0;
  console.log(`   Utilisateurs : ${usersExported}`);

  if (backup.collections.users) {
    for (const [uid, userData] of Object.entries(backup.collections.users)) {
      const envelopes = userData.collections?.envelopes
        ? Object.keys(userData.collections.envelopes).length
        : 0;
      const transactions = userData.collections?.transactions
        ? Object.keys(userData.collections.transactions).length
        : 0;
      console.log(`     → ${uid.slice(0, 12)}…  ${envelopes} enveloppes, ${transactions} transactions`);
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Erreur fatale :", err.message);
  process.exit(1);
});
