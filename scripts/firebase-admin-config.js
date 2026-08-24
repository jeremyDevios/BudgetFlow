const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const { loadEnvFiles, loadExternalEnvFile, getSecretsDir } = require("./load-env");

loadEnvFiles(".env.local", ".env");

function resolveFirebaseAdminConfig(options = {}) {
  const {
    env = "prod",
    customProjectId = null,
    defaultProjectId = "budgetflow-86842",
  } = options;

  // SEC-25 : clés privées déplacées hors de l'arbre du projet par
  // scripts/migrate-secrets.js — complète les variables absentes de .env.local.
  loadExternalEnvFile(env);

  const serviceAccountCandidates = [
    // Emplacement externe (post-migration)
    path.join(getSecretsDir(), "service-accounts", `service-account-${env}.json`),
    path.join(getSecretsDir(), "service-accounts", "service-account.json"),
    // Fallback : emplacements historiques dans l'arbre du projet
    path.resolve(__dirname, `service-account-${env}.json`),
    path.resolve(__dirname, "service-account.json"),
  ];

  const warnings = [];
  let credential;
  let serviceAccount = null;
  let credentialSource;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
    credentialSource = "GOOGLE_APPLICATION_CREDENTIALS";
  } else {
    const found = serviceAccountCandidates.find(fs.existsSync);

    if (!found) {
      throw new Error(
        `Aucune credential trouvée pour --env ${env}.\n` +
          `   → Attendu : ${getSecretsDir()}/service-accounts/service-account-${env}.json\n` +
          `     ou scripts/service-account-${env}.json (emplacement historique)\n` +
          "   → ou définissez GOOGLE_APPLICATION_CREDENTIALS"
      );
    }

    serviceAccount = JSON.parse(fs.readFileSync(found, "utf8"));
    credential = admin.credential.cert(serviceAccount);
    credentialSource = path.basename(found);
  }

  const envProjectId = process.env.FIREBASE_PROJECT_ID || null;
  const projectId =
    customProjectId ||
    serviceAccount?.project_id ||
    envProjectId ||
    defaultProjectId;

  if (
    !customProjectId &&
    serviceAccount?.project_id &&
    envProjectId &&
    serviceAccount.project_id !== envProjectId
  ) {
    warnings.push(
      `FIREBASE_PROJECT_ID=${envProjectId} ignoré : le compte de service cible ${serviceAccount.project_id}.`
    );
  }

  return {
    credential,
    credentialSource,
    projectId,
    serviceAccount,
    warnings,
  };
}

module.exports = {
  resolveFirebaseAdminConfig,
};
