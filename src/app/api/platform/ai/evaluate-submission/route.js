import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { evaluateSubmission, hasEvaluation, getEvaluation } from "@/lib/platform/ai/evaluate";
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
  } catch (e) {
    console.warn("[Batch Eval] Could not ensure tables:", e.message);
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

async function processSubmission(subId) {
  try {
    const result = await withTimeout(evaluateSubmission(subId), AI_TIMEOUT_MS, "AI evaluation timed out");
    if (result === null) {
      // evaluateSubmission returns null on failure — record it
      throw new Error("Evaluation failed (null result)");
    }
    // Success: clear any failure record
    try {
      await deleteEvaluationFailureRecord(subId);
    } catch (_) {}

    // ── AUTO-APPROVE BY CUTOFF (optional, configurable per form) ──
    await maybeAutoApprove(subId, result);

    return { ok: true, score: result.overall_score };
  } catch (e) {
    const msg = e?.message || "Unknown error";
    try {
      await recordEvaluationFailure(subId, msg);
    } catch (_) {}
    return { ok: false, error: msg };
  }
}

/**
 * Look up the group linked to a run (used for approval email templates).
 */
async function getRunGroupName(runId) {
  try {
    const res = await getGroupNameForRun(runId);
    return res.rows[0]?.name || null;
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
    const sub = await getSubmissionForAutoApprove(submissionId);
    if (sub.rows.length === 0) return;
    const submission = sub.rows[0];
    if (submission.status !== "submitted") return; // never override existing decision

    const run = await getRunForAutoApprove(submission.run_id);
    if (run.rows.length === 0) return;

    const form = await getFormForAutoApprove(run.rows[0].form_id);
    if (form.rows.length === 0) return;

    const auto = (form.rows[0].settings || {}).automation;
    const cutoff = auto?.auto_approve_cutoff;
    const autoApproveEnabled = auto?.auto_approve === true;
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
      const fieldRes = await getFieldLabelsForDuplicateGuard(form.rows[0].id);
      for (const frow of fieldRes.rows) labels[String(frow.id)] = frow.label;
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
        const better = siblings.rows.find((r) => {
          const s = parseFloat(r.overall_score);
          return !isNaN(s) && s > score;
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
        const fieldRes = await getFieldLabelsForApprovalEmail(form.rows[0].id);
        for (const frow of fieldRes.rows) labels[String(frow.id)] = frow.label;
      } catch (_) {}
      const applicantEmail = resolveSubmissionEmail({
        submissionData: subData,
        fieldLabels: labels,
        contactEmail: updated.rows[0].submitter_id && updated.rows[0].submitter_id.includes("@") ? updated.rows[0].submitter_id : "",
      });
      if (applicantEmail) {
        const decisionTemplate = getTemplate(form.rows[0].settings || {}, "approval", run.rows[0].settings || {});
        const formName = form.rows[0].name || "";
        const groupName = await getRunGroupName(run.rows[0].id);

        // Approval email requires a group. With no group, the person stays in
        // the platform/CRM but no approval email is sent.
        if (groupName) {
          // Best real name — resolved deterministically with the form's actual
          // question labels; never "Unknown" when a real name exists.
          let applicantName = "";
          try {
            const cRes = await getContactNameByCid(updated.rows[0].submitter_id);
            applicantName = resolvePersonName({
              contactName: cRes.rows[0]?.name || "",
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
    } catch (e) {
      console.error("[Auto-Approve] Approval email error:", e.message);
    }

    // Fire the same REVIEW_COMPLETED automation (group + emails)
    try {
      await onReview(
        { id: null, submission_id: submissionId, decision: "approved", comment, reviewer_name: "System Auto-Approval" },
        updated.rows[0],
        run.rows[0],
        { cid: "system", role: "system" },
        form.rows[0]
      );
    } catch (e) {
      console.error("[Auto-Approve] Automation error:", e.message);
    }
  } catch (e) {
    console.error("[Auto-Approve] Error:", e.message);
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
      const claimRes = await claimEvaluationSubmission(row.id);
      if (claimRes.rows.length > 0) claimed.push(row.id);
    } catch (_) {}
  }

  let ok = 0;
  let fail = 0;
  // Evaluate claimed submissions with limited concurrency so a 10-submission
  // batch finishes well within the serverless function duration instead of
  // stacking 10 sequential AI calls in one request.
  const results = new Array(claimed.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(IN_FLIGHT, claimed.length) }, async () => {
    while (cursor < claimed.length) {
      const i = cursor++;
      const subId = claimed[i];
      const res = await processSubmission(subId);
      results[i] = res;
      // Release claim regardless of outcome
      try {
        await releaseEvaluationClaim(subId);
      } catch (_) {}
    }
  });
  await Promise.all(workers);

  for (const res of results) {
    if (res && res.ok) ok++;
    else fail++;
  }

  return { evaluated: ok, failed: fail, processed: claimed.length };
}

export async function POST(req) {
  try {
    // Phase 1.6 (C5b = A): AI evaluation/auto-approval is management-only
    // (SA/admin/PM) — it can change applicant status and send decision
    // emails; no program context exists here to verify program staff.
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (session && !["super_admin", "admin", "program_manager"].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { initDb } = await import("@/lib/db");
    await initDb();
    await ensureTables();

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

      const res = await runBatch(body.form_id, onlyFailed, batchSize);
      const progress = await getProgress(body.form_id);

      return NextResponse.json({
        success: true,
        action: body.action,
        evaluated: res.evaluated,
        failed: res.failed,
        processed: res.processed,
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
    // Phase 1.6 (C5b = A): evaluation reads (scores/PII) are management-only.
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (session && !["super_admin", "admin", "program_manager"].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }
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

    const exists = await hasEvaluation(parseInt(formId));
    return NextResponse.json({ success: true, has_evaluation: exists });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
