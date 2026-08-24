import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";

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

/**
 * Extrait le CRON_SECRET depuis l'en-tête HTTP uniquement.
 * L'acceptation via query param ?key= a été retirée (SEC-03) —
 * les secrets dans l'URL sont exposés dans les logs serveur,
 * les referers HTTP et l'historique du navigateur.
 */
function getCronSecretFromRequest(request: Request): string | null {
  return request.headers.get("x-cron-secret");
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
  if (!requestSecret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Comparaison timing-safe pour empêcher les attaques par canal
  // latéral temporel (SEC-03).
  const reqBuf = Buffer.from(requestSecret);
  const cfgBuf = Buffer.from(configuredSecret);
  if (reqBuf.length !== cfgBuf.length || !timingSafeEqual(reqBuf, cfgBuf)) {
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

// SEC-31 : identifiant non réversible pour les logs de production —
// les UID Firebase ne doivent pas apparaître dans les journaux.
function shortUid(uid: string): string {
  return createHash("sha256").update(uid).digest("hex").slice(0, 8);
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

  logger.info(`[notifications] Starting daily trigger for ${dayKey}`);
  logger.info(`[notifications] Found ${usersSnap.size} users.`);

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

      let transactionCount = 0;

      transactionsSnap.forEach((txDoc) => {
        const data = txDoc.data();
        const amount = Number(data.amount);
        if (Number.isFinite(amount) && amount !== 0) {
          transactionCount += 1;
        }
      });

      // SEC-31 : le corps de la notification ne contient aucun montant
      // financier — une notification est visible sur l'écran verrouillé.
      const body = transactionCount > 0
        ? `Vous avez saisi ${transactionCount} dépense(s) aujourd'hui. Avez-vous oublié quelque chose ?`
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
          logger.error(`[notifications] Failed for user ${shortUid(userDoc.id)}`, error);

          if (getMessagingErrorCode(error) === "messaging/registration-token-not-registered") {
            try {
              await adminDb.collection("users").doc(userDoc.id).update({
                fcmToken: null,
              });
              logger.info(`[notifications] Cleaned up invalid FCM token for user ${shortUid(userDoc.id)}`);
            } catch (cleanupError) {
              logger.error(
                `[notifications] Failed to clean up FCM token for user ${shortUid(userDoc.id)}`,
                cleanupError
              );
            }
          }
        })
      );
    } catch (error) {
      logger.error(`[notifications] Failed while preparing user ${shortUid(userDoc.id)}`, error);
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
    logger.error("[notifications] Cron trigger failed", error);

    const message = error instanceof Error
      ? error.message
      : "Internal Server Error";

    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // SEC-31 : pas d'effet de bord sur GET — les crawlers et préchargements
  // ne doivent pas pouvoir déclencher un envoi massif de notifications.
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

export async function POST(request: Request) {
  return handleTriggerRequest(request);
}
