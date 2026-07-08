import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const QUACKBACK_BASE_URL =
  process.env.QUACKBACK_BASE_URL || "https://feedback.vizualy.app/api/v1";
const QUACKBACK_API_KEY = process.env.QUACKBACK_API_KEY || "";

/**
 * GET /api/feedback/posts
 *
 * Lists feedback posts from Quackback.
 * Query params: cursor?, limit?, boardId?
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = searchParams.get("limit") || "20";
    const boardId = searchParams.get("boardId");

    const params = new URLSearchParams({ limit });
    if (cursor) params.set("cursor", cursor);
    if (boardId) params.set("boardId", boardId);

    const res = await fetch(
      `${QUACKBACK_BASE_URL}/posts?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${QUACKBACK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      logger.error(
        `[feedback] GET /posts failed: ${res.status} ${res.statusText}`
      );
      return NextResponse.json(
        { error: "Failed to fetch feedback posts" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error("[feedback] GET /posts unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feedback/posts
 *
 * Creates a new feedback post on Quackback.
 * Requires Firebase authentication.
 * Body: { title, content, boardId }
 */
export async function POST(request: Request) {
  try {
    // Authenticate
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
    let userEmail: string | undefined;
    let userName: string | undefined;
    try {
      const decodedToken = await adminAuth.verifyIdToken(authToken);
      uid = decodedToken.uid;
      userEmail = decodedToken.email;
      userName = decodedToken.name;
    } catch {
      return NextResponse.json(
        { error: "Unauthorized — invalid or expired token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, boardId } = body;

    if (!title?.trim() || !content?.trim() || !boardId?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: title, content, boardId" },
        { status: 400 }
      );
    }

    // Prepend user attribution to content since Quackback REST API
    // creates posts on behalf of the API key holder.
    const attribution = userName
      ? `Soumis par : ${userName} (${userEmail || uid})`
      : `Soumis par : ${userEmail || uid}`;
    const attributedContent = `${attribution}\n\n---\n\n${content}`;

    const res = await fetch(`${QUACKBACK_BASE_URL}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${QUACKBACK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title.trim(),
        content: attributedContent,
        boardId: boardId.trim(),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(
        `[feedback] POST /posts failed: ${res.status} — ${errText}`
      );
      return NextResponse.json(
        { error: "Failed to create feedback post" },
        { status: 502 }
      );
    }

    const data = await res.json();
    logger.info(`[feedback] Post created by ${uid}: ${data.id}`);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    logger.error("[feedback] POST /posts unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
