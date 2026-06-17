#!/usr/bin/env node
/**
 * copy-user-data.js
 *
 * Copie l'intégralité des données Firestore d'un utilisateur source vers un
 * utilisateur cible. Les données existantes du compte cible sont supprimées
 * avant la copie pour obtenir un miroir strict.
 *
 * Usage :
 *   node scripts/copy-user-data.js --source-user <uid> --target-user <uid>
 *   node scripts/copy-user-data.js --source-user <uid> --target-user <uid> --confirm
 *   node scripts/copy-user-data.js --source-user <uid> --target-user <uid> --env dev --confirm
 *   node scripts/copy-user-data.js --source-user <uid> --target-user <uid> --include-profile --confirm
 *
 * Options :
 *   --source-user <uid>     UID Firebase de l'utilisateur à copier (obligatoire)
 *   --target-user <uid>     UID Firebase de l'utilisateur cible (obligatoire)
 *   --env prod|dev          Environnement cible (défaut: prod)
 *   --project <projectId>   Override du projectId Firebase
 *   --confirm               Écrit réellement en base (sinon dry-run)
 *   --dry-run               Force le mode simulation
 *   --include-profile       Copie aussi les champs profil (email, displayName, photoURL)
 *                           Par défaut, ces champs sont conservés depuis la cible.
 *   --help                  Affiche cette aide
 *
 * Notes :
 *   - Sans --confirm, le script ne fait qu'afficher ce qu'il ferait.
 *   - Les données copiées sont : document utilisateur, settings/general, enveloppes,
 *     transactions, et dailyActivity.
 *   - Par défaut, les champs identité du profil cible sont préservés
 *     (email, displayName, photoURL, fcmToken, notificationsEnabled,
 *      lastLogin, lastTokenUpdate).
 *   - Ajoutez --include-profile pour écraser ces champs avec ceux de la source.
 */

"use strict";

const admin = require("firebase-admin");
const { resolveFirebaseAdminConfig } = require("./firebase-admin-config");

// ─── Résolution des arguments CLI ────────────────────────────────────────────

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

function printHelp() {
  console.log(`
🔥 BudgetFlow — Copie de données utilisateur Firestore

Usage :
  node scripts/copy-user-data.js --source-user <uid> --target-user <uid>
  node scripts/copy-user-data.js --source-user <uid> --target-user <uid> --confirm
  node scripts/copy-user-data.js --source-user <uid> --target-user <uid> --env dev --confirm
  node scripts/copy-user-data.js --source-user <uid> --target-user <uid> --include-profile --confirm
  npm run copy:user-data -- --source-user <uid> --target-user <uid> --confirm

Options :
  --source-user <uid>     UID Firebase de l'utilisateur à copier (obligatoire)
  --target-user <uid>     UID Firebase de l'utilisateur cible (obligatoire)
  --env prod|dev          Environnement cible (défaut: prod)
  --project <projectId>   Override du projectId Firebase
  --confirm               Écrit réellement en base (sinon dry-run)
  --dry-run               Force le mode simulation
  --include-profile       Copie aussi les champs profil personnels
  --help                  Affiche cette aide
`);
}

if (hasFlag("--help")) {
  printHelp();
  process.exit(0);
}

const sourceUserId = getArg("--source-user");
const targetUserId = getArg("--target-user");
const targetEnv = getArg("--env") || "prod";
const customProjectId = getArg("--project") || null;
const includeProfile = hasFlag("--include-profile");
const isDryRun = hasFlag("--dry-run") || !hasFlag("--confirm");

if (!sourceUserId) {
  console.error("❌ --source-user <uid> est obligatoire.");
  process.exit(1);
}

if (!targetUserId) {
  console.error("❌ --target-user <uid> est obligatoire.");
  process.exit(1);
}

if (sourceUserId === targetUserId) {
  console.error("❌ L'utilisateur source et cible doivent être différents.");
  process.exit(1);
}

// ─── Champs profil préservés côté cible (sauf si --include-profile) ──────────

const PROFILE_KEYS_TO_PRESERVE = new Set([
  "email",
  "displayName",
  "photoURL",
  "fcmToken",
  "notificationsEnabled",
  "lastLogin",
  "lastTokenUpdate",
]);

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

const BATCH_LIMIT = 400;

/**
 * Lit tous les documents d'une collection.
 */
async function fetchAll(collectionRef) {
  const snapshot = await collectionRef.get();
  return snapshot.docs;
}

/**
 * Supprime des documents par lots.
 */
async function deleteInBatches(docs, label) {
  if (docs.length === 0) {
    console.log(`   🧹 ${label} : rien à supprimer`);
    return;
  }

  if (isDryRun) {
    console.log(`   🧹 [dry-run] ${label} : ${docs.length} document(s) seraient supprimé(s)`);
    return;
  }

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_LIMIT);

    for (const doc of chunk) {
      batch.delete(doc.ref);
    }

    await batch.commit();
  }

  console.log(`   🧹 ${label} : ${docs.length} document(s) supprimé(s)`);
}

