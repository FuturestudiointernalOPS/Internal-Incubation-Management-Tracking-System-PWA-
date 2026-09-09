import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import {
  createFounderEvaluation,
  listFounderEvaluationsByPipelineId,
  listRiskAssessmentsByPipelineId,
  upsertRiskAssessment,
} from "@/models/investor";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";

/**
 * GET /api/investor/evaluation?pipeline_id=X
 * Returns founder evaluations + risk assessments for a pipeline.
 *
 * POST /api/investor/evaluation
 * Body: { pipeline_id, type: "founder"|"risk", ...fields }
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipeline_id");
    if (!pipelineId) return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });

    const [founders, risks] = await Promise.all([
      listFounderEvaluationsByPipelineId(pipelineId),
      listRiskAssessmentsByPipelineId(pipelineId),
    ]);

    return NextResponse.json({
      success: true,
      founder_evaluations: founders.rows,
      risk_assessments: risks.rows,
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

    const session = await getSession();
    const body = await req.json();
    const { pipeline_id, type, ...fields } = body;

    if (!pipeline_id || !type) {
      return NextResponse.json({ success: false, error: "pipeline_id and type required" }, { status: 400 });
    }

    if (type === "founder") {
      const { founder_name, role, experience_score, leadership_score, domain_expertise_score, overall_rating, notes } = fields;
      if (!founder_name) return NextResponse.json({ success: false, error: "founder_name required" }, { status: 400 });

      const result = await createFounderEvaluation({ pipeline_id, founder_name, role, experience_score, leadership_score, domain_expertise_score, overall_rating, notes, created_by: session.cid || session.id });
      return NextResponse.json({ success: true, evaluation: result.rows[0] });
    }

    if (type === "risk") {
      const { risk_category, risk_description, severity, mitigation, status } = fields;
      if (!risk_category || !risk_description) return NextResponse.json({ success: false, error: "risk_category and risk_description required" }, { status: 400 });

      const result = await upsertRiskAssessment({ pipeline_id, risk_category, risk_description, severity, mitigation, status, created_by: session.cid || session.id });
      return NextResponse.json({ success: true, evaluation: result.rows[0] });
    }

    return NextResponse.json({ success: false, error: "Invalid type. Use 'founder' or 'risk'" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
