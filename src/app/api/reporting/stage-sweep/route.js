import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { resolveSweepAuthorization, secretMatches } from "@/services/authorization/scheduledSweeps";
import { runStageSweep } from "@/services/ventures/reporting/stageSweep";

/**
 * POST/GET /api/reporting/stage-sweep — the scheduled stage re-evaluation.
 *
 * Point a clock at this every Monday (see `vercel.json`: `0 6 * * 1`). It
 * re-tests every Venture against the current thresholds and creates a PENDING
 * stage proposal where every criterion is met. Nothing is promoted: the studio
 * confirms.
 *
 *   curl -X POST "$APP_URL/api/reporting/stage-sweep" -H "x-cron-secret: $CRON_SECRET"
 *   curl -X POST "$APP_URL/api/reporting/stage-sweep?venture=VNT-…" -H "x-cron-secret: $CRON_SECRET"
 *
 * Credentials follow the platform's existing scheduled-sweep pattern: the same
 * `x-cron-secret` header (or `Authorization: Bearer`, which is what Vercel Cron
 * sends), the same shared decision in `@/services/authorization/scheduledSweeps`.
 * When no secret is configured the route refuses with 503 rather than degrading
 * into an unauthenticated write path.
 *
 * Running it twice is SAFE: an eligible venture that already has a pending
 * proposal reports `already_pending` and is not duplicated.
 */
async function handle(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || null;
    const presented = req.headers.get("x-cron-secret") || bearer || searchParams.get("key");
    const configured = process.env.CRON_SECRET || process.env.REMINDERS_SECRET_KEY;

    const authorization = resolveSweepAuthorization({
      isConfigured: Boolean(configured),
      presentedKey: presented,
    });
    if (!authorization.ok) {
      return NextResponse.json(
        { success: false, error: authorization.error },
        { status: authorization.status },
      );
    }
    if (!secretMatches(presented, configured)) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    await initDb();
    const report = await runStageSweep({ ventureCode: searchParams.get("venture") || null });
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  return handle(req);
}

/** Vercel Cron calls with GET; it runs the same sweep. */
export async function GET(req) {
  return handle(req);
}
