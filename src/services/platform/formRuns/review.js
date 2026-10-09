/**
 * Platform — form runs: the review workflow (SERVICE layer).
 *
 * The shared approval/rejection/revision workflow used by BOTH the single review
 * action and the bulk review action: the idempotency guard, the "PDF needs an
 * evaluation" refusal (before any side effect), the dimension-override write, the
 * status transition, the tracked decision email, the result-PDF send and the
 * REVIEW_COMPLETED automation with its synchronous program/group sync.
 *
 * Split of `services/platform/formRuns.js` (see docs/LAYER_SPLIT.md): this is the
 * `review` slice; the barrel at the original path re-exports the same surface.
 *
 * The controller INJECTS the two pieces that belong to the HTTP boundary:
 * `after` (the `next/server` deferred-task hook) and `scheduleResultSweep`. The
 * service stays HTTP-free and simply asks the caller to run the result sweep once
 * the response has been written.
 *
 * Layer: decisions and orchestration, no SQL, no HTTP. It reads and writes
 * through `@/models/**` and `@/lib/**`.
 */

import { recordEmailStatus } from "@/lib/email";
import { onReview } from "@/models/platform/automation";
import {
  createSubmissionReview,
  getFormById,
  getLatestEvaluationBySubmissionId,
  getLatestEvaluationForOverridesBySubmissionId,
  getReviewerNameByCid,
  getRunDataForReviewAutomationById,
  getSubmissionReviewStateById,
  getSubmissionRunIdById,
  updateEvaluationDimensionsById,
  updateSubmissionStatusById,
} from "@/models/formRuns";
import { syncApprovedSubmissionToProgramGroup } from "@/services/contacts/contactGroupSync";
import { logTimeline, sendDecisionEmailForSubmission, sendResultEmailForSubmission } from "./resultEmails";

/**
 * Shared approval/rejection workflow — used by BOTH the single review action
 * and the bulk review action so bulk approval is a controlled extension of
 * the individual flow, never a parallel implementation.
 *
 * Idempotency guard → review row (+ dimension overrides) → status update →
 * tracked decision email (Gmail, run→form→default template, resolved name) →
 * REVIEW_COMPLETED automation (activation/access emails, CRM identity) →
 * program auto-assignment.
 *
 * The controller INJECTS the two pieces that belong to the HTTP boundary:
 * `after` (the `next/server` deferred-task hook) and `scheduleResultSweep`.
 * The service stays HTTP-free (see docs/LAYER_SPLIT.md) and simply asks the
 * caller to run the result sweep once the response has been written.
 *
 * Returns { ok: true, submission, already_approved? } or
 *         { ok: false, statusCode, error }.
 */
