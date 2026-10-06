import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
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

    // Shortcut: KPI summary for Super Admin dashboard (no user_id required)
    if (searchParams.get("summary") === "true") {
      const authError = await requireAuth(["super_admin"]);
      if (authError) return authError;
      return NextResponse.json({ success: true, programs: await getDashboardKpiSummary() });
    }

    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
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
