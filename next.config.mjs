import fs from "fs";
import os from "os";
import path from "path";

// SEC-25 : les valeurs privées (FIREBASE_PRIVATE_KEY, CRON_SECRET, …) ne
// vivent plus dans .env.local mais dans ~/.config/budgetflow/env/dev.env
// (voir scripts/migrate-secrets.js). Next ne charge pas de fichier .env
// externe : on le fait ici pour que le serveur de dev local retrouve ses
// variables. Inerte ailleurs (fichier absent en production/CI).
const externalDevEnv = path.join(
  process.env.BUDGETFLOW_SECRETS_DIR ||
    path.join(os.homedir(), ".config", "budgetflow"),
  "env",
  "dev.env"
);
if (fs.existsSync(externalDevEnv)) {
  for (const rawLine of fs.readFileSync(externalDevEnv, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const isDev = process.env.NODE_ENV === "development";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const configuredAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const authHelperHost =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_HELPER_HOST ||
  (configuredAuthDomain &&
  (configuredAuthDomain.endsWith(".firebaseapp.com") ||
    configuredAuthDomain.endsWith(".web.app"))
    ? configuredAuthDomain
    : projectId
      ? `${projectId}.firebaseapp.com`
      : undefined);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // La Content-Security-Policy est gérée par src/middleware.ts
  // (nonce dynamique injecté par requête). Ne pas la dupliquer ici —
  // deux headers CSP sur la même réponse causent un conflit.
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: process.env.SHOW_DEV_TOOLS === "true" ? undefined : false,
  allowedDevOrigins: ["budget.zikkis.fr", "*.zikkis.fr", "localhost", "127.0.0.1", "192.168.1.241"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    if (!authHelperHost) {
      return [];
    }

    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${authHelperHost}/__/auth/:path*`,
      },
      {
        source: "/__/firebase/:path*",
        destination: `https://${authHelperHost}/__/firebase/:path*`,
      },
    ];
  },
};

export default nextConfig;
