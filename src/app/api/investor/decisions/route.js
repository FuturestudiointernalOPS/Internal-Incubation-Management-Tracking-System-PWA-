import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import {
  getInvestorDecisionStats,
  getInvestorProfileIdForDecisions,
  listInvestorDecisions,
  listInvestorHistoryTimeline,
  recordInvestmentDecision,
  updatePipelineStageAfterDecision,
} from "@/models/investorRelations";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";

/** GET /api/investor/decisions — all decisions for current investor */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const session = await getSession();
    const prof = await getInvestorProfileIdForDecisions(session.cid || session.id);
    if (prof.rows.length === 0) {
      return NextResponse.json({ success: true, decisions: [], history: [] });
    }

    // All decisions with venture info
    const decisions = await listInvestorDecisions(prof.rows[0].id);

    // Investment history timeline (all pipeline activity)
    const history = await listInvestorHistoryTimeline(prof.rows[0].id);

    // Stats
    const stats = await getInvestorDecisionStats(prof.rows[0].id);

    return NextResponse.json({
      success: true,
      decisions: decisions.rows,
      history: history.rows,
      stats: stats.rows[0] || { total_invested: 0, total_capital: 0, total_declined: 0, total_decisions: 0 },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/decisions — record a decision */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const { pipeline_id, decision_type, investment_amount, decision_notes } = await req.json();

    if (!pipeline_id || !decision_type) {
      return NextResponse.json({ success: false, error: "pipeline_id and decision_type required" }, { status: 400 });
    }

    const valid = ["invest", "decline", "continue_discussions", "revisit_later"];
    if (!valid.includes(decision_type)) {
      return NextResponse.json({ success: false, error: "Invalid decision_type" }, { status: 400 });
    }

    // Record decision
    await recordInvestmentDecision(pipeline_id, decision_type, investment_amount || null, decision_notes || null);

    // Update pipeline stage
    const stageMap = {
      invest: "invested",
      decline: "declined",
      continue_discussions: "negotiation",
      revisit_later: "watching",
    };

    await updatePipelineStageAfterDecision(stageMap[decision_type], pipeline_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
