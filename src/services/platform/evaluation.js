/**
 * PLATFORM AI EVALUATION (batch + single) — decisions, extracted from the
 * controller.
 *
 * `src/app/api/platform/ai/evaluate-submission/route.js` mixed its controller
 * (auth, capability gating, response shaping) with the whole batch model:
 * claim-based concurrency control, bounded-timeout AI calls, progress
 * counting, and the single/force-re-evaluate path. Moved here VERBATIM — no
 * SQL (the model layer already owns it), no HTTP.
 *
 * See docs/GUIDE_DECOUPAGE_COUCHES.md for the method.
 */

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
 * PHASE 4 BATCH MODEL (client-driven):
 *  - Each batch request claims + evaluates up to batch_size submissions
 *  - Claims use an expiry table so two concurrent processes never double-evaluate
 *  - Successes are saved individually (platform_submission_evaluations)
 *  - Failures are recorded (platform_evaluation_failures) for targeted retry
 *  - Progress % reflects only successfully saved evaluations
 */
export const DEFAULT_BATCH_SIZE = 10;
export const MAX_BATCH_SIZE = 15;
export const CLAIM_TTL_MINUTES = 15;
const AI_TIMEOUT_MS = 180000; // per-submission AI call timeout
const IN_FLIGHT = 4; // concurrent AI evaluations within one batch request

export async function ensureTables() {
  try {
    await createEvaluationClaimsTable();
    await createEvaluationFailuresTable();
  } catch (error) {
    console.warn("[Batch Eval] Could not ensure tables:", error.message);
  }
}

export async function cleanupExpiredClaims() {
  try {
    await deleteExpiredEvaluationClaims(CLAIM_TTL_MINUTES);
  } catch (_) {}
}

export async function getProgress(formId) {
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

export async function runBatch(formId, onlyFailed, batchSize) {
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

/** `body.action === "progress"` — read-only, gated on `runs.view` by the controller. */
export async function getProgressReport(formId) {
  const progress = await getProgress(formId);
  // Approval + email stats for the dashboard panel
  let approvals = { approved: 0, rejected: 0 };
  let emailStats = { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 };
  try {
    const appRes = await countApprovalDecisionsForForm(formId);
    for (const row of appRes.rows) {
      if (row.status === "approved") approvals.approved = row.cnt;
      if (row.status === "rejected") approvals.rejected = row.cnt;
    }
  } catch (_) {}
  try {
    const { getEmailStatsForForm } = await import("@/lib/email");
    emailStats = await getEmailStatsForForm(formId);
  } catch (_) {}
  return { progress, approvals, emails: emailStats };
}

/** `body.action === "batch" | "retry_failed"` — gated on `runs.review` by the controller. */
export async function runEvaluationBatch({ form_id, action, batch_size }) {
  await cleanupExpiredClaims();
  const batchSize = Math.min(parseInt(batch_size) || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
  const onlyFailed = action === "retry_failed";

  const batchResult = await runBatch(form_id, onlyFailed, batchSize);
  const progress = await getProgress(form_id);

  return {
    evaluated: batchResult.evaluated,
    failed: batchResult.failed,
    processed: batchResult.processed,
    progress,
  };
}

/** Single-submission evaluation, with an optional forced re-evaluate. */
export async function evaluateOneSubmission({ submission_id, force }) {
  if (!submission_id) return { ok: false, statusCode: 400, error: "submission_id required" };

  // Manual Re-evaluate: delete prior evaluations so exactly one current row remains
  if (force) {
    try {
      await deleteEvaluationsForSubmission(submission_id);
      await resetEvaluationFailuresForSubmission(submission_id);
    } catch (_) {}
  }

  const evaluation = await evaluateSubmission(submission_id);
  if (!evaluation) {
    return { ok: false, statusCode: 400, error: "Evaluation failed or no framework configured" };
  }

  // Auto-approve by cutoff applies to manual single evaluation too
  await maybeAutoApprove(parseInt(submission_id), evaluation);

  return { ok: true, evaluation, re_evaluated: !!force };
}

/** GET ?submission_id=X — the stored evaluation row for one submission. */
export async function getSubmissionEvaluation(submissionId) {
  return getEvaluation(parseInt(submissionId));
}

/**
 * GET ?form_id=X — "Is AI configured for this FORM?", not "has this
 * submission been evaluated". The name is kept for existing consumers; the
 * wrong function is what produced duplicate evaluations.
 */
export async function hasFormAiEvaluation(formId) {
  return formHasAiEvaluation(parseInt(formId));
}
