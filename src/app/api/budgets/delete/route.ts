import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimiter";

/** Slots fixes — même liste fermée que firestore.rules (isValidBudgetId). */
const VALID_SLOT_IDS = [
  "budget-1",
  "budget-2",
  "budget-3",
  "budget-4",
  "budget-5",
];

/**
 * Suppression DÉFINITIVE d'un budget (décision actée 2026-11-07 — hard
 * delete, irréversible) :
 *  1. `recursiveDelete` de users/{uid}/budgets/{budgetId} (settings,
 *     enveloppes, transactions et revenus mensuels inclus) ;
 *  2. libération du compteur de quota du slot (`envelopeCounts.<slot>`) ;
 *  3. repli du budget courant sur 'default' si le doc state pointait vers
 *     le budget supprimé.
 *
 * Appelé par le web ET l'iOS (même endpoint que /api/account/delete —
 * l'iOS poste sur https://budget.vizualy.app/api/budgets/delete).
 */
export async function POST(request: NextRequest) {
  const authToken = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  if (!authToken) {
    return NextResponse.json(
      { error: "Unauthorized — missing token" },
      { status: 401 },
    );
  }

  let uid: string;
  try {
    const decodedToken = await adminAuth.verifyIdToken(authToken);
    uid = decodedToken.uid;
  } catch {
    return NextResponse.json(
      { error: "Unauthorized — invalid or expired token" },
      { status: 401 },
    );
  }

  // ── Rate limiting (3 tentatives/min max) ──────────────────────
  const rateLimit = checkRateLimit(request, "budget:delete", true);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.message },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimit.resetAt),
        },
      },
    );
  }

  // ── Validation du slot ─────────────────────────────────────────
  let budgetId: unknown;
  try {
    budgetId = (await request.json()).budgetId;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof budgetId !== "string" || !VALID_SLOT_IDS.includes(budgetId)) {
    return NextResponse.json({ error: "Invalid budget id" }, { status: 400 });
  }

  // ── Suppression récursive (Admin SDK — bypass des règles) ──────
  try {
    await adminDb.recursiveDelete(
      adminDb
        .collection("users")
        .doc(uid)
        .collection("budgets")
        .doc(budgetId),
    );
  } catch (error) {
    logger.error(
      `[delete-budget] Firestore deletion failed for ${uid}/${budgetId}`,
      error,
    );
    return NextResponse.json(
      { error: "Failed to delete budget. Please try again." },
      { status: 500 },
    );
  }

  // ── Libération du compteur de quota du slot ────────────────────
  try {
    await adminDb
      .collection("counters")
      .doc(uid)
      .update({ [`envelopeCounts.${budgetId}`]: FieldValue.delete() });
  } catch {
    // Compteur absent — rien à libérer.
  }

  // ── Repli du budget courant si nécessaire ──────────────────────
  try {
    const stateRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("state")
      .doc("currentBudget");
    const stateSnap = await stateRef.get();
    if (stateSnap.exists && stateSnap.data()?.budgetId === budgetId) {
      await stateRef.set({
        budgetId: "default",
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.warn(`[delete-budget] state reset failed for ${uid}`);
    logger.sanitizedError("[delete-budget] state reset error", error);
  }

  return NextResponse.json({ ok: true });
}
