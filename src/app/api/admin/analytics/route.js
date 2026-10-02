import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getExecutionAnalytics } from "@/services/dashboard/adminAnalytics";

/**
 * GET /api/admin/analytics
 *
 * Returns high-level execution analytics for the Super Admin dashboard.
 * Aggregates task, blocker, standup, retro, and project stats.
 *
 * The aggregation and the derived rates live in
 * `services/dashboard/adminAnalytics`; this controller keeps the authentication
 * and the envelope.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { status, body } = await getExecutionAnalytics();
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET admin/analytics error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
