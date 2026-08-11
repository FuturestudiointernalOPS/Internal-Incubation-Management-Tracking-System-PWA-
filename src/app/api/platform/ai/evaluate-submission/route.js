import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { evaluateSubmission, hasEvaluation, getEvaluation } from "@/lib/platform/ai/evaluate";

/**
 * POST /api/platform/ai/evaluate-submission
 * Body: { submission_id: number } — evaluate single
 * Body: { form_id: number, action: "batch" } — evaluate all submissions for form
 */
export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "admin", "program_manager", "teacher"]);
    if (authError) return authError;

    const body = await req.json();

    // ── BATCH EVALUATION ──
    if (body.action === "batch" && body.form_id) {
      const { default: db, initDb } = await import("@/lib/db");
      await initDb();

      // Get all submissions for runs of this form that haven't been evaluated yet
      const subs = await db.execute({
        sql: `SELECT ps.id FROM platform_form_submissions ps
              JOIN platform_form_runs r ON ps.run_id = r.id
              WHERE r.form_id = ? AND ps.status = 'submitted'
              AND ps.id NOT IN (SELECT submission_id FROM platform_submission_evaluations)
              ORDER BY ps.id`,
        args: [parseInt(body.form_id)],
      });

      if (subs.rows.length === 0) {
        return NextResponse.json({ success: true, message: "No submissions to evaluate", evaluated: 0, failed: 0 });
      }

      let evaluated = 0;
      let failed = 0;
      for (const row of subs.rows) {
        try {
          await evaluateSubmission(row.id);
          evaluated++;
        } catch (e) {
          console.error("[Batch Eval] Failed for submission", row.id, ":", e.message);
          failed++;
        }
      }

      return NextResponse.json({ success: true, evaluated, failed, total: subs.rows.length });
    }

    // ── SINGLE EVALUATION ──
    const { submission_id } = body;
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
