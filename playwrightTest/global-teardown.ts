import { FullConfig } from "@playwright/test";

/**
 * Global teardown exécuté après tous les tests E2E.
 * Nettoie les ressources si nécessaire.
 */
async function globalTeardown(config: FullConfig) {
  console.log("🧹 Nettoyage post-tests E2E terminé.");
}

export default globalTeardown;