export async function processReviewInternal({
  submission_id,
  decision,
  comment,
  internal_note,
  dimension_overrides,
  force,
  session,
  includeResultPdf = false,
  after,
  scheduleResultSweep,
}) {
  // ── IDEMPOTENCY GUARD: never re-approve an already-approved submission ──
  // Manual override requires explicit force: true
  const existingSub = await getSubmissionReviewStateById(submission_id);
  if (existingSub.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Submission not found" };
  }
  const prevStatus = existingSub.rows[0].status;
  if (prevStatus === "approved" && decision === "approved" && !force) {
    return { ok: true, already_approved: true, submission: existingSub.rows[0] };
  }

  // ── "Also send the AI result PDF" is a promise the submission has to be able
  // to keep: that document IS the evaluation. Refuse the WHOLE action before any
  // side effect — no review row, no status change, no email — and say why, so
  // the reviewer evaluates the submission and approves again. An approval whose
  // requested document cannot follow is never half-sent. ──
  if (includeResultPdf && decision === "approved") {
    const evalGate = await getLatestEvaluationBySubmissionId(submission_id);
    const evalGateRow = evalGate.rows[0] || null;
    let gateDims = evalGateRow?.dimensions;
    if (typeof gateDims === "string") {
      try { gateDims = JSON.parse(gateDims); } catch (_) { gateDims = []; }
    }
    const hasResult = !!evalGateRow && (evalGateRow.overall_score != null || (Array.isArray(gateDims) && gateDims.length > 0));
    if (!hasResult) {
      return {
        ok: false,
        statusCode: 409,
        errorCode: "result_pdf_not_evaluated",
        error: "No AI result yet — this submission has not been evaluated. Run the evaluation first, then approve with the PDF.",
      };
    }
  }

  let reviewerName = session.cid;
  try {
    const reviewerResult = await getReviewerNameByCid(session.cid);
    if (reviewerResult.rows.length) reviewerName = reviewerResult.rows[0].name;
  } catch (_) {}

  // Save review with dimension overrides if provided
  await createSubmissionReview({
    submissionId: submission_id,
    reviewerId: session.cid,
    reviewerName,
    decision,
    comment,
    internalNote: internal_note,
  });

  // Store dimension overrides in separate evaluation update
  if (dimension_overrides && Array.isArray(dimension_overrides) && dimension_overrides.length > 0) {
    try {
      const evaluationResult = await getLatestEvaluationForOverridesBySubmissionId(submission_id);
      if (evaluationResult.rows.length > 0) {
        const existing = evaluationResult.rows[0];
        const dims = existing.dimensions || [];
        const updatedDims = dims.map(dimension => {
          const override = dimension_overrides.find(overrideCandidate => overrideCandidate.name === dimension.name);
          if (override) {
            return { ...dimension, human_score: override.human_score, human_comment: override.human_comment || "", final_score: override.final_score };
          }
          return dimension;
        });
        await updateEvaluationDimensionsById(existing.id, updatedDims);
      }
    } catch (_) {}
  }

  // Update submission status — map workflow decision to core platform state
  const CORE_STATES = ["approved", "rejected", "revision_requested", "submitted", "draft"];
  const newStatus = CORE_STATES.includes(decision) ? decision : "approved";
  const result = await updateSubmissionStatusById(submission_id, newStatus);

  logTimeline(parseInt(submission_id), decision, session.cid, reviewerName, { comment, internal_note });

  // Send decision email to applicant — TRACKED (never sent twice)
  await sendDecisionEmailForSubmission({ submission_id, decision, comment: comment || "" });

  // The reviewer also asked for the AI result document. It goes out as its OWN
  // email — its own type, its own guard in the Emails tab — through the exact
  // path behind "Send Response", so the document is identical whether it is
  // sent from the approval checkbox or by hand. The gate above guarantees an
  // evaluation exists, so this never sends an empty document.
  let resultPdf = null;
  if (includeResultPdf && decision === "approved") {
    try {
      resultPdf = await sendResultEmailForSubmission({ submission_id });
    } catch (error) {
      resultPdf = { status: "failed", error: error?.message || "Result PDF failed" };
    }
  }

  // Fire automation — get run details + form config for context
  const submissionRunResult = await getSubmissionRunIdById(submission_id);
  if (submissionRunResult.rows.length > 0) {
    const runData = await getRunDataForReviewAutomationById(submissionRunResult.rows[0].run_id);
    let formData = null;
    if (runData.rows[0]) {
      const formResult = await getFormById(runData.rows[0].form_id);
      formData = formResult.rows[0] || null;
    }

    // Record a PENDING activation email BEFORE firing the background task.
    // If the serverless function is terminated before `after()` completes,
    // this pending row remains visible in the Emails tab as retryable.
    if (decision === "approved") {
      try {
        await recordEmailStatus({
          submission_id: parseInt(submission_id),
          contact_cid: result.rows[0]?.submitter_id || null,
          email_type: "activation",
          status: "pending",
          error: "Queued — waiting for background automation",
          to: result.rows[0]?.submitter_id || null,
        });
      } catch (_) {}
    }

    after(() => {
      onReview(
        { id: null, submission_id: parseInt(submission_id), decision, comment, reviewer_name: reviewerName },
        result.rows[0],
        runData.rows[0] || null,
        session,
        formData
      ).catch((err) => {
        console.error("[form-runs] Background automation failed:", err.message);
      });
    });

    // Synchronous program/group sync (does NOT rely on background automation).
    if (decision === "approved" && runData.rows[0]) {
      await syncApprovedSubmissionToProgramGroup(result.rows[0]);
    }

    // A result whose scheduled time has already passed goes out as soon as the
    // reviewer decides — no need to reopen the run for it to be picked up. A
    // report no longer waits for an approval, so this fires on EVERY decision
    // (approve, reject, revision), not just an approval. The sweep honours the
    // run's delay and is idempotent, so it is safe to ask every time (a delay of
    // 0 asks for nothing).
    scheduleResultSweep(submissionRunResult.rows[0].run_id);
  }

  return { ok: true, submission: result.rows[0], result_pdf: resultPdf };
}
