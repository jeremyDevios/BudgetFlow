/**
 * API de validation côté serveur pour les transactions.
 *
 * Cette route fournit une validation pré-vol (pre-flight) côté serveur
 * avec vérification du token Firebase. Elle permet au client d'obtenir
 * un retour immédiat sur la validité des données avant l'écriture Firestore.
 *
 * La véritable enforcement se fait dans les Firestore Security Rules —
 * cette route est un complément UX, pas la couche de sécurité unique.
 *
 * Rate limiting : 30 requêtes par IP+Device-ID par minute (fenêtre glissante).
 */
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimiter";
import {
  VALIDATION_CONSTRAINTS,
  validateAmount,
  validateDescription,
  validateDate,
  validateEnvelopeId,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    // ── Rate limiting ─────────────────────────────────────────────
    const rateLimit = checkRateLimit(request, "validate:transaction", false);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: rateLimit.message },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimit.resetAt),
          },
        }
      );
    }

    // ── Authenticate ──────────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    const authToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader?.split(" ")[1] ?? null;
    if (!authToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    try {
      await adminAuth.verifyIdToken(authToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // ── Validate payload ──────────────────────────────────────────
    const data: unknown = await request.json();

    if (
      typeof data !== "object" ||
      data === null ||
      !("amount" in data) ||
      !("description" in data) ||
      !("envelopeId" in data) ||
      !("date" in data)
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const payload = data as Record<string, unknown>;

    if (!validateAmount(payload.amount)) {
      return NextResponse.json(
        { error: `Amount must be between ${VALIDATION_CONSTRAINTS.AMOUNT_MIN} and ${VALIDATION_CONSTRAINTS.AMOUNT_MAX}` },
        { status: 400 }
      );
    }

    if (!validateDescription(payload.description)) {
      return NextResponse.json(
        { error: `Description must be 1-${VALIDATION_CONSTRAINTS.DESCRIPTION_MAX_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (!validateEnvelopeId(payload.envelopeId)) {
      return NextResponse.json(
        { error: "Invalid envelope ID" },
        { status: 400 }
      );
    }

    if (!validateDate(payload.date)) {
      return NextResponse.json(
        { error: "Invalid date format (expected YYYY-MM-DD, ±5 years)" },
        { status: 400 }
      );
    }

    // Success — return constraints for client-side UX.
    // The real enforcement is in Firestore Security Rules.
    return NextResponse.json({
      valid: true,
      constraints: VALIDATION_CONSTRAINTS,
    });
  } catch (error) {
    logger.error("Server validation error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
