import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const QUACKBACK_BASE_URL =
  process.env.QUACKBACK_BASE_URL || "https://feedback.vizualy.app/api/v1";
const QUACKBACK_API_KEY = process.env.QUACKBACK_API_KEY || "";

/**
 * GET /api/feedback/posts/[id]/comments
 *
 * Lists comments for a post.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const res = await fetch(`${QUACKBACK_BASE_URL}/posts/${id}/comments`, {
      headers: {
        Authorization: `Bearer ${QUACKBACK_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      logger.error(
        `[feedback] GET /posts/${id}/comments failed: ${res.status}`
      );
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error(
      "[feedback] GET /posts/[id]/comments unexpected error",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feedback/posts/[id]/comments
 *
 * Adds a comment to a post. Firebase authentication is optional.
 * Body: { content }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate (optional — anonymous users can comment)
    const authHeader = request.headers.get("authorization");
    const authToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    let uid = "anonymous";
    let userEmail: string | undefined;
    let userName: string | undefined;

    if (authToken) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(authToken);
        uid = decodedToken.uid;
        userEmail = decodedToken.email;
        userName = decodedToken.name;
      } catch {
        // Token invalide → on continue en anonyme
      }
    }

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400 }
      );
    }

    // Prepend user attribution
    const attribution = authToken
      ? (userName
          ? `[${userName}] `
          : userEmail
            ? `[${userEmail}] `
            : "")
      : "[Anonyme] ";
    const attributedContent = `${attribution}${content.trim()}`;

    const { id } = await params;

    const res = await fetch(
      `${QUACKBACK_BASE_URL}/posts/${id}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${QUACKBACK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: attributedContent }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      logger.error(
        `[feedback] POST /posts/${id}/comments failed: ${res.status} — ${errText}`
      );
      return NextResponse.json(
        { error: "Failed to add comment" },
        { status: 502 }
      );
    }

    const json = await res.json();
    // Quackback wrappe dans { data: ... }, on unwrap
    const comment = json.data ?? json;
    logger.info(`[feedback] Comment added by ${uid} on post ${id}`);
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    logger.error(
      "[feedback] POST /posts/[id]/comments unexpected error",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
