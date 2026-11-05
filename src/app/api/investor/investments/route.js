import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireAuthorization } from "@/models/authorization/index";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { resolveInvestorContext } from "@/services/investor/activity";
import { listMyInvestments, recordInvestment } from "@/services/investor/investment";

/** GET /api/investor/investments — the caller's own confirmed investments. */
export async function GET() {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const ctx = await resolveInvestorContext(await getSession());
    if (!ctx.investorId) {
      return NextResponse.json({ success: true, investments: [] });
    }
    const result = await listMyInvestments({ investorId: ctx.investorId });
    return NextResponse.json({ success: true, investments: result.investments });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/investor/investments — the STUDIO confirms an investment.
 * { investor_id, pipeline_id, venture_id, amount, currency, instrument?, invested_on? }
 */
export async function POST(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "edit");
    if (authError) return authError;

    const body = await req.json();
    const result = await recordInvestment({ ...body, session: await getSession() });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, investment: result.investment });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