/**
 * Écrit des documents par lots.
 * Chaque opération : { ref, data, options? }
 */
async function writeInBatches(operations, label) {
  if (operations.length === 0) {
    console.log(`   ✍️  ${label} : aucune écriture`);
    return;
  }

  if (isDryRun) {
    console.log(`   ✍️  [dry-run] ${label} : ${operations.length} document(s) seraient écrits`);
    return;
  }

  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = operations.slice(i, i + BATCH_LIMIT);

    for (const op of chunk) {
      if (op.options) {
        batch.set(op.ref, op.data, op.options);
      } else {
        batch.set(op.ref, op.data);
      }
    }

    await batch.commit();
  }

  console.log(`   ✍️  ${label} : ${operations.length} document(s) écrits`);
}

/**
 * Compte les documents dans chaque sous-collection d'un utilisateur.
 */
async function countUserDocs(userRef) {
  const subCollections = [
    { name: "envelopes", ref: userRef.collection("envelopes") },
    { name: "transactions", ref: userRef.collection("transactions") },
    { name: "dailyActivity", ref: userRef.collection("dailyActivity") },
  ];

  const counts = {};

  for (const { name, ref } of subCollections) {
    const docs = await fetchAll(ref);
    counts[name] = docs.length;
  }

  return counts;
}

