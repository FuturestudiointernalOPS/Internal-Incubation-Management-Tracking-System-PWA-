import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  ensureTables,
  getProgressReport,
  runEvaluationBatch,
  evaluateOneSubmission,
  getSubmissionEvaluation,
  hasFormAiEvaluation,
} from "@/services/platform/evaluation";

/**
 * POST /api/platform/ai/evaluate-submission
 *
 * Body: { submission_id: number }                    — evaluate single submission
 * Body: { form_id: number, action: "batch" }         — evaluate next batch of unevaluated
 * Body: { form_id: number, action: "retry_failed" }  — retry only failed submissions
 * Body: { form_id: number, action: "progress" }      — return progress counts only
 *
 * See services/platform/evaluation.js for the batch model.
 */

// Vercel: allow this route to run long enough for several AI evaluations
// (Fluid compute clamps to the plan limit; harmless on smaller plans).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { initDb } = await import("@/lib/db");
    await initDb();
    await ensureTables();

    // Admission authority, in the two shapes this endpoint has. Evaluating a
    // submission can AUTO-APPROVE the applicant, change their status and send
    // the decision email — that is exactly `runs.review`, a standalone
    // capability precisely so that holding `runs.edit` (messages, assignments,
    // retries) never implies the right to admit someone. Reading evaluation
    // PROGRESS is only a read, so it stays on `runs.view`: a reviewer who may
    // not decide can still watch the batch run.
    //
    // This used to be a hardcoded ["super_admin", "admin", "program_manager"]
    // role list — no grant, profile or individual assignment could satisfy it,
    // and it names the retired `admin` role. Both capabilities are now
    // configurable from the front end (Default Access, or individual access).
    const capError = await requireAuthorization(
      "runs",
      body.action === "progress" ? "view" : "review",
    );
    if (capError) return capError;

    // ── PROGRESS ONLY ──
    if (body.action === "progress" && body.form_id) {
      const report = await getProgressReport(body.form_id);
      return NextResponse.json({ success: true, ...report });
    }

    // ── BATCH / RETRY ──
    if ((body.action === "batch" || body.action === "retry_failed") && body.form_id) {
      const result = await runEvaluationBatch({ form_id: body.form_id, action: body.action, batch_size: body.batch_size });
      return NextResponse.json({ success: true, action: body.action, ...result });
    }

    // ── SINGLE EVALUATION ──
    const result = await evaluateOneSubmission({ submission_id: body.submission_id, force: body.force });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    return NextResponse.json({ success: true, evaluation: result.evaluation, re_evaluated: result.re_evaluated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    // Reading one submission's evaluation (scores and the respondent PII
    // behind them) is a read, so it is gated on `runs.view`. Whether the
    // reader may ACT on it is the POST's concern, which requires `runs.review`.
    const capError = await requireAuthorization("runs", "view");
    if (capError) return capError;

    const { initDb } = await import("@/lib/db");
    await initDb();
    const { searchParams } = new URL(req.url);
    const subId = searchParams.get("submission_id");
    if (subId) {
      const evalRow = await getSubmissionEvaluation(subId);
      return NextResponse.json({ success: true, evaluation: evalRow });
    }

    const formId = searchParams.get("form_id");
    if (!formId) {
      return NextResponse.json({ success: false, error: "form_id or submission_id required" }, { status: 400 });
    }

    const exists = await hasFormAiEvaluation(formId);
    return NextResponse.json({ success: true, has_evaluation: exists });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
