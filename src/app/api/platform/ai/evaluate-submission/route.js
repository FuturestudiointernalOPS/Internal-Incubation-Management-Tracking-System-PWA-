import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { evaluateSubmission, formHasAiEvaluation, getEvaluation } from "@/lib/platform/ai/evaluate";
import { maybeAutoApprove } from "@/models/platform/ai/autoApprove";
import {
  claimEvaluationSubmission,
  countApprovalDecisionsForForm,
  countProgressEvaluatedSubmissions,
  countProgressFailedSubmissions,
  countProgressTotalSubmissions,
  createEvaluationClaimsTable,
  createEvaluationFailuresTable,
  deleteEvaluationFailureRecord,
  deleteEvaluationsForSubmission,
  deleteExpiredEvaluationClaims,
  findEvaluationBatchCandidates,
  recordEvaluationFailure,
  releaseEvaluationClaim,
  resetEvaluationFailuresForSubmission,
} from "@/models/platformAi";

/**
 * POST /api/platform/ai/evaluate-submission
 *
 * Body: { submission_id: number }                    — evaluate single submission
 * Body: { form_id: number, action: "batch" }         — evaluate next batch of unevaluated
 * Body: { form_id: number, action: "retry_failed" }  — retry only failed submissions
 * Body: { form_id: number, action: "progress" }      — return progress counts only
 *
 * PHASE 4 BATCH MODEL (client-driven):
 *  - Each batch request claims + evaluates up to batch_size submissions
 *  - Claims use an expiry table so two concurrent processes never double-evaluate
 *  - Successes are saved individually (platform_submission_evaluations)
 *  - Failures are recorded (platform_evaluation_failures) for targeted retry
 *  - Progress % reflects only successfully saved evaluations
 */

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 15;
const CLAIM_TTL_MINUTES = 15;
const AI_TIMEOUT_MS = 180000; // per-submission AI call timeout
const IN_FLIGHT = 4; // concurrent AI evaluations within one batch request

// Vercel: allow this route to run long enough for several AI evaluations
// (Fluid compute clamps to the plan limit; harmless on smaller plans).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function ensureTables() {
  try {
    await createEvaluationClaimsTable();
    await createEvaluationFailuresTable();
  } catch (error) {
    console.warn("[Batch Eval] Could not ensure tables:", error.message);
  }
}

async function cleanupExpiredClaims() {
  try {
    await deleteExpiredEvaluationClaims(CLAIM_TTL_MINUTES);
  } catch (_) {}
}

async function getProgress(formId) {
  // NOTE: total counts ALL real submissions (submitted/approved/rejected), not
  // only 'submitted' — auto-approval flips status to 'approved' as evaluations
  // complete, and that must not shrink the denominator while the batch runs.
  const [totalRes, evaluatedRes, failedRes] = await Promise.all([
    countProgressTotalSubmissions(formId),
    countProgressEvaluatedSubmissions(formId),
    countProgressFailedSubmissions(formId),
  ]);

  const total = totalRes.rows[0]?.cnt || 0;
  const evaluated = evaluatedRes.rows[0]?.cnt || 0;
  const failed = failedRes.rows[0]?.cnt || 0;
  const remaining = Math.max(0, total - evaluated - failed);

  return {
    total,
    evaluated,
    failed,
    remaining,
    percent: total > 0 ? Math.round((evaluated / total) * 100) : 0,
  };
}

/** Bound a promise so a hanging AI call cannot stall a whole batch forever. */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

async function processSubmission(submissionId) {
  try {
    const result = await withTimeout(evaluateSubmission(submissionId), AI_TIMEOUT_MS, "AI evaluation timed out");
    if (result === null) {
      // evaluateSubmission returns null on failure — record it
      throw new Error("Evaluation failed (null result)");
    }
    // Success: clear any failure record
    try {
      await deleteEvaluationFailureRecord(submissionId);
    } catch (_) {}

    // ── AUTO-APPROVE BY CUTOFF (optional, configurable per form) ──
    await maybeAutoApprove(submissionId, result);

    return { ok: true, score: result.overall_score };
  } catch (error) {
    const errorMessage = error?.message || "Unknown error";
    try {
      await recordEvaluationFailure(submissionId, errorMessage);
    } catch (_) {}
    return { ok: false, error: errorMessage };
  }
}

