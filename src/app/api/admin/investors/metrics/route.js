import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorStudioAuthorization as requireAuthorization } from "@/server/investor/studioAuthorization";
import { getInvestorMetrics } from "@/services/investor/metrics";

/**
 * GET /api/admin/investors/metrics?from=&to=
 *
 * The studio's investor metrics (A–F), derived live from the event log and the
 * tables. Missing data is null, never zero. F5–F7 live on the Studio Portfolio.
 */
export async function GET(req) {
  try {
    await initDb();

    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;
    await ensureInvestorExpansionSchema();

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || null;
    const to = searchParams.get("to") || null;

    const metrics = await getInvestorMetrics({ from, to });
    return NextResponse.json({ success: true, metrics });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
