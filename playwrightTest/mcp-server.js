#!/usr/bin/env node

/**
 * Serveur MCP BudgetFlow pour les tests E2E Playwright.
 *
 * Expose des outils spécifiques à BudgetFlow pour :
 * - le seed des données de test
 * - la gestion de l'authentification
 * - l'exécution des suites de tests
 *
 * Utilisé par le .mcp.json du projet.
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PROJECT_ROOT = path.resolve(__dirname, "..");

// ─── Outils MCP ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "seed-test-data",
    description:
      "Peuple Firestore avec des données de test (7 enveloppes, ~200 transactions sur 5 mois). Utilise le script scripts/seed-test-data.js.",
    inputSchema: {
      type: "object",
      properties: {
        userUid: {
          type: "string",
          description: "Firebase UID de l'utilisateur de test",
        },
        today: {
          type: "string",
          description: "Date d'ancrage YYYY-MM-DD (défaut: 2026-06-01)",
        },
        confirm: {
          type: "boolean",
          description: "Confirmer l'écriture (défaut: true)",
        },
        replaceExisting: {
          type: "boolean",
          description: "Remplacer les données existantes (défaut: true)",
        },
      },
      required: ["userUid"],
    },
  },
  {
    name: "reset-test-data",
    description:
      "Réinitialise les données de test à l'état de base. Relance le seed avec --replace-existing.",
    inputSchema: {
      type: "object",
      properties: {
        userUid: {
          type: "string",
          description: "Firebase UID de l'utilisateur de test",
        },
      },
      required: ["userUid"],
    },
  },
  {
    name: "get-auth-status",
    description:
      "Vérifie si le fichier d'authentification Playwright existe et est valide.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "run-test-suite",
    description:
      "Lance une suite de tests E2E spécifique avec la config Playwright du projet.",
    inputSchema: {
      type: "object",
      properties: {
        suite: {
          type: "string",
          enum: [
            "public-flow",
            "onboarding-flow",
            "dashboard",
            "envelopes-crud",
            "transactions",
            "settings",
            "cashflow",
            "evolution",
            "history",
          ],
          description: "Nom de la suite de tests à exécuter",
        },
        headed: {
          type: "boolean",
          description: "Lancer en mode headed (navigateur visible)",
        },
      },
      required: ["suite"],
    },
  },
  {
    name: "list-test-suites",
    description: "Liste toutes les suites de tests disponibles.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ─── Gestion des requêtes MCP ───────────────────────────────────────────

function handleToolCall(name, args) {
  switch (name) {
    case "seed-test-data": {
      const uid = args.userUid;
      const today = args.today || "2026-06-01";
      const confirm = args.confirm !== false ? "--confirm" : "";
      const replace = args.replaceExisting !== false ? "--replace-existing" : "";

      try {
        const cmd = `node scripts/seed-test-data.js --user "${uid}" ${confirm} ${replace} --today "${today}"`;
        const output = execSync(cmd, {
          cwd: PROJECT_ROOT,
          stdio: "pipe",
          encoding: "utf-8",
        });
        return { success: true, output };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    case "reset-test-data": {
      const uid = args.userUid;
      try {
        const cmd = `node scripts/seed-test-data.js --user "${uid}" --confirm --replace-existing`;
        const output = execSync(cmd, {
          cwd: PROJECT_ROOT,
          stdio: "pipe",
          encoding: "utf-8",
        });
        return { success: true, output };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    case "get-auth-status": {
      const authFile = path.resolve(
        PROJECT_ROOT,
        "playwrightTest/auth/playwright.auth.json"
      );
      const onboardingFile = path.resolve(
        PROJECT_ROOT,
        "playwrightTest/auth/playwright.onboarding.json"
      );

      const authExists = fs.existsSync(authFile);
      const onboardingExists = fs.existsSync(onboardingFile);

      let authSize = 0;
      if (authExists) {
        authSize = fs.statSync(authFile).size;
      }

      return {
        authenticated: authExists && authSize > 1000,
        onboarding: onboardingExists,
        authFileSize: authSize,
        message: authExists
          ? `✅ Fichier auth trouvé (${(authSize / 1024).toFixed(1)} KB)`
          : "⚠️ Fichier auth non trouvé — lance npm run test:e2e:auth",
      };
    }

    case "run-test-suite": {
      const { suite, headed } = args;
      const headedFlag = headed ? "--headed" : "";

      try {
        const cmd = `npx playwright test --config=playwrightTest/playwright.config.ts ${headedFlag} --grep="${suite}"`;
        const output = execSync(cmd, {
          cwd: PROJECT_ROOT,
          stdio: "pipe",
          encoding: "utf-8",
        });
        return { success: true, output };
      } catch (error) {
        return {
          success: false,
          output: error.stdout || "",
          error: error.stderr || error.message,
        };
      }
    }

    case "list-test-suites": {
      const specsDir = path.resolve(PROJECT_ROOT, "playwrightTest/specs");
      const files = fs.existsSync(specsDir) ? fs.readdirSync(specsDir) : [];
      return {
        suites: files
          .filter((f) => f.endsWith(".spec.ts"))
          .map((f) => f.replace(".spec.ts", "")),
        total: files.filter((f) => f.endsWith(".spec.ts")).length,
      };
    }

    default:
      return { error: `Outil inconnu: ${name}` };
  }
}

// ─── Serveur stdio MCP ──────────────────────────────────────────────────

process.stdin.setEncoding("utf-8");

let buffer = "";

process.stdin.on("data", (chunk) => {
  buffer += chunk;

  // Essayer de parser des messages JSON (un par ligne)
  const lines = buffer.split("\n");
  buffer = lines.pop() || ""; // Garde le dernier fragment incomplet

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const message = JSON.parse(line);

      if (message.method === "initialize") {
        // Répondre avec les capacités du serveur
        respond({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "budgetflow-e2e",
              version: "1.0.0",
            },
          },
        });
      } else if (message.method === "tools/list") {
        respond({
          jsonrpc: "2.0",
          id: message.id,
          result: { tools: TOOLS },
        });
      } else if (message.method === "tools/call") {
        const result = handleToolCall(
          message.params.name,
          message.params.arguments || {}
        );
        respond({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          },
        });
      } else if (message.method === "notifications/initialized") {
        // No response needed for notifications
      }
    } catch (error) {
      respond({
        jsonrpc: "2.0",
        id: message?.id || null,
        error: {
          code: -32603,
          message: error.message,
        },
      });
    }
  }
});

function respond(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

process.stderr.write("🔧 BudgetFlow E2E MCP server démarré.\n");
