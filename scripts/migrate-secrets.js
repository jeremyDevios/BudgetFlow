#!/usr/bin/env node
/**
 * migrate-secrets.js — SEC-25
 *
 * Déplace les secrets hors de l'arbre du projet vers un répertoire externe :
 *   ~/.config/budgetflow/  (surchargeable via BUDGETFLOW_SECRETS_DIR)
 *
 * Objets déplacés :
 *   - scripts/service-account*.json  →  $SECRETS_DIR/service-accounts/
 *   - backups/*                      →  $SECRETS_DIR/backups/
 *   - clés privées des .env.local*   →  $SECRETS_DIR/env/{dev,prod}.env
 *     (FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, CRON_SECRET,
 *      QUACKBACK_API_KEY)
 *
 * Les fichiers .env originaux sont réécrits sans les valeurs privées, et une
 * copie de sauvegarde complète est conservée dans
 * $SECRETS_DIR/env/backup-avant-migration/ — l'opération est réversible.
 *
 * Les scripts qui chargent les secrets (load-env.js, firebase-admin-config.js,
 * seed-test-data.js, etc.) lisent le répertoire externe en priorité avec
 * repli sur les emplacements historiques : rien ne casse si la migration
 * n'a pas encore été exécutée, et tout continue de marcher après.
 *
 * Usage :
 *   node scripts/migrate-secrets.js            # dry-run (affiche le plan)
 *   node scripts/migrate-secrets.js --confirm  # exécute la migration
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseEnv } = require("node:util");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function getSecretsDir() {
  return (
    process.env.BUDGETFLOW_SECRETS_DIR ||
    path.join(os.homedir(), ".config", "budgetflow")
  );
}

const PRIVATE_ENV_KEYS = [
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "CRON_SECRET",
  "QUACKBACK_API_KEY",
];

// .env.local.dev n'est pas auto-chargé par Next : ses valeurs privées sont
// fusionnées dans dev.env (le premier fichier gagne).
const ENV_SOURCES = [
  { file: ".env.local", envName: "dev" },
  { file: ".env.local.dev", envName: "dev" },
  { file: ".env.local.prod", envName: "prod" },
];

const SERVICE_ACCOUNTS = [
  "service-account.json",
  "service-account-dev.json",
  "service-account-prod.json",
];

function serializeEnv(entries) {
  return (
    Object.entries(entries)
      .map(([key, value]) => {
        // Convention du projet : les retours à la ligne des clés PEM sont
        // stockés en séquences \n (firebaseAdmin.ts les reconvertit) —
        // une variable = une seule ligne physique.
        const escaped = String(value)
          .replace(/\\/g, "\\\\")
          .replace(/\r?\n/g, "\\n")
          .replace(/"/g, '\\"');
        return `${key}="${escaped}"`;
      })
      .join("\n") + "\n"
  );
}

function buildPlan() {
  const actions = [];
  const secretsDir = getSecretsDir();

  // 1. Comptes de service
  for (const file of SERVICE_ACCOUNTS) {
    const from = path.join(PROJECT_ROOT, "scripts", file);
    if (fs.existsSync(from)) {
      actions.push({
        type: "move",
        from,
        to: path.join(secretsDir, "service-accounts", file),
        label: `compte de service ${file}`,
      });
    }
  }

  // 2. Backups Firestore (données utilisateur en clair)
  const backupsDir = path.join(PROJECT_ROOT, "backups");
  if (fs.existsSync(backupsDir)) {
    for (const entry of fs.readdirSync(backupsDir)) {
      actions.push({
        type: "move",
        from: path.join(backupsDir, entry),
        to: path.join(secretsDir, "backups", entry),
        label: `backup ${entry}`,
      });
    }
  }

  // 3. Valeurs privées des fichiers .env
  const extracted = {}; // envName -> { key: value }
  const backupDir = path.join(secretsDir, "env", "backup-avant-migration");

  for (const { file, envName } of ENV_SOURCES) {
    const fullPath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(fullPath)) continue;

    const parsed = parseEnv(fs.readFileSync(fullPath, "utf8"));
    const keys = PRIVATE_ENV_KEYS.filter((key) => key in parsed);
    if (keys.length === 0) continue;

    const target = extracted[envName] || (extracted[envName] = {});
    for (const key of keys) {
      if (!(key in target)) target[key] = parsed[key];
    }

    actions.push({
      type: "copy",
      from: fullPath,
      to: path.join(backupDir, path.basename(fullPath)),
      label: `sauvegarde de ${file}`,
    });
    actions.push({
      type: "strip-env",
      file: fullPath,
      keys,
      label: `retrait des clés privées de ${file}`,
    });
  }

  for (const [envName, values] of Object.entries(extracted)) {
    actions.push({
      type: "write-env",
      file: path.join(secretsDir, "env", `${envName}.env`),
      values,
      label: `création de env/${envName}.env`,
    });
  }

  return { actions, secretsDir, extracted };
}

function execute(action) {
  switch (action.type) {
    case "move": {
      fs.mkdirSync(path.dirname(action.to), { recursive: true });
      fs.renameSync(action.from, action.to);
      break;
    }
    case "copy": {
      fs.mkdirSync(path.dirname(action.to), { recursive: true });
      fs.copyFileSync(action.from, action.to);
      break;
    }
    case "strip-env": {
      const parsed = parseEnv(fs.readFileSync(action.file, "utf8"));
      for (const key of action.keys) delete parsed[key];
      fs.writeFileSync(
        action.file,
        `# Clés privées déplacées par scripts/migrate-secrets.js → ${getSecretsDir()}/env/\n` +
          serializeEnv(parsed)
      );
      break;
    }
    case "write-env": {
      fs.mkdirSync(path.dirname(action.file), { recursive: true });
      fs.writeFileSync(
        action.file,
        `# Secrets BudgetFlow — généré par scripts/migrate-secrets.js\n` +
          serializeEnv(action.values)
      );
      break;
    }
    default:
      throw new Error(`Action inconnue : ${action.type}`);
  }
}

function chmodSecretsDir(secretsDir) {
  try {
    fs.chmodSync(secretsDir, 0o700);
    for (const sub of ["service-accounts", "env", "backups"]) {
      const p = path.join(secretsDir, sub);
      if (fs.existsSync(p)) fs.chmodSync(p, 0o700);
    }
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          fs.chmodSync(p, 0o700);
          walk(p);
        } else {
          fs.chmodSync(p, 0o600);
        }
      }
    };
    for (const sub of ["service-accounts", "env", "backups"]) {
      const p = path.join(secretsDir, sub);
      if (fs.existsSync(p)) walk(p);
    }
  } catch (error) {
    console.warn(`⚠️  chmod partiel : ${error.message}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      [
        "Usage :",
        "  node scripts/migrate-secrets.js            # dry-run (affiche le plan)",
        "  node scripts/migrate-secrets.js --confirm  # exécute la migration",
      ].join("\n")
    );
    process.exit(0);
  }

  const isDryRun = !args.includes("--confirm");
  const { actions, secretsDir, extracted } = buildPlan();

  if (actions.length === 0) {
    console.log("✅ Rien à migrer : aucun secret trouvé dans l'arbre du projet.");
    process.exit(0);
  }

  console.log(
    `${isDryRun ? "🧪 [DRY-RUN]" : "🚀 [EXÉCUTION]"} Répertoire des secrets : ${secretsDir}\n`
  );

  const planLines = actions.map((a) => {
    switch (a.type) {
      case "move":
        return `  → déplacer   ${path.relative(PROJECT_ROOT, a.from)}  ${a.to}`;
      case "copy":
        return `  → copier     ${path.relative(PROJECT_ROOT, a.from)}  ${a.to}`;
      case "strip-env":
        return `  → retirer    ${a.keys.join(", ")}  de ${path.relative(PROJECT_ROOT, a.file)}`;
      case "write-env":
        return `  → écrire     ${Object.keys(a.values).join(", ")}  dans ${a.file}`;
      default:
        return `  → ${a.type} ${a.label}`;
    }
  });
  console.log(planLines.join("\n"));

  if (isDryRun) {
    console.log("\n💡 Relancez avec --confirm pour exécuter cette migration.");
    process.exit(0);
  }

  for (const action of actions) {
    try {
      execute(action);
      console.log(`✅ ${action.label}`);
    } catch (error) {
      console.error(`❌ ${action.label} : ${error.message}`);
      console.error(
        "   Migration interrompue — les fichiers d'origine sont intacts " +
          "(aucune suppression, uniquement déplacement/écriture)."
      );
      process.exit(1);
    }
  }

  chmodSecretsDir(secretsDir);

  console.log("\n📋 Résumé :");
  console.log(`  • Comptes de service : ${SERVICE_ACCOUNTS.filter((f) => actions.some((a) => a.type === "move" && a.label.includes(f))).length} déplacé(s)`);
  console.log(`  • Fichiers env créés : ${Object.keys(extracted).map((e) => `env/${e}.env`).join(", ")}`);
  console.log(`  • Sauvegardes .env : ${secretsDir}/env/backup-avant-migration/`);
  console.log("\n⚠️  Étapes restantes (manuelles, console Firebase) :");
  console.log("  1. Rotation des clés de service account (IAM & Admin → Service accounts).");
  console.log("  2. CRON_SECRET distinct par environnement (dev ≠ prod).");
  console.log("  3. Vérifier que `next dev`, les scripts et docker-compose fonctionnent toujours.");
}

main();
