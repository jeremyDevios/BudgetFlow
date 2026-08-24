import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const QUACKBACK_BASE_URL =
  process.env.QUACKBACK_BASE_URL || "https://feedback.vizualy.app/api/v1";
const QUACKBACK_API_KEY = process.env.QUACKBACK_API_KEY || "";

/**
 * GET /api/feedback/posts/[id]
 *
 * Returns a single feedback post with its details.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // SEC-30 : l'id est un paramètre d'URL — encodé pour empêcher toute
    // manipulation du chemin/des paramètres de la requête sortante.
    const res = await fetch(`${QUACKBACK_BASE_URL}/posts/${encodeURIComponent(id)}`, {
      headers: {
        Authorization: `Bearer ${QUACKBACK_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      logger.error(
        `[feedback] GET /posts/${id} failed: ${res.status} ${res.statusText}`
      );
      return NextResponse.json(
        { error: "Failed to fetch post" },
        { status: 502 }
      );
    }

    const json = await res.json();
    // Quackback wrappe dans { data: ... }, on unwrap
    return NextResponse.json(json.data ?? json);
  } catch (error) {
    logger.error("[feedback] GET /posts/[id] unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
