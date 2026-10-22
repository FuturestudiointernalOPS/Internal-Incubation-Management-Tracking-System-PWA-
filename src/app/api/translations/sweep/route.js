import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { resolveSweepAuthorization, secretMatches } from "@/services/authorization/scheduledSweeps";
import { runTranslationSweep } from "@/services/translations/ventureContent";

/**
 * POST /api/translations/sweep — the warm-up that happens BEFORE the visit.
 *
 * Point a clock at this (hourly is enough) and a Venture nobody has opened yet
 * already has its wording translated, so its first reader pays nothing.
 *
 *   curl -X POST "$APP_URL/api/translations/sweep" -H "x-cron-secret: $CRON_SECRET"
 *
 *   ?venture=VNT-…        warm that ONE Venture, now (testing, or after an import)
 *   ?limit=50             how many Ventures this run may take (default 20)
 *   ?max_age_minutes=60   skip the ones warmed more recently (default 60)
 *
 * Credentials follow the platform's existing scheduled-sweep pattern: the same
 * `x-cron-secret` header, the same shared decision, and the same refusal (503)
 * when no secret is configured rather than an unauthenticated write path.
 *
 * Running it twice is SAFE: translations are keyed on the text, so a second run
 * reaches the provider for nothing and only touches the rotation table.
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
    const report = await runTranslationSweep({
      ventureRef: searchParams.get("venture") || null,
      limit: searchParams.get("limit"),
      maxAgeMinutes: searchParams.get("max_age_minutes"),
    });

    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
