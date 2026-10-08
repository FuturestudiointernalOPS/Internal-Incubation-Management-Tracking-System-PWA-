import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getEvaluationResult,
  handleEvaluationPost,
} from "@/services/platform/evaluation";

/**
 * POST /api/platform/ai/evaluate-submission
 *
 * Body: { submission_id: number }                    — evaluate single submission
 * Body: { form_id: number, action: "batch" }         — evaluate next batch of unevaluated
 * Body: { form_id: number, action: "retry_failed" }  — retry only failed submissions
 * Body: { form_id: number, action: "progress" }      — return progress counts only
 *
 * The batch model, the progress counts and the single evaluation live in
 * `@/services/platform/evaluation`; the controller keeps the `runs.*`
 * capability split (progress is a read, evaluating can auto-approve).
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

    // Admission authority, in the two shapes this endpoint has. Evaluating a
    // submission can AUTO-APPROVE the applicant, change their status and send
    // the decision email — that is exactly `runs.review`, a standalone
    // capability precisely so that holding `runs.edit` (messages, assignments,
    // retries) never implies the right to admit someone. Reading evaluation
    // PROGRESS is only a read, so it stays on `runs.view`: a reviewer who may
    // not decide can still watch the batch run.
    const capError = await requireAuthorization(
      "runs",
      body.action === "progress" ? "view" : "review",
    );
    if (capError) return capError;

    const result = await handleEvaluationPost(body);
    return NextResponse.json(result.body, { status: result.status });
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

    const result = await getEvaluationResult({
      submissionId: searchParams.get("submission_id"),
      formId: searchParams.get("form_id"),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
