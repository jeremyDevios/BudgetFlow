import { NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebaseAdmin";

type TriggerStats = {
  date: string;
  totalUsers: number;
  eligibleUsers: number;
  skippedDisabled: number;
  skippedWithoutToken: number;
  sent: number;
};

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayBounds(now: Date) {
  const dayKey = formatLocalDateKey(now);
  return {
    dayKey,
    start: dayKey,
    end: `${dayKey}T23:59:59.999`,
  };
}

function getCronSecretFromRequest(request: Request): string | null {
  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret) {
    return headerSecret;
  }

  const url = new URL(request.url);
  return url.searchParams.get("key");
}

function getUnauthorizedResponse(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 500 }
    );
  }

  const requestSecret = getCronSecretFromRequest(request);
  if (!requestSecret || requestSecret !== configuredSecret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null;
}

function getMessagingErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

async function runNotificationTrigger(now = new Date()): Promise<TriggerStats> {
  const { dayKey, start, end } = getDayBounds(now);
  const usersSnap = await adminDb.collection("users").get();
  const stats: TriggerStats = {
    date: dayKey,
    totalUsers: usersSnap.size,
    eligibleUsers: 0,
    skippedDisabled: 0,
    skippedWithoutToken: 0,
    sent: 0,
  };
  const notifications: Promise<void>[] = [];

  console.log(`[notifications] Starting daily trigger for ${dayKey}`);
  console.log(`[notifications] Found ${usersSnap.size} users.`);

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();

    if (userData.notificationsEnabled === false) {
      stats.skippedDisabled += 1;
      continue;
    }

    const token = typeof userData.fcmToken === "string" ? userData.fcmToken : null;
    if (!token) {
      stats.skippedWithoutToken += 1;
      continue;
    }

    stats.eligibleUsers += 1;

    try {
      const transactionsSnap = await adminDb
        .collection("users")
        .doc(userDoc.id)
        .collection("transactions")
        .where("date", ">=", start)
        .where("date", "<=", end)
        .get();

      let dailyTotal = 0;
      let transactionCount = 0;

      transactionsSnap.forEach((txDoc) => {
        const data = txDoc.data();
        const amount = Number(data.amount);
        if (Number.isFinite(amount) && amount !== 0) {
          dailyTotal += amount;
          transactionCount += 1;
        }
      });

      // Read user's currency preference (default EUR)
      let currency = "EUR";
      try {
        const settingsSnap = await adminDb
          .collection("users")
          .doc(userDoc.id)
          .collection("settings")
          .doc("general")
          .get();
        if (settingsSnap.exists) {
          const settingsData = settingsSnap.data();
          if (typeof settingsData?.currency === "string") {
            currency = settingsData.currency;
          }
        }
      } catch {
        // Fall back to EUR if settings read fails
      }

      const formattedTotal = new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
      }).format(dailyTotal);

      const body = transactionCount > 0
        ? `Vous avez déjà saisi ${formattedTotal} aujourd'hui (${transactionCount} dépenses). Avez-vous oublié quelque chose ?`
        : "Aucune dépense saisie aujourd'hui. Rien à déclarer ?";

      notifications.push(
        adminMessaging.send({
          token,
          notification: {
            title: "Bilan Quotidien",
            body,
          },
          webpush: {
            fcmOptions: {
              link: "/dashboard",
            },
            notification: {
              icon: "/icon.png",
              badge: "/icon.png",
            },
          },
        }).then(() => {
          stats.sent += 1;
        }).catch(async (error) => {
          console.error(`[notifications] Failed for user ${userDoc.id}`, error);

          if (getMessagingErrorCode(error) === "messaging/registration-token-not-registered") {
            await adminDb.collection("users").doc(userDoc.id).update({
              fcmToken: null,
            });
          }
        })
      );
    } catch (error) {
      console.error(`[notifications] Failed while preparing user ${userDoc.id}`, error);
    }
  }

  await Promise.all(notifications);
  return stats;
}

async function handleTriggerRequest(request: Request) {
  const unauthorizedResponse = getUnauthorizedResponse(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const stats = await runNotificationTrigger();
    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error: unknown) {
    console.error("[notifications] Cron trigger failed", error);

    const message = error instanceof Error
      ? error.message
      : "Internal Server Error";

    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleTriggerRequest(request);
}

export async function POST(request: Request) {
  return handleTriggerRequest(request);
}
