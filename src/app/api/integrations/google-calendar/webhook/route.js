import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { handleNotification } from "@/services/integrations/googleCalendar";

/**
 * POST /api/integrations/google-calendar/webhook — Google push notifications.
 *
 * Google calls this (no session) whenever the "Future Studio" calendar changes.
 * The body is empty; everything is in the X-Goog-* headers. The request is
 * trusted only if X-Goog-Channel-Token matches the secret we chose when opening
 * the channel. The answer is a bare status code — Google only reads that.
 */
export async function POST(req) {
  try {
    await initDb();
    const { status } = await handleNotification({
      channelId: req.headers.get("x-goog-channel-id"),
      channelToken: req.headers.get("x-goog-channel-token"),
      resourceState: req.headers.get("x-goog-resource-state"),
    });
    return new NextResponse(null, { status });
  } catch (error) {
    console.error("[Google Calendar API] webhook:", error.message);
    // 200 anyway: a 5xx makes Google retry with backoff, while the cron
    // already repairs anything a missed notification leaves behind.
    return new NextResponse(null, { status: 200 });
  }
}
