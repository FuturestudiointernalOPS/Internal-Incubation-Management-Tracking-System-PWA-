import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

import { requireInvestorStudioAuthorization as requireAuthorization } from "@/server/investor/studioAuthorization";
import { getStudioCapitalMetrics } from "@/services/investor/studioCapital";

/**
 * GET /api/admin/investors/portfolio-metrics
 *
 * The studio capital metrics (F1–F8) shown on the Studio Portfolio page.
 * F2/F5/F6/F7 return null until studio capital, valuations, ownership and exits
 * are captured — they are never fabricated.
 */
export async function GET() {
  try {
    await initDb();

    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;

    const metrics = await getStudioCapitalMetrics();
    return NextResponse.json({ success: true, metrics });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
