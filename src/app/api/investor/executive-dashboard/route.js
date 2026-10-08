import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { buildExecutiveDashboard } from "@/services/investor";

/**
 * GET /api/investor/executive-dashboard
 *
 * The eight blocks the executive view aggregates live in `@/services/investor`.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const dashboard = await buildExecutiveDashboard();

    return NextResponse.json({ success: true, ...dashboard });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
