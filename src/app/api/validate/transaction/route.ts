// Validate transaction data on the server
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";

// Validation constraints
const CONSTRAINTS = {
  AMOUNT_MIN: 0.01,
  AMOUNT_MAX: 1000000,
  DESCRIPTION_MAX_LENGTH: 255,
  ENVELOPE_NAME_MAX_LENGTH: 100,
  ENVELOPE_BUDGET_MAX: 1000000,
};

interface ValidateTransactionRequest {
  amount: number;
  description: string;
  envelopeId: string;
  date: string;
  transactionId?: string;
}

function validateAmount(amount: unknown): amount is number {
  return (
    typeof amount === "number" &&
    amount > CONSTRAINTS.AMOUNT_MIN &&
    amount <= CONSTRAINTS.AMOUNT_MAX &&
    !isNaN(amount)
  );
}

function validateDescription(desc: unknown): desc is string {
  return (
    typeof desc === "string" &&
    desc.length > 0 &&
    desc.length <= CONSTRAINTS.DESCRIPTION_MAX_LENGTH
  );
}

function validateDate(date: unknown): boolean {
  return (
    typeof date === "string" &&
    !isNaN(new Date(date).getTime())
  );
}

function validateEnvelopeId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0;
}

export async function POST(request: Request) {
  try {
    // Get user from Firebase auth header
    const authToken = request.headers.get("authorization")?.split(" ")[1];
    if (!authToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const data: unknown = await request.json();

    // Type guard for the request payload
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

    // Validate each field
    if (!validateAmount(payload.amount)) {
      return NextResponse.json(
        { error: `Amount must be between ${CONSTRAINTS.AMOUNT_MIN} and ${CONSTRAINTS.AMOUNT_MAX}` },
        { status: 400 }
      );
    }

    if (!validateDescription(payload.description)) {
      return NextResponse.json(
        { error: `Description must be 1-${CONSTRAINTS.DESCRIPTION_MAX_LENGTH} characters` },
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
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Success - return constraints for client-side validation
    return NextResponse.json({
      valid: true,
      constraints: CONSTRAINTS,
    });
  } catch (error) {
    // Don't expose error details in production
    logger.error("Server validation error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
