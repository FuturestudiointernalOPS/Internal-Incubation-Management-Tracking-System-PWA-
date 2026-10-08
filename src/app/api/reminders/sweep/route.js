import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { resolveSweepAuthorization, secretMatches } from "@/services/authorization/scheduledSweeps";
import { runReminderSweep } from "@/services/reminders/sweep";

/**
 * POST /api/reminders/sweep — the scheduled reminder run.
 *
 * Point a clock at this once a day; it is the ONLY thing that makes an automatic
 * reminder automatic.
 *
 *   curl -X POST "$APP_URL/api/reminders/sweep" -H "x-cron-secret: $CRON_SECRET"
 *
 * An optional `?venture=VNT-…` sweeps that ONE Venture, which is how a rule gets
 * tested without waiting for tomorrow.
 *
 * Credentials follow the platform's existing scheduled-sweep pattern — the same
 * `x-cron-secret` header, the same shared decision in
 * `@/services/authorization/scheduledSweeps`, which refuses (503) rather than
 * degrading into an unauthenticated write path when no secret is configured.
 * The secret is deliberately NOT one of the older job secrets: reminder mail is
 * sent to real people, so it gets its own.
 *
 * Running this twice is SAFE: every automatic reminder is claimed in the log
 * before it is sent, so the second run reports what it skipped.
 */
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const presented = req.headers.get("x-cron-secret") || searchParams.get("key");
    const configured = process.env.CRON_SECRET || process.env.REMINDERS_SECRET_KEY;

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
    const report = await runReminderSweep({ ventureCode: searchParams.get("venture") || null });

    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
