import { withInvestorPrivacy } from "@/server/investor/withPrivacy";
import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { resolveInvestorContext } from "@/services/investor/activity";
import { listDealFlowForInvestor } from "@/services/investor/dealFlow";

/**
 * GET /api/investor/deal-flow
 *
 * The live deal flow for the caller's visibility mode. DTO-shaped: no hidden
 * venture metrics and no unpublished deck leak through this endpoint.
 */
async function GETWithOriginalGuards() {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const ctx = await resolveInvestorContext(await getSession());
    const result = await listDealFlowForInvestor({ mode: ctx.visibilityMode || "deal_flow_only" });

    return NextResponse.json({ success: true, entries: result.entries });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const GET = withInvestorPrivacy(GETWithOriginalGuards, "dealFlow");
