import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireAuthorization } from "@/models/authorization/index";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { resolveInvestorContext } from "@/services/investor/activity";
import {
  claimInvestment,
  listMyInvestments,
  recordInvestment,
} from "@/services/investor/investment";

/** GET /api/investor/investments — the caller's own investment claims. */
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
 * POST /api/investor/investments
 *
 * Investor claim (Phase 5): { venture_id, amount, currency, instrument?, invested_on? }
 *   → pending until the studio confirms.
 *
 * Studio legacy confirm (flag-off / back-compat):
 *   { investor_id, pipeline_id, venture_id, amount, currency, … } with investor.edit.
 */
export async function POST(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const body = await req.json();
    const session = await getSession();

    // Investor self-service claim.
    if (body?.venture_id && !body?.pipeline_id) {
      const capError = await requireInvestorSelfServiceAuthorization("create");
      if (capError) return capError;

      const result = await claimInvestment({
        ventureId: body.venture_id,
        amount: body.amount,
        currency: body.currency,
        instrument: body.instrument ?? null,
        investedOn: body.invested_on ?? null,
        session,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({
        success: true,
        investment: result.investment,
        pipeline: result.pipeline,
      });
    }

    // Studio immediate record (legacy / tooling).
    const authError = await requireAuthorization("investor", "edit");
    if (authError) return authError;

    const result = await recordInvestment({ ...body, session });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, investment: result.investment });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