async function runBatch(formId, onlyFailed, batchSize) {
  // Candidates: submitted, not evaluated, no active claim
  const candidates = await findEvaluationBatchCandidates(formId, batchSize, onlyFailed, CLAIM_TTL_MINUTES);

  if (candidates.rows.length === 0) {
    return { evaluated: 0, failed: 0, processed: 0 };
  }

  // Claim each candidate (ON CONFLICT DO NOTHING — losers were claimed concurrently)
  const claimed = [];
  for (const row of candidates.rows) {
    try {
      const claimResult = await claimEvaluationSubmission(row.id);
      if (claimResult.rows.length > 0) claimed.push(row.id);
    } catch (_) {}
  }

  let evaluatedCount = 0;
  let failedCount = 0;
  // Evaluate claimed submissions with limited concurrency so a 10-submission
  // batch finishes well within the serverless function duration instead of
  // stacking 10 sequential AI calls in one request.
  const results = new Array(claimed.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(IN_FLIGHT, claimed.length) }, async () => {
    while (cursor < claimed.length) {
      const index = cursor++;
      const submissionId = claimed[index];
      const outcome = await processSubmission(submissionId);
      results[index] = outcome;
      // Release claim regardless of outcome
      try {
        await releaseEvaluationClaim(submissionId);
      } catch (_) {}
    }
  });
  await Promise.all(workers);

  for (const outcome of results) {
    if (outcome && outcome.ok) evaluatedCount++;
    else failedCount++;
  }

  return { evaluated: evaluatedCount, failed: failedCount, processed: claimed.length };
}

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
      const progress = await getProgress(body.form_id);
      // Approval + email stats for the dashboard panel
      let approvals = { approved: 0, rejected: 0 };
      let emailStats = { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 };
      try {
        const appRes = await countApprovalDecisionsForForm(body.form_id);
        for (const row of appRes.rows) {
          if (row.status === "approved") approvals.approved = row.cnt;
          if (row.status === "rejected") approvals.rejected = row.cnt;
        }
      } catch (_) {}
      try {
        const { getEmailStatsForForm } = await import("@/lib/email");
        emailStats = await getEmailStatsForForm(body.form_id);
      } catch (_) {}
      return NextResponse.json({ success: true, progress, approvals, emails: emailStats });
    }

    // ── BATCH / RETRY ──
    if ((body.action === "batch" || body.action === "retry_failed") && body.form_id) {
      await cleanupExpiredClaims();
      const batchSize = Math.min(
        parseInt(body.batch_size) || DEFAULT_BATCH_SIZE,
        MAX_BATCH_SIZE
      );
      const onlyFailed = body.action === "retry_failed";

      const batchResult = await runBatch(body.form_id, onlyFailed, batchSize);
      const progress = await getProgress(body.form_id);

      return NextResponse.json({
        success: true,
        action: body.action,
        evaluated: batchResult.evaluated,
        failed: batchResult.failed,
        processed: batchResult.processed,
        progress,
      });
    }

    // ── SINGLE EVALUATION ──
    const { submission_id, force } = body;
    if (!submission_id) {
      return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });
    }

    // Manual Re-evaluate: delete prior evaluations so exactly one current row remains
    if (force) {
      try {
        await deleteEvaluationsForSubmission(submission_id);
        await resetEvaluationFailuresForSubmission(submission_id);
      } catch (_) {}
    }

    const evaluation = await evaluateSubmission(submission_id);
    if (!evaluation) {
      return NextResponse.json({ success: false, error: "Evaluation failed or no framework configured" }, { status: 400 });
    }

    // Auto-approve by cutoff applies to manual single evaluation too
    await maybeAutoApprove(parseInt(submission_id), evaluation);

    return NextResponse.json({ success: true, evaluation, re_evaluated: !!force });
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
      const evalRow = await getEvaluation(parseInt(subId));
      return NextResponse.json({ success: true, evaluation: evalRow });
    }

    const formId = searchParams.get("form_id");
    if (!formId) {
      return NextResponse.json({ success: false, error: "form_id or submission_id required" }, { status: 400 });
    }

    // "Is AI configured for this FORM?" — not "has this submission been
    // evaluated". The field name is kept for existing consumers; the wrong
    // function is what produced duplicate evaluations.
    const exists = await formHasAiEvaluation(parseInt(formId));
    return NextResponse.json({ success: true, has_evaluation: exists });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
