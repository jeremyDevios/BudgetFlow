import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware Next.js qui injecte un nonce CSP aléatoire dans chaque requête.
 *
 * Le nonce est :
 * 1. Injecté dans le header Content-Security-Policy (remplace 'unsafe-inline')
 * 2. Passé au layout via le header x-csp-nonce pour le script inline du thème
 *
 * Cette approche élimine le besoin de `'unsafe-inline'` dans le CSP
 * tout en permettant le script d'initialisation du thème sombre.
 */

export function middleware(request: NextRequest) {
  // Générer un nonce aléatoire unique par requête
  const nonce = crypto.randomUUID();

  const isDev = process.env.NODE_ENV === "development";

  // CSP production — identique à celui de next.config.mjs mais avec
  // 'nonce-{value}' au lieu de 'unsafe-inline' pour script-src.
  // En développement, on garde 'unsafe-inline' + 'unsafe-eval' car
  // webpack en a besoin pour le HMR et les source maps (eval()).
  // Sans ça, le JS ne s'exécute pas → React n'hydrate jamais →
  // AuthContext reste bloqué en loading:true.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline' 'unsafe-eval'" : ""} https://apis.google.com https://*.firebaseapp.com https://*.googleapis.com https://accounts.google.com https://www.google.com https://www.gstatic.com https://*.gstatic.com`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://*.googleapis.com https://firestore.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://fcm.googleapis.com",
    "frame-src https://*.firebaseapp.com https://accounts.google.com https://*.google.com https://*.gstatic.com",
    "img-src 'self' data: https:",
    "frame-ancestors 'none'",
  ].join("; ");

  const response = NextResponse.next();

  // Injecter le CSP avec nonce
  response.headers.set("Content-Security-Policy", csp);

  // Passer le nonce au layout pour le script inline du thème
  response.headers.set("x-csp-nonce", nonce);

  return response;
}

/**
 * Appliquer le middleware à toutes les pages (pas aux assets statiques ni API).
 *
 * Les routes API n'ont pas besoin du CSP nonce-based car elles n'ont pas
 * de script inline. Les assets statiques (Next.js _next/, favicon, etc.)
 * ne doivent pas être interceptés par le middleware.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static and _next/image (static files)
     * - favicon.ico, icon.png, apple-icon.png (icons)
     * - api routes (no inline scripts)
     */
    "/((?!_next/static|_next/image|api/|favicon\\.ico|icon\\.png|apple-icon\\.png).*)",
  ],
};
