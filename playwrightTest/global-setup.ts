import { FullConfig } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const MARKER_DIR = path.resolve(__dirname, "..", ".e2e-cache");
const getMarkerFile = (uid: string) =>
  path.join(MARKER_DIR, `seeded-${uid}.txt`);

/**
 * Vérifie si les données existent déjà via un fichier marqueur local.
 * Cela évite de consommer des lectures Firestore (surtout quand le quota est atteint).
 *
 * Pour forcer un re-seed : supprimer le fichier .e2e-cache/seeded-{uid}.txt
 * ou définir E2E_FORCE_SEED=true
 */
function alreadySeeded(testUid: string): boolean {
  const markerFile = getMarkerFile(testUid);
  if (!fs.existsSync(markerFile)) return false;

  // Vérifier que le marqueur n'est pas trop vieux (> 7 jours)
  const stats = fs.statSync(markerFile);
  const ageMs = Date.now() - stats.mtimeMs;
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
  return ageMs < maxAge;
}

function markSeeded(testUid: string): void {
  if (!fs.existsSync(MARKER_DIR)) {
    fs.mkdirSync(MARKER_DIR, { recursive: true });
  }
  fs.writeFileSync(
    getMarkerFile(testUid),
    new Date().toISOString(),
    "utf-8"
  );
}

/**
 * Global setup exécuté avant tous les tests E2E.
 * Seed les données de test uniquement si nécessaire.
 */
async function globalSetup(config: FullConfig) {
  const testUid = process.env.E2E_TEST_USER_UID;
  const forceSeed = process.env.E2E_FORCE_SEED === "true";

  if (!testUid) {
    console.warn(
      "⚠️  E2E_TEST_USER_UID non définie — seed de données ignoré."
    );
    return;
  }

  // Vérifier si déjà seedé (marqueur local)
  if (!forceSeed && alreadySeeded(testUid)) {
    console.log(`✅ Données déjà présentes pour ${testUid} — seed ignoré.`);
    console.log(
      `   (Supprime .e2e-cache/seeded-${testUid}.txt ou E2E_FORCE_SEED=true pour re-seed)`
    );
    return;
  }

  const today = process.env.E2E_ANCHOR_DATE || "2026-06-01";

  console.log(`🌱 Seed des données pour: ${testUid}`);
  console.log(`   Date d'ancrage: ${today}`);

  try {
    execSync(
      `node scripts/seed-test-data.js --user "${testUid}" --confirm --replace-existing --env dev --today "${today}"`,
      {
        stdio: "inherit",
        env: { ...process.env },
        timeout: 60_000,
      }
    );
    markSeeded(testUid);
    console.log("✅ Seed terminé.");
  } catch (error: any) {
    const msg = error.stderr || error.message || "";
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded")) {
      console.warn("⚠️  Quota Firebase dépassé.");
      console.warn(
        "   Les tests vont utiliser les données existantes (si dispo)."
      );
      console.warn("   ➜ Le quota se réinitialise à minuit (heure du Pacifique).");
      // Marquer comme seedé pour ne pas réessayer à chaque run
      markSeeded(testUid);
    } else {
      console.error("❌ Échec du seed:", msg.substring(0, 300));
    }
  }
}

export default globalSetup;
