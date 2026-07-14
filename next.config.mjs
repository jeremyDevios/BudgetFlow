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
