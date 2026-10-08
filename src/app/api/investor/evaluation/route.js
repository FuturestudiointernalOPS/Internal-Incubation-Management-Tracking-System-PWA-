import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { listEvaluationsForViewer, createEvaluation } from "@/services/investor";

/**
 * GET /api/investor/evaluation?pipeline_id=X
 * Returns founder evaluations + risk assessments for a pipeline.
 *
 * POST /api/investor/evaluation
 * Body: { pipeline_id, type: "founder"|"risk", ...fields }
 *
 * The own-scope binding of the pipeline and the write dispatch by type live in
 * `@/services/investor`.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipeline_id");

    const result = await listEvaluationsForViewer({
      pipelineId,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      founder_evaluations: result.founder_evaluations,
      risk_assessments: result.risk_assessments,
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

    const body = await req.json();
    const { pipeline_id, type, ...fields } = body;

    const result = await createEvaluation({
      pipelineId: pipeline_id,
      type,
      fields,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, evaluation: result.evaluation });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
