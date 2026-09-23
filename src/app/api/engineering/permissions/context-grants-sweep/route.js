import { NextResponse } from "next/server";
import { syncAllContextGrantsEverywhere } from "@/models/authorization/contextGrants";

export const dynamic = "force-dynamic";

/**
 * POST /api/engineering/permissions/context-grants-sweep?key=SECRET_KEY
 *
 * Scheduled reconcile of EVERY assignment-derived access grant.
 *
 * WHY THIS EXISTS: program access for a facilitator or a program manager lasts
 * only as long as the program runs. Two mechanisms end it, deliberately
 * belt-and-braces:
 *
 *   1. Every program-derived grant carries the program's end date as its
 *      expiry, and the authorization resolver ignores expired grants — so
 *      access dies on its own at midnight of the end date even if nothing ever
 *      calls this endpoint.
 *   2. This sweep withdraws the grants outright (and removes the provenance
 *      rows) once the assignment stops being active — a program marked
 *      completed/archived, or an end date in the past. It is also the backfill
 *      for people whose assignments predate the mechanism.
 *
 * Secured like the other scheduled endpoints in this app: a shared secret in
 * the query string, compared to CONTEXT_GRANTS_SECRET_KEY. Returns 503 when the
 * secret is not configured, so an unconfigured deployment never exposes an
 * unauthenticated write path.
 *
 * Recommended cadence: daily (a program's end date is the access boundary; a
 * day of lag is bounded, and the expiry in (1) already covers the instant
 * cutoff).
 */
const SWEEP_SECRET = process.env.CONTEXT_GRANTS_SECRET_KEY;

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    // The secret travels in a header so it stops landing in access logs; the
    // query parameter is still accepted for existing schedulers (deprecated).
    const key = req.headers.get("x-cron-secret") || searchParams.get("key");

    if (!SWEEP_SECRET) {
      return NextResponse.json(
        { success: false, error: "Service not configured." },
        { status: 503 },
      );
    }
    if (!key || key !== SWEEP_SECRET) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    const report = await syncAllContextGrantsEverywhere();
    return NextResponse.json(report);
  } catch (error) {
    console.error("[Context Grants Sweep] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
