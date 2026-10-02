import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { listUserAnalytics } from "@/services/dashboard/adminAnalytics";

/**
 * GET /api/admin/analytics/users?user_id=...
 *
 * Per-user execution analytics for the Super Admin drill-down. The per-user
 * aggregation lives in `services/dashboard/adminAnalytics`.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const { status, body } = await listUserAnalytics(searchParams.get("user_id"));
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
