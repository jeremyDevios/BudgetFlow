import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const QUACKBACK_BASE_URL =
  process.env.QUACKBACK_BASE_URL || "https://feedback.vizualy.app/api/v1";
const QUACKBACK_API_KEY = process.env.QUACKBACK_API_KEY || "";

/**
 * GET /api/feedback/statuses
 *
 * Lists available statuses from Quackback (public).
 */
export async function GET() {
  try {
    const res = await fetch(`${QUACKBACK_BASE_URL}/statuses`, {
      headers: {
        Authorization: `Bearer ${QUACKBACK_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      logger.error(
        `[feedback] GET /statuses failed: ${res.status} ${res.statusText}`
      );
      return NextResponse.json(
        { error: "Failed to fetch statuses" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error("[feedback] GET /statuses unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
