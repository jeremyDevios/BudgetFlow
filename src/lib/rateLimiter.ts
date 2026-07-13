/**
 * Rate limiter mémoire pour les routes API.
 *
 * Implémente une fenêtre glissante simple. Chaque appel est identifié
 * par une clé composite (IP + Device-ID + action). Les timestamps
 * sont stockés en mémoire — adapté à un déploiement mono-instance
 * (Docker, VPS). Pour Vercel serverless, remplacer par Vercel KV.
 *
 * Quotas par défaut (par période de 24h glissante) :
 *   - Anonyme : 3 posts, 5 commentaires, 10 votes
 *   - Authentifié (Firebase) : 10 posts, 20 commentaires, 50 votes
 */

type RateLimitBucket = {
  timestamps: number[];
  expiresAt: number; // timestamp after which the bucket can be deleted
};

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 heures
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Nettoyage toutes les heures
const MAX_BUCKETS = 50_000; // Limite de sécurité pour éviter l'épuisement mémoire

// Quotas pour utilisateurs anonymes (par 24h)
const ANON_QUOTAS: Record<string, number> = {
  "feedback:post": 3,
  "feedback:comment": 5,
  "feedback:vote": 10,
};

// Quotas pour utilisateurs authentifiés (par 24h)
const AUTH_QUOTAS: Record<string, number> = {
  "feedback:post": 10,
  "feedback:comment": 20,
  "feedback:vote": 50,
};

// Quotas par minute pour les actions sensibles
const PER_MINUTE_QUOTAS: Record<string, number> = {
  "validate:transaction": 30,   // 30 validations/min
  "account:delete": 3,           // 3 tentatives de suppression/min
};

const store = new Map<string, RateLimitBucket>();
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, bucket] of store) {
    if (bucket.expiresAt < now) {
      store.delete(key);
    }
  }

  // Sécurité : si la map devient trop grande, vider les plus anciens
  if (store.size > MAX_BUCKETS) {
    const entries = [...store.entries()].sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt
    );
    const toDelete = entries.slice(0, entries.length - MAX_BUCKETS + 1000);
    for (const [key] of toDelete) {
      store.delete(key);
    }
  }
}

/** Extrait l'IP du client depuis les en-têtes de la requête. */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/** Extrait le Device-ID anonyme depuis les en-têtes de la requête. */
function getDeviceId(request: Request): string | null {
  return request.headers.get("x-device-id");
}

export interface RateLimitResult {
  allowed: boolean;
  /** Nombre de requêtes restantes dans la fenêtre courante. */
  remaining: number;
  /** Timestamp Unix (ms) après lequel la fenêtre se réinitialise. */
  resetAt: number;
  /** Message d'erreur si `allowed === false`. */
  message?: string;
}

/**
 * Vérifie si une requête est dans les limites autorisées.
 *
 * @param request - La requête entrante.
 * @param action - Identifiant de l'action (ex: "feedback:post").
 * @param isAuthenticated - Si l'utilisateur a un token Firebase valide.
 * @returns Résultat du check de rate limit.
 */
export function checkRateLimit(
  request: Request,
  action: string,
  isAuthenticated: boolean = false
): RateLimitResult {
  cleanup();

  const ip = getClientIp(request);
  const deviceId = getDeviceId(request) || "unknown";

  // Déterminer la fenêtre et le quota selon le type d'action.
  const isPerMinute = action in PER_MINUTE_QUOTAS;
  const windowMs = isPerMinute ? 60_000 : WINDOW_MS;
  const limit = isPerMinute
    ? PER_MINUTE_QUOTAS[action]
    : (isAuthenticated ? AUTH_QUOTAS : ANON_QUOTAS)[action] ?? 3;

  const key = `${ip}:${deviceId}:${action}:${isAuthenticated ? "auth" : "anon"}`;

  const now = Date.now();
  const windowStart = now - windowMs;

  let bucket = store.get(key);

  if (!bucket || bucket.expiresAt < now) {
    bucket = { timestamps: [], expiresAt: now + windowMs };
  }

  // Nettoyer les timestamps hors fenêtre
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

  if (bucket.timestamps.length >= limit) {
    const oldestInWindow = bucket.timestamps[0];
    const resetAt = oldestInWindow + windowMs;
    const unit = isPerMinute ? "par minute" : "par 24h";
    const label =
      action === "validate:transaction" ? "validations" :
      action === "account:delete" ? "tentatives de suppression" :
      action === "feedback:vote" ? "votes" :
      action === "feedback:comment" ? "commentaires" : "posts";
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      message: `Limite atteinte (${limit} ${label} ${unit}). Réessayez après ${new Date(resetAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`,
    };
  }

  bucket.timestamps.push(now);
  bucket.expiresAt = now + windowMs;
  store.set(key, bucket);

  const remaining = limit - bucket.timestamps.length;
  const resetAt = bucket.timestamps[0] + windowMs;

  return { allowed: true, remaining, resetAt };
}

/** Pour les tests : vide le store. */
export function _resetStore() {
  store.clear();
  lastCleanup = 0;
}

/** Pour les tests : expose la taille du store. */
export function _storeSize(): number {
  return store.size;
}
