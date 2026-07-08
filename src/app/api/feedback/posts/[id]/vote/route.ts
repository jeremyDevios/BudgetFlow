import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const QUACKBACK_BASE_URL =
  process.env.QUACKBACK_BASE_URL || "https://feedback.vizualy.app/api/v1";
const QUACKBACK_API_KEY = process.env.QUACKBACK_API_KEY || "";

/**
 * POST /api/feedback/posts/[id]/vote
 *
 * Toggles a vote on a post. Firebase authentication is optional.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate (optional)
    const authHeader = request.headers.get("authorization");
    const authToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (authToken) {
      try {
        await adminAuth.verifyIdToken(authToken);
      } catch {
        // Token invalide → on continue sans auth
      }
    }

    const { id } = await params;

    const res = await fetch(`${QUACKBACK_BASE_URL}/posts/${id}/vote`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${QUACKBACK_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      logger.error(
        `[feedback] POST /posts/${id}/vote failed: ${res.status}`
      );
      return NextResponse.json(
        { error: "Failed to toggle vote" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error("[feedback] POST /posts/[id]/vote unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
