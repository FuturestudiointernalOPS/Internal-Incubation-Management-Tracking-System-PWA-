import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { listDecisionsForViewer, recordDecision } from "@/services/investor";

/**
 * GET /api/investor/decisions — all decisions for current investor
 *
 * POST /api/investor/decisions — record a decision
 *
 * The profile resolution, the valid decision types and the stage mapping live
 * in `@/services/investor`.
 */
export async function GET(_req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const result = await listDecisionsForViewer({ session: await getSession() });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      decisions: result.decisions,
      history: result.history,
      stats: result.stats,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const { pipeline_id, decision_type, investment_amount, decision_notes } = await req.json();

    const result = await recordDecision({
      pipelineId: pipeline_id,
      decisionType: decision_type,
      investmentAmount: investment_amount,
      decisionNotes: decision_notes,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
