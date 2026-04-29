#!/usr/bin/env node

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const defaultPort = process.env.PORT || "8095";
const triggerUrl = process.env.NOTIFICATION_TRIGGER_URL || `http://127.0.0.1:${defaultPort}/api/notifications/trigger`;
const cronSecret = process.env.CRON_SECRET;
const timeoutMs = Number(process.env.NOTIFICATION_TRIGGER_TIMEOUT_MS || 30000);

function fail(message, error) {
  console.error(`[notifications] ${message}`);
  if (error) {
    console.error(error);
  }
  process.exit(1);
}

if (!cronSecret) {
  fail("CRON_SECRET is missing. Configure it in your environment before running the cron trigger.");
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail("NOTIFICATION_TRIGGER_TIMEOUT_MS must be a positive number.");
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);

(async () => {
  try {
    console.log(`[notifications] Triggering ${triggerUrl}`);

    const response = await fetch(triggerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cron-secret": cronSecret,
      },
      signal: controller.signal,
    });

    const responseText = await response.text();
    let payload = {};

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = { raw: responseText };
      }
    }

    if (!response.ok) {
      fail(`Trigger failed with status ${response.status}.`, payload);
    }

    console.log("[notifications] Trigger completed successfully.");
    console.log(JSON.stringify(payload));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      fail(`Trigger timed out after ${timeoutMs}ms.`);
    }

    fail("Trigger request failed.", error);
  } finally {
    clearTimeout(timeout);
  }
})();
