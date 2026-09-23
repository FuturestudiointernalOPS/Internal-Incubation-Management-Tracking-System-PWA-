import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { evaluateSubmission, formHasAiEvaluation, getEvaluation } from "@/lib/platform/ai/evaluate";
import {
  approveSubmissionAndReturn,
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
  findHigherScoredDuplicateSubmissions,
  getContactNameByCid,
  getFieldLabelsForApprovalEmail,
  getFieldLabelsForDuplicateGuard,
  getFormForAutoApprove,
  getGroupNameForRun,
  getRunForAutoApprove,
  getSubmissionForAutoApprove,
  insertAutoApprovalReview,
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

/**
 * Look up the group linked to a run (used for approval email templates).
 */
async function getRunGroupName(runId) {
  try {
    const groupResult = await getGroupNameForRun(runId);
    return groupResult.rows[0]?.name || null;
  } catch (_) {
    return null;
  }
}

/**
 * Auto-approve a submission when its score meets the form's configured
 * cutoff. Reuses the existing review automation (group assignment,
 * approval email, activation) — no parallel system.
 */
async function maybeAutoApprove(submissionId, evaluation) {
  try {
    const submissionResult = await getSubmissionForAutoApprove(submissionId);
    if (submissionResult.rows.length === 0) return;
    const submission = submissionResult.rows[0];
    if (submission.status !== "submitted") return; // never override existing decision

    const runResult = await getRunForAutoApprove(submission.run_id);
    if (runResult.rows.length === 0) return;

    const formResult = await getFormForAutoApprove(runResult.rows[0].form_id);
    if (formResult.rows.length === 0) return;

    const automation = (formResult.rows[0].settings || {}).automation;
    const cutoff = automation?.auto_approve_cutoff;
    const autoApproveEnabled = automation?.auto_approve === true;
    if (!autoApproveEnabled || cutoff == null || isNaN(parseFloat(cutoff))) return;

    const score = parseFloat(evaluation?.overall_score);
    if (isNaN(score) || score < parseFloat(cutoff)) return;

    // ── DUPLICATE GUARD: when the same email appears in multiple submissions
    // of this run, only the HIGHEST-scored one is auto-approved — lower-scored
    // duplicates stay submitted and never receive an email.
    const subData = submission.data || {};
    // Fetch the form's field labels once — the real applicant email is
    // resolved label-aware (EN/FR), never from placeholder values.
    let labels = {};
    try {
      const fieldLabelsResult = await getFieldLabelsForDuplicateGuard(formResult.rows[0].id);
      for (const fieldRow of fieldLabelsResult.rows) labels[String(fieldRow.id)] = fieldRow.label;
    } catch (_) {}
    const { resolveSubmissionEmail } = await import("@/lib/email");
    const applicantEmail = resolveSubmissionEmail({
      submissionData: subData,
      fieldLabels: labels,
      contactEmail: submission.submitter_id && submission.submitter_id.includes("@") ? submission.submitter_id : "",
    });
    if (applicantEmail) {
      try {
        const siblings = await findHigherScoredDuplicateSubmissions(submission.run_id, submissionId, applicantEmail);
        const better = siblings.rows.find((sibling) => {
          const siblingScore = parseFloat(sibling.overall_score);
          return !isNaN(siblingScore) && siblingScore > score;
        });
        if (better) {
          const { recordEmailStatus } = await import("@/lib/email");
          await recordEmailStatus({
            submission_id: submissionId,
            contact_cid: submission.submitter_id || null,
            email_type: "approval",
            status: "skipped",
            error: "Skipped — duplicate email: a higher-scored submission with the same email exists in this run",
            to: applicantEmail,
          });
          console.log("[Auto-Approve] Skipped (lower-scored duplicate):", applicantEmail, "vs submission", better.id);
          return;
        }
      } catch (_) {}
    }

    // Approve through the same path a human reviewer uses
    const { onReview } = await import("@/lib/platform/automation");
    const comment = `Auto-approved: AI score ${score} meets cutoff ${cutoff}`;

    // Record review row (system reviewer)
    await insertAutoApprovalReview(submissionId, comment);

    // Update submission status
    const updated = await approveSubmissionAndReturn(submissionId);
    if (updated.rows.length === 0) return; // raced with another decision

    // Send the TRACKED approval email (Gmail transport) with template variables
    // so auto-approved applicants receive the personalized approval template.
    try {
      const subData = updated.rows[0].data || {};
      const { sendDecisionEmail, sendTrackedEmail, getTemplate, resolvePersonName, recordEmailStatus, resolveSubmissionEmail } = await import("@/lib/email");
      // Fetch the form's field labels once — used for the real applicant
      // email (label-aware, EN/FR) and the name resolution below.
      let labels = {};
      try {
        const fieldLabelsResult = await getFieldLabelsForApprovalEmail(formResult.rows[0].id);
        for (const fieldRow of fieldLabelsResult.rows) labels[String(fieldRow.id)] = fieldRow.label;
      } catch (_) {}
      const applicantEmail = resolveSubmissionEmail({
        submissionData: subData,
        fieldLabels: labels,
        contactEmail: updated.rows[0].submitter_id && updated.rows[0].submitter_id.includes("@") ? updated.rows[0].submitter_id : "",
      });
      if (applicantEmail) {
        const decisionTemplate = getTemplate(formResult.rows[0].settings || {}, "approval", runResult.rows[0].settings || {});
        const formName = formResult.rows[0].name || "";
        const groupName = await getRunGroupName(runResult.rows[0].id);

        // Approval email requires a group. With no group, the person stays in
        // the platform/CRM but no approval email is sent.
        if (groupName) {
          // Best real name — resolved deterministically with the form's actual
          // question labels; never "Unknown" when a real name exists.
          let applicantName = "";
          try {
            const contactResult = await getContactNameByCid(updated.rows[0].submitter_id);
            applicantName = resolvePersonName({
              contactName: contactResult.rows[0]?.name || "",
              submitterName: updated.rows[0].submitter_name || "",
              submissionData: subData,
              fieldLabels: labels,
            });
          } catch (_) {}

          await sendTrackedEmail({
            submission_id: submissionId,
            contact_cid: updated.rows[0].submitter_id || null,
            email_type: "approval",
            provider: "gmail",
            to: applicantEmail,
            sendFn: () =>
              sendDecisionEmail({
                to: applicantEmail,
                applicantName,
                formName,
                decision: "approved",
                comment,
                template: decisionTemplate,
                templateVars: {
                  form_name: formName,
                  score: String(score),
                  group_name: groupName || "",
                  name: applicantName,
                },
              }),
          });
        } else {
          await recordEmailStatus({
            submission_id: submissionId,
            contact_cid: updated.rows[0].submitter_id || null,
            email_type: "approval",
            status: "skipped",
            error: "Skipped — No group assigned; approval email not sent",
            to: applicantEmail,
          });
        }
      }
    } catch (error) {
      console.error("[Auto-Approve] Approval email error:", error.message);
    }

    // Fire the same REVIEW_COMPLETED automation (group + emails)
    try {
      await onReview(
        { id: null, submission_id: submissionId, decision: "approved", comment, reviewer_name: "System Auto-Approval" },
        updated.rows[0],
        runResult.rows[0],
        { cid: "system", role: "system" },
        formResult.rows[0]
      );
    } catch (error) {
      console.error("[Auto-Approve] Automation error:", error.message);
    }
  } catch (error) {
    console.error("[Auto-Approve] Error:", error.message);
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
