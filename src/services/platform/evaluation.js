/**
 * Platform — submission evaluation (SERVICE layer).
 *
 * The domain work behind `/api/platform/ai/evaluate-submission`: the batch model
 * (claim with an expiry so two processes never double-evaluate, evaluate with
 * bounded concurrency, release, record failures for a targeted retry), the
 * progress counts and the single evaluation. The CONTROLLER keeps the `runs.*`
 * capability split (progress is `runs.view`, evaluating is `runs.review`), the
 * body parsing and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and `@/lib/**`.
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
  deleteExpiredEvaluationClaims,
  findEvaluationBatchCandidates,
  recordEvaluationFailure,
  releaseEvaluationClaim,
} from "@/models/platformAi";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 15;
const CLAIM_TTL_MINUTES = 15;
const AI_TIMEOUT_MS = 180000; // per-submission AI call timeout
const IN_FLIGHT = 4; // concurrent AI evaluations within one batch request

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
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  // Clear the timer once the race settles, so a finished batch does not leave a
  // dangling handle (behaviour is unchanged — the timeout only fires if the AI
  // call is still pending).
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function processSubmission(submissionId) {
  try {
    const result = await withTimeout(evaluateSubmission(submissionId), AI_TIMEOUT_MS, "AI evaluation timed out");
    if (result === null) {
      // evaluateSubmission returns null on failure — record it.
      throw new Error("Evaluation failed (null result)");
    }
    // Success: clear any failure record.
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
  // Candidates: submitted, not evaluated, no active claim.
  const candidates = await findEvaluationBatchCandidates(formId, batchSize, onlyFailed, CLAIM_TTL_MINUTES);

  if (candidates.rows.length === 0) {
    return { evaluated: 0, failed: 0, processed: 0 };
  }

  // Claim each candidate (ON CONFLICT DO NOTHING — losers were claimed concurrently).
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
      // Release claim regardless of outcome.
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

/**
 * Handle a POST: the progress-only read, the batch / retry_failed run, or a
 * single evaluation for a response that has none.
 *
 * `force` is accepted from older callers and deliberately NOT acted on: a
 * re-evaluate is a read of what was already decided (see the single-evaluation
 * branch). Accepting it and ignoring it beats refusing a call the review screen
 * still makes.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function handleEvaluationPost(body) {
  await ensureTables();

  // ── PROGRESS ONLY ──
  if (body.action === "progress" && body.form_id) {
    const progress = await getProgress(body.form_id);
    // Approval + email stats for the dashboard panel.
    const approvals = { approved: 0, rejected: 0 };
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
    return { status: 200, body: { success: true, progress, approvals, emails: emailStats } };
  }

  // ── BATCH / RETRY ──
  if ((body.action === "batch" || body.action === "retry_failed") && body.form_id) {
    await cleanupExpiredClaims();
    const batchSize = Math.min(parseInt(body.batch_size) || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
    const onlyFailed = body.action === "retry_failed";

    const batchResult = await runBatch(body.form_id, onlyFailed, batchSize);
    const progress = await getProgress(body.form_id);

    return {
      status: 200,
      body: {
        success: true,
        action: body.action,
        evaluated: batchResult.evaluated,
        failed: batchResult.failed,
        processed: batchResult.processed,
        progress,
      },
    };
  }

  // ── SINGLE EVALUATION ──
  const { submission_id } = body;
  if (!submission_id) {
    return { status: 400, body: { success: false, error: "submission_id required" } };
  }

  // A DELIBERATE re-evaluate is a READ of what was already decided.
  //
  // The stored row is the record of what this response scored, and it is the row
  // a reviewer's own values live on. Calling the model again would move the
  // number — a model is not deterministic — and would discard those values. That
  // is the harm `Stop re-evaluating when nobody asked` removed from the automatic
  // paths, and a click must not reintroduce it.
  //
  // So an evaluation that exists is returned EXACTLY as it stands. Only a
  // response with none is evaluated — which is what the button's first run is.
  const stored = await getEvaluation(parseInt(submission_id)).catch(() => null);
  if (stored) {
    return { status: 200, body: { success: true, evaluation: stored, re_evaluated: false, stored: true } };
  }

  const evaluation = await evaluateSubmission(submission_id);
  if (!evaluation) {
    return {
      status: 400,
      body: { success: false, error: "Evaluation failed or no framework configured" },
    };
  }

  // Auto-approve by cutoff applies to a first evaluation too.
  await maybeAutoApprove(parseInt(submission_id), evaluation);

  return { status: 200, body: { success: true, evaluation, re_evaluated: false, stored: false } };
}

/**
 * Handle a GET: one submission's evaluation, or "is AI configured for this
 * form?".
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function getEvaluationResult({ submissionId, formId }) {
  if (submissionId) {
    const evalRow = await getEvaluation(parseInt(submissionId));
    return { status: 200, body: { success: true, evaluation: evalRow } };
  }

  if (!formId) {
    return { status: 400, body: { success: false, error: "form_id or submission_id required" } };
  }

  // "Is AI configured for this FORM?" — not "has this submission been
  // evaluated". The field name is kept for existing consumers; the wrong
  // function is what produced duplicate evaluations.
  const exists = await formHasAiEvaluation(parseInt(formId));
  return { status: 200, body: { success: true, has_evaluation: exists } };
}
