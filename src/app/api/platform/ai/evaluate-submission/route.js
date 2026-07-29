import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { evaluateSubmission, hasEvaluation, getEvaluation } from "@/lib/platform/ai/evaluate";

/**
 * POST /api/platform/ai/evaluate-submission
 * Body: { submission_id: number }
 * Returns: { success: true, evaluation: { dimensions, overall_score, ranking } }
 *
 * GET /api/platform/ai/evaluate-submission?submission_id=X
 * Returns the latest evaluation for a submission (without triggering new one)
 *
 * GET /api/platform/ai/evaluate-submission?form_id=X
 * Returns: { success: true, has_evaluation: boolean }
 */
export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "admin", "program_manager", "teacher"]);
    if (authError) return authError;

    const { submission_id } = await req.json();
    if (!submission_id) {
      return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });
    }

    const evaluation = await evaluateSubmission(submission_id);
    if (!evaluation) {
      return NextResponse.json({ success: false, error: "Evaluation failed or no framework configured" }, { status: 400 });
    }

    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const subId = searchParams.get("submission_id");
    if (subId) {
      const evalRow = await getEvaluation(parseInt(subId));
      return NextResponse.json({ success: true, evaluation: evalRow });
    }

    const formId = searchParams.get("form_id");
    if (!formId) {
      return NextResponse.json({ success: false, error: "form_id or submission_id required" }, { status: 400 });
    }

    const exists = await hasEvaluation(parseInt(formId));
    return NextResponse.json({ success: true, has_evaluation: exists });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