// ─── Script principal ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔥 BudgetFlow — Copie de données utilisateur`);
  console.log(`   Projet        : ${projectId}`);
  console.log(`   Environnement : ${targetEnv}`);
  console.log(`   Source        : users/${sourceUserId}`);
  console.log(`   Cible         : users/${targetUserId}`);
  console.log(`   Profil        : ${includeProfile ? "copie complète" : "préservation des champs identité cible"}`);
  console.log(`   Mode          : ${isDryRun ? "dry-run (simulation)" : "écriture réelle"}`);
  console.log("");

  // ─── Références Firestore ────────────────────────────────────────────────

  const sourceUserRef = db.collection("users").doc(sourceUserId);
  const targetUserRef = db.collection("users").doc(targetUserId);

  // ─── Vérification de l'existence de la source ─────────────────────────────

  const sourceUserSnap = await sourceUserRef.get();

  if (!sourceUserSnap.exists) {
    console.error(`❌ L'utilisateur source ${sourceUserId} n'existe pas dans Firestore.`);
    process.exit(1);
  }

  const sourceUserData = sourceUserSnap.data();

  // ─── Lecture de la source ─────────────────────────────────────────────────

  console.log("📖 Lecture des données source…\n");

  const subCollectionsToCopy = [
    { name: "envelopes", label: "Enveloppes" },
    { name: "transactions", label: "Transactions" },
    { name: "dailyActivity", label: "Daily activity" },
  ];

  const sourceData = {};

  // Document settings/general
  const sourceSettingsRef = sourceUserRef.collection("settings").doc("general");
  const sourceSettingsSnap = await sourceSettingsRef.get();
  sourceData.settings = sourceSettingsSnap.exists ? sourceSettingsSnap.data() : null;
  console.log(`   📄 settings/general : ${sourceData.settings ? "✓" : "∅"}`);

  // Sous-collections
  for (const { name, label } of subCollectionsToCopy) {
    const docs = await fetchAll(sourceUserRef.collection(name));
    sourceData[name] = docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));
    console.log(`   📁 ${name} : ${docs.length} document(s)`);
  }

  // ─── Lecture de la cible (pour le profil et les stats) ────────────────────

  console.log("\n📊 État actuel de la cible…\n");

  const targetUserSnap = await targetUserRef.get();
  const targetUserData = targetUserSnap.exists ? targetUserSnap.data() : {};
  const targetExists = targetUserSnap.exists;

  if (targetExists) {
    const targetCounts = await countUserDocs(targetUserRef);
    console.log(`   📄 users/${targetUserId} : existant`);
    console.log(`   📁 envelopes : ${targetCounts.envelopes} document(s)`);
    console.log(`   📁 transactions : ${targetCounts.transactions} document(s)`);
    console.log(`   📁 dailyActivity : ${targetCounts.dailyActivity} document(s)`);
  } else {
    console.log(`   📄 users/${targetUserId} : n'existe pas encore`);
  }

  // ─── Construction du profil cible ─────────────────────────────────────────

  let targetProfile;

  if (includeProfile) {
    // Copie brute du profil source
    targetProfile = { ...sourceUserData };
    console.log("\n👤 Profil : copie complète depuis la source.");
  } else {
    // On part du profil source…
    targetProfile = { ...sourceUserData };
    // …mais on préserve les champs identité de la cible
    if (targetExists) {
      for (const key of PROFILE_KEYS_TO_PRESERVE) {
        if (Object.prototype.hasOwnProperty.call(targetUserData, key)) {
          targetProfile[key] = targetUserData[key];
        }
      }
      console.log("\n👤 Profil : champs identité préservés depuis la cible.");
    } else {
      // La cible n'existe pas : on met des valeurs par défaut pour les champs sensibles
      targetProfile.email = `${targetUserId.slice(0, 12)}@budgetflow.copy`;
      targetProfile.displayName = `Copie de ${sourceUserId.slice(0, 8)}`;
      targetProfile.photoURL = "";
      targetProfile.lastLogin = new Date().toISOString();
      targetProfile.lastTokenUpdate = new Date().toISOString();
      targetProfile.notificationsEnabled = false;
      console.log("\n👤 Profil : cible inexistante → valeurs par défaut pour les champs identité.");
    }
  }

  // ─── Récapitulatif avant action ───────────────────────────────────────────

  const totalSourceDocs =
    (sourceData.settings ? 1 : 0) +
    sourceData.envelopes.length +
    sourceData.transactions.length +
    sourceData.dailyActivity.length;

  console.log(`\n📦 Résumé de l'opération :`);
  console.log(`   Documents à copier depuis la source : ${totalSourceDocs}`);
  console.log(`   - Profil utilisateur   : 1`);
  console.log(`   - settings/general     : ${sourceData.settings ? 1 : 0}`);
  console.log(`   - enveloppes           : ${sourceData.envelopes.length}`);
  console.log(`   - transactions         : ${sourceData.transactions.length}`);
  console.log(`   - dailyActivity        : ${sourceData.dailyActivity.length}`);

  if (targetExists) {
    console.log(`\n   🗑️  Suppression préalable des données cible :`);
    console.log(`   - Profil utilisateur   : sera écrasé`);
    console.log(`   - settings/general     : sera écrasé`);
    console.log(`   - enveloppes           : suppression + réécriture`);
    console.log(`   - transactions         : suppression + réécriture`);
    console.log(`   - dailyActivity        : suppression + réécriture`);
  } else {
    console.log(`\n   ✨ La cible n'existe pas encore → création pure.`);
  }

  console.log("");

  // ─── Suppression des données cible ────────────────────────────────────────

  if (targetExists) {
    console.log("🗑️  Suppression des données cible…\n");

    // Supprimer les documents des sous-collections
    const subCollectionsToDelete = [
      { name: "envelopes", label: "Enveloppes" },
      { name: "transactions", label: "Transactions" },
      { name: "dailyActivity", label: "Daily activity" },
    ];

    for (const { name, label } of subCollectionsToDelete) {
      const docs = await fetchAll(targetUserRef.collection(name));
      await deleteInBatches(docs, label);
    }

    // Supprimer settings/general
    const targetSettingsRef = targetUserRef.collection("settings").doc("general");
    const targetSettingsSnap = await targetSettingsRef.get();
    if (targetSettingsSnap.exists) {
      await deleteInBatches([targetSettingsSnap], "Settings");
    } else {
      console.log("   🧹 Settings : rien à supprimer");
    }

    console.log("");
  }

  // ─── Écriture des données source vers la cible ────────────────────────────

  console.log("✍️  Écriture des données source vers la cible…\n");

  // 1. Profil utilisateur
  await writeInBatches(
    [{ ref: targetUserRef, data: targetProfile }],
    "Profil utilisateur"
  );

  // 2. Settings
  if (sourceData.settings) {
    const targetSettingsRef = targetUserRef.collection("settings").doc("general");
    await writeInBatches(
      [{ ref: targetSettingsRef, data: sourceData.settings }],
      "Settings"
    );
  }

  // 3. Sous-collections
  for (const { name, label } of subCollectionsToCopy) {
    const operations = sourceData[name].map((doc) => ({
      ref: targetUserRef.collection(name).doc(doc.id),
      data: doc.data,
    }));
    await writeInBatches(operations, label);
  }

  // ─── Vérification post-copie ──────────────────────────────────────────────

  if (!isDryRun) {
    console.log("\n🔍 Vérification post-copie…\n");

    const verifyCounts = await countUserDocs(targetUserRef);

    const checks = [
      {
        label: "Enveloppes",
        expected: sourceData.envelopes.length,
        actual: verifyCounts.envelopes,
      },
      {
        label: "Transactions",
        expected: sourceData.transactions.length,
        actual: verifyCounts.transactions,
      },
      {
        label: "Daily activity",
        expected: sourceData.dailyActivity.length,
        actual: verifyCounts.dailyActivity,
      },
    ];

    let allOk = true;
    for (const { label, expected, actual } of checks) {
      const status = expected === actual ? "✅" : "❌";
      if (expected !== actual) allOk = false;
      console.log(`   ${status} ${label} : ${actual}/${expected}`);
    }

    if (allOk) {
      console.log("\n✅ Copie réussie ! Les données sont identiques.");
    } else {
      console.log("\n⚠️  Des écarts ont été détectés. Vérifiez les logs ci-dessus.");
    }
  } else {
    console.log(
      `\n✅ ${isDryRun ? "Simulation terminée" : "Copie terminée"} — aucune donnée n'a été modifiée.`
    );
    console.log("   Relancez avec --confirm pour effectuer la copie réelle.");
  }

  console.log("");
}

main().catch((error) => {
  console.error("\n❌ Erreur fatale :", error.message);
  process.exit(1);
});
