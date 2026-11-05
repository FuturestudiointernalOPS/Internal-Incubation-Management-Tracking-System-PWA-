import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { resolveInvestorContext } from "@/services/investor/activity";
import { requestIntroduction, listMyIntroductions } from "@/services/investor/introductions";

/** GET /api/investor/introductions — the caller's own introduction requests. */
export async function GET() {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const ctx = await resolveInvestorContext(await getSession());
    if (!ctx.investorId) {
      return NextResponse.json({ success: true, requests: [] });
    }
    const result = await listMyIntroductions({ investorId: ctx.investorId });
    return NextResponse.json({ success: true, requests: result.requests });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/introductions { venture_id, pipeline_id?, deal_flow_entry_id?, message? } */
export async function POST(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const session = await getSession();
    const ctx = await resolveInvestorContext(session);
    if (!ctx.investorId) {
      return NextResponse.json({ success: false, error: "No investor profile." }, { status: 403 });
    }

    const { venture_id, pipeline_id, deal_flow_entry_id, message } = await req.json();
    if (!venture_id) {
      return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });
    }

    const result = await requestIntroduction({
      investorId: ctx.investorId,
      ventureId: venture_id,
      pipelineId: pipeline_id ?? null,
      dealFlowEntryId: deal_flow_entry_id ?? null,
      message: message ?? null,
      session,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, request: result.request });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
