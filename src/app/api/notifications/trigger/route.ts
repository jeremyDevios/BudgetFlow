import { NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET(request: Request) {
  // 1. Security Check
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  
  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Debug: Log that we are starting
    console.log("Starting notification trigger...");

    // Remove the filter here to see if we get ANY users, then check token in loop
    const usersSnap = await adminDb.collection("users").get();
    
    console.log(`Found ${usersSnap.size} total users in database.`);

    const notifications: Promise<string | void>[] = [];
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startIso = startOfDay.toISOString();

    let sentCount = 0;
    let eligibleCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      
      // Debug log for each user (only ID and flags)
      // console.log(`Checking user ${userDoc.id}: Enabled? ${userData.notificationsEnabled}, HasToken? ${!!userData.fcmToken}`);

      // Memory filter for enabled
      // If it is strictly false, skip. If undefined or true, continue.
      if (userData.notificationsEnabled === false) continue;
      
      const token = userData.fcmToken;
      if (!token) continue;

      eligibleCount++;

      // 2. Check for daily transactions
      // Optional: wrap in try/catch to avoid one failure stopping the loop
      try {
        const transactionsSnap = await adminDb
          .collection("users")
          .doc(userDoc.id)
          .collection("transactions")
          .where("date", ">=", startIso)
          .get();

        let dailyTotal = 0;
        let transactionCount = 0;

        transactionsSnap.forEach((txDoc) => {
          const data = txDoc.data();
          if (data.amount) {
            dailyTotal += Number(data.amount);
            transactionCount++;
          }
        });

        // 3. Construct Message
        let body = "Avez-vous pensé à saisir vos dépenses ?";
        if (transactionCount > 0) {
          body = `Vous avez déjà saisi ${dailyTotal.toFixed(2)}€ ` +
            `aujourd'hui (${transactionCount} dépenses). ` +
            "Avez-vous oublié quelque chose ?";
        } else {
          body = "Aucune dépense saisie aujourd'hui. Rien à déclarer ?";
        }

        const message = {
          token: token,
          notification: {
            title: "Bilan Quotidien 💸",
            body: body,
          },
          webpush: {
            fcmOptions: {
              link: "/dashboard", // Absolute URL handled by browser usually
            },
            notification: {
              icon: "/icon.png",
              badge: "/icon.png"
            },
          },
        };

        // 4. Send
        // We push the promise but catch inside map effectively
        notifications.push(
          adminMessaging.send(message).then(() => {
            sentCount++;
            console.log(`Notification sent to ${userDoc.id}`);
          }).catch((error) => {
            console.error(`Error sending to user ${userDoc.id}:`, error);
            // If invalid token, remove it
            if (error.code === 'messaging/registration-token-not-registered') {
               adminDb.collection("users").doc(userDoc.id).update({
                   fcmToken: null
               });
            }
          })
        );

      } catch (err) {
        console.error(`Error processing user ${userDoc.id}`, err);
      }
    }

    await Promise.all(notifications);

    return NextResponse.json({
      success: true,
      total_users_scanned: usersSnap.size,
      eligible_users: eligibleCount,
      sent: sentCount
    });
    
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
