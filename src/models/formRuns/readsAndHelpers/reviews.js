import db from "@/lib/db";

/**
 * Platform form-run model — review workflow (REPOSITORY layer).
 *
 * The statements behind `processReviewInternal`: the idempotency guard, the
 * review write, dimension overrides, the status update and the automation
 * context reads. Split verbatim out of `models/formRuns/readsAndHelpers.js` —
 * see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Existing submission id + status (review idempotency guard). */
export async function getSubmissionReviewStateById(submission_id) {
  return db.execute({
    sql: "SELECT id, status FROM platform_form_submissions WHERE id = ?",
    args: [parseInt(submission_id)],
  });
}

/** Reviewer display name by cid. */
export async function getReviewerNameByCid(cid) {
  return db.execute({ sql: "SELECT name FROM contacts WHERE cid = ?", args: [cid] });
}

/** Insert a submission review row (with optional dimension overrides). */
export async function createSubmissionReview({ submissionId, reviewerId, reviewerName, decision, comment, internalNote }) {
  return db.execute({
    sql: `INSERT INTO platform_submission_reviews (submission_id, reviewer_id, reviewer_name, decision, comment, internal_note) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [parseInt(submissionId), reviewerId, reviewerName, decision, comment || null, internalNote || null],
  });
}

/** Latest evaluation row (id + dimensions) for human dimension overrides. */
export async function getLatestEvaluationForOverridesBySubmissionId(submissionId) {
  return db.execute({
    sql: "SELECT id, dimensions FROM platform_submission_evaluations WHERE submission_id = ? ORDER BY evaluated_at DESC LIMIT 1",
    args: [parseInt(submissionId)],
  });
}

/** Persist human-reviewed dimension overrides on an evaluation row. */
export async function updateEvaluationDimensionsById(evaluationId, dimensions) {
  return db.execute({
    sql: "UPDATE platform_submission_evaluations SET dimensions = ? WHERE id = ?",
    args: [JSON.stringify(dimensions), evaluationId],
  });
}

/** Update a submission's workflow status (returns the updated row). */
export async function updateSubmissionStatusById(submissionId, status) {
  return db.execute({
    sql: `UPDATE platform_form_submissions SET status = ?, updated_at = NOW() WHERE id = ? RETURNING *`,
    args: [status, parseInt(submissionId)],
  });
}

/** Run id lookup for a submission (automation context). */
export async function getSubmissionRunIdById(submissionId) {
  return db.execute({ sql: "SELECT run_id FROM platform_form_submissions WHERE id = ?", args: [parseInt(submissionId)] });
}

/** Full run row for the review-completion automation context. */
export async function getRunDataForReviewAutomationById(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [runId] });
}

/** Full form row for the review-completion automation context. */
export async function getFormById(formId) {
  return db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [formId] });
}
