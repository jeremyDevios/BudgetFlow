import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimiter";

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
 * Firebase authentication is optional — anonymous users can submit too.
 * Body: { title, content, boardId }
 */
export async function POST(request: Request) {
  try {
    // ── Authenticate (optional — anonymous users can submit) ──────
    const authHeader = request.headers.get("authorization");
    const authToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    let uid = "anonymous";
    let userEmail: string | undefined;
    let userName: string | undefined;
    let isAuthenticated = false;

    if (authToken) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(authToken);
        uid = decodedToken.uid;
        userEmail = decodedToken.email;
        userName = decodedToken.name;
        isAuthenticated = true;
      } catch {
        // SEC-30 : un token invalide/expiré est refusé explicitement —
        // pas de dégradation silencieuse en anonyme.
        return NextResponse.json(
          { error: "Invalid authentication token" },
          { status: 401 }
        );
      }
    }

    // ── Rate limiting ─────────────────────────────────────────────
    const rateLimit = checkRateLimit(request, "feedback:post", isAuthenticated);
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

    const body = await request.json();
    const { title, content, boardId } = body;

    if (!title?.trim() || !content?.trim() || !boardId?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: title, content, boardId" },
        { status: 400 }
      );
    }

    // SEC-30 : longueurs maximales — un contenu non borné est transmis
    // tel quel à l'API tierce.
    if (
      title.trim().length > 200 ||
      content.trim().length > 5000 ||
      boardId.trim().length > 100
    ) {
      return NextResponse.json(
        { error: "title (max 200), content (max 5000) ou boardId (max 100) trop long" },
        { status: 400 }
      );
    }

    // ── Build attributed content ──────────────────────────────────
    // Note : l'email n'est plus inclus, seulement le displayName
    // ou "Anonyme" (cf. SEC-17).
    const attribution = isAuthenticated
      ? (userName
          ? `Soumis par : ${userName}`
          : `Soumis par : utilisateur connecté`)
      : "Soumis par : Anonyme";
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

    const json = await res.json();
    // Quackback wrappe dans { data: ... }, on unwrap
    const post = json.data ?? json;
    logger.info(`[feedback] Post created by ${uid}: ${post.id}`);
    return NextResponse.json(post, {
      status: 201,
      headers: {
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.resetAt),
      },
    });
  } catch (error) {
    logger.error("[feedback] POST /posts unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
