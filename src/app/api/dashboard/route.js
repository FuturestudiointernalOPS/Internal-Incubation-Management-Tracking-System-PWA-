import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { requireAuthorization } from "@/models/authorization/index";
import { getSession } from "@/server/auth/session";
import { buildDashboardOverview, getDashboardKpiSummary } from "@/services/dashboard/overview";

/**
 * UNIFIED DASHBOARD API — OPTIMIZED (parallel queries)
 *
 * GET /api/dashboard?user_id=X&role=Y&year=2026&month=7
 *
 * All independent database queries run in parallel via Promise.all.
 * Response time = slowest single query, not sum of all queries.
 *
 * The scope resolution (IDOR guard), the read bundle, the calendar assembly and
 * the summary/attention/quick-access shaping live in
 * `services/dashboard/overview`; this controller keeps the authentication and
 * the response envelope.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);

    // Shortcut: KPI summary for the admin dashboard (no user_id required).
    // Program KPIs are a program read; the platform owner bypasses.
    if (searchParams.get("summary") === "true") {
      const capError = await requireAuthorization("programs", "view");
      if (capError) return capError;
      return NextResponse.json({ success: true, programs: await getDashboardKpiSummary() });
    }

    // Who may read WHOSE dashboard is decided by `buildDashboardOverview` (the
    // IDOR guard lives there), so the route keeps the session check only.
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
    }

    const { status, body } = await buildDashboardOverview({
      session,
      requestedUserId: searchParams.get("user_id"),
      requestedRole: searchParams.get("role"),
      year: parseInt(searchParams.get("year")) || new Date().getFullYear(),
      month: parseInt(searchParams.get("month")) || new Date().getMonth() + 1,
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET dashboard error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
