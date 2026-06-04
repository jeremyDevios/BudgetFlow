import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";

// Force dynamic — this route uses Firebase Admin SDK which requires
// runtime environment variables (not available during build).
export const dynamic = "force-dynamic";

/**
 * POST /api/account/delete
 *
 * Deletes a user's Firebase Auth account and all their Firestore data.
 * This endpoint uses the Firebase Admin SDK to perform an atomic,
 * server-side deletion — client-side deletion is intentionally blocked
 * by Firestore security rules.
 *
 * Authentication: Firebase ID token in Authorization header.
 */
export async function POST(request: Request) {
  try {
    // ── Authenticate ──────────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    const authToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!authToken) {
      return NextResponse.json(
        { error: "Unauthorized — missing token" },
        { status: 401 }
      );
    }

    let uid: string;
    try {
      const decodedToken = await adminAuth.verifyIdToken(authToken);
      uid = decodedToken.uid;
    } catch {
      return NextResponse.json(
        { error: "Unauthorized — invalid or expired token" },
        { status: 401 }
      );
    }

    // ── Delete Firestore data (recursive) ─────────────────────────
    // This removes users/{uid} and all subcollections:
    //   envelopes/, transactions/, dailyActivity/, settings/
    try {
      await adminDb.recursiveDelete(adminDb.collection("users").doc(uid));
    } catch (error) {
      logger.error(`[delete-account] Firestore deletion failed for ${uid}`, error);
      return NextResponse.json(
        { error: "Failed to delete data. Please try again or contact support." },
        { status: 500 }
      );
    }

    // ── Delete Firebase Auth user ─────────────────────────────────
    try {
      await adminAuth.deleteUser(uid);
    } catch (error) {
      // Firestore data is already deleted at this point.
      // Log the orphaned Auth account for manual cleanup.
      logger.error(
        `[delete-account] Auth deletion failed for ${uid} after Firestore cleanup. Orphaned Auth account needs manual removal.`,
        error
      );
      return NextResponse.json(
        { error: "Account partially deleted. Please contact support for complete removal." },
        { status: 500 }
      );
    }

    logger.info(`[delete-account] Account fully deleted for ${uid}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[delete-account] Unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
