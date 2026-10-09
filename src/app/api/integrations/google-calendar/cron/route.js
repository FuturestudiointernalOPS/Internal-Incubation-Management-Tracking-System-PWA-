import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { resolveSweepAuthorization, secretMatches } from "@/services/authorization/scheduledSweeps";
import { syncAllConnections } from "@/services/integrations/googleCalendar";

/**
 * Scheduled Google Calendar sync — every connected user, both directions, and
 * renewal of the push channels before they expire (Google caps them at 7 days).
 *
 *   curl -X POST "$APP_URL/api/integrations/google-calendar/cron" -H "x-cron-secret: $CRON_SECRET"
 *
 * Also accepts GET with `Authorization: Bearer $CRON_SECRET` (Vercel Cron).
 * Same shared-secret decision as the other scheduled sweeps: 503 when no secret
 * is configured, 403 on a missing/wrong one. Safe to run twice.
 */
async function run(req) {
  try {
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || null;
    const presented = req.headers.get("x-cron-secret") || bearer;
    const configured = process.env.CRON_SECRET;

    const authorization = resolveSweepAuthorization({
      isConfigured: Boolean(configured),
      presentedKey: presented,
    });
    if (!authorization.ok) {
      return NextResponse.json({ success: false, error: authorization.error }, { status: authorization.status });
    }
    if (!secretMatches(presented, configured)) {
      return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 });
    }

    await initDb();
    const report = await syncAllConnections();
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error("[Google Calendar API] cron:", error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
