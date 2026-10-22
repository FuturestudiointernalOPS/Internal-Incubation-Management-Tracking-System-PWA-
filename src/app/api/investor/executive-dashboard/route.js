import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { buildExecutiveDashboard } from "@/services/investor";

/**
 * GET /api/investor/executive-dashboard
 *
 * The eight blocks the executive view aggregates live in `@/services/investor`.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;

    const dashboard = await buildExecutiveDashboard();

    return NextResponse.json({ success: true, ...dashboard });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
