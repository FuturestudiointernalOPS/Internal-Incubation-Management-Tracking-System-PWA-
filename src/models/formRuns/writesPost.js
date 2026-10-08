import db from "@/lib/db";

// ── POST /api/platform/form-runs ─────────────────────────────────────────────

/** Change a run's status (close/cancel/archive/reactivate). */
export async function updateRunStatusById(id, status) {
  return db.execute({
    sql: `UPDATE platform_form_runs SET status = ?, updated_at = NOW() WHERE id = ? RETURNING *`,
    args: [status, parseInt(id)],
  });
}

/**
 * Run status + close date + settings (the submission gate).
 *
 * `settings` rides along because the gate is where a run's own rules are
 * enforced on arrival: its submission limit, whether a person may answer more
 * than once, whether it closes itself at the deadline, and whether responder
 * identity is hidden from reviewers.
 */
export async function getRunSubmissionGateById(runId) {
  return db.execute({ sql: "SELECT status, closes_at, settings, lms_course_id FROM platform_form_runs WHERE id = ?", args: [parseInt(runId)] });
}

/** Existing submission id for a run + submitter (submit upsert guard). */
export async function findExistingSubmissionIdForRunAndSubmitter(runId, submitterId) {
  return db.execute({
    sql: "SELECT id FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ? LIMIT 1",
    args: [parseInt(runId), submitterId],
  });
}

/** Run form_id lookup (AI-evaluation availability check). */
export async function getRunFormIdForEvaluationById(runId) {
  return db.execute({ sql: "SELECT form_id FROM platform_form_runs WHERE id = ?", args: [parseInt(runId)] });
}

/** Current status of an existing submission (decided-submission guard). */
export async function getSubmissionCurrentStatusById(submissionId) {
  return db.execute({ sql: "SELECT status FROM platform_form_submissions WHERE id = ?", args: [submissionId] });
}

/** Update an existing submission's data/status (returns the updated row). */
export async function updateSubmissionContentAndStatusById({ submissionId, data, status }) {
  return db.execute({
    sql: `UPDATE platform_form_submissions SET data = ?, status = ?, submitted_at = COALESCE(submitted_at, CASE WHEN ? = 'submitted' THEN NOW() ELSE NULL END), updated_at = NOW() WHERE id = ? RETURNING *`,
    args: [JSON.stringify(data), status, status, submissionId],
  });
}

/**
 * Update ONLY an existing submission's stored answers — the respondent-email
 * correction rewrites the email answer without touching status or timestamps.
 */
export async function updateSubmissionDataById(submissionId, data) {
  return db.execute({
    sql: `UPDATE platform_form_submissions SET data = ?, updated_at = NOW() WHERE id = ? RETURNING *`,
    args: [JSON.stringify(data), parseInt(submissionId)],
  });
}

/** Full run row for the submit automation context (existing submission). */
export async function getFullRunForSubmissionAutomationById(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [parseInt(runId)] });
}

/** Full form row for the submit automation context (existing submission). */
export async function getFormForSubmissionAutomationById(formId) {
  return db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [formId] });
}

/** Insert a new submission from the submit action (returns the created row). */
export async function insertSubmissionForSubmitter({ runId, submitterId, submitterName, status, data }) {
  return db.execute({
    sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, status, data, submitted_at) VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'submitted' THEN NOW() ELSE NULL END) RETURNING *`,
    args: [parseInt(runId), submitterId, submitterName, status, JSON.stringify(data), status],
  });
}

/** Full run row for the new-submission automation context. */
export async function getFullRunForInsertSubmissionAutomationById(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [parseInt(runId)] });
}

/** Full form row for the new-submission automation context. */
export async function getFormForInsertSubmissionAutomationById(formId) {
  return db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [formId] });
}

/** Full run row for the manual-add action. */
export async function getRunForManualAddById(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [parseInt(runId)] });
}

/** Existing contact by exact email (manual-add respondent resolution). */
export async function findContactByLowerEmailForManualAdd(cleanEmail) {
  return db.execute({
    sql: "SELECT cid, name FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0 LIMIT 1",
    args: [cleanEmail],
  });
}

/** Fill a contact's name when the manual-add matched an unnamed contact. */
export async function updateContactNameById(submitterId, cleanName) {
  return db.execute({ sql: "UPDATE contacts SET name = ? WHERE cid = ?", args: [cleanName, submitterId] });
}

/**
 * Re-point a respondent's CRM contact at a corrected email address. Email is
 * UNIQUE on contacts, so the caller checks for a conflicting owner first; a
 * race that slips through surfaces as a thrown unique-violation, never a
 * silent overwrite of another person.
 */
export async function updateContactEmailById(cid, cleanEmail) {
  return db.execute({ sql: "UPDATE contacts SET email = ? WHERE cid = ?", args: [cleanEmail, cid] });
}

/** First group/program/organization/cohort assignment target of a run. */
export async function getAssignedGroupForManualAddById(runId) {
  return db.execute({
    sql: `SELECT target_type, target_id FROM platform_form_run_assignments
                    WHERE run_id = ? AND target_type IN ('group','program','organization','cohort')
                    LIMIT 1`,
    args: [runId],
  });
}

/** Create the manual-add respondent contact (approved member by default). */
export async function insertContactForManualAdd({ cid, name, email, groupName }) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, role, status, group_name) VALUES (?, ?, ?, 'member', 'approved', ?)",
    args: [cid, name, email, groupName],
  });
}

/** Run form_id lookup for the manual-add evaluation check. */
export async function getRunFormIdForManualEvaluationById(runId) {
  return db.execute({ sql: "SELECT form_id FROM platform_form_runs WHERE id = ?", args: [parseInt(runId)] });
}

/** Insert the manual-add submission (returns the created row). */
export async function insertManualAddSubmission({ runId, submitterId, submitterName, status, data }) {
  return db.execute({
    sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, status, data, submitted_at)
              VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'submitted' THEN NOW() ELSE NULL END) RETURNING *`,
    args: [parseInt(runId), submitterId, submitterName, status, JSON.stringify(data), status],
  });
}

/** Full form row for the manual-add automation context. */
export async function getFormForManualAddAutomationById(formId) {
  return db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [formId] });
}

/** Submission rows for bulk-review backend validation (scoped to a run). */
export async function getBulkReviewValidationsByIdsInRun(idList, runId) {
  return db.execute({
    sql: `SELECT id, status, submitter_name FROM platform_form_submissions WHERE id = ANY(?) AND run_id = ?`,
    args: [idList, parseInt(runId)],
  });
}

/** Submission rows for email-retry backend validation (scoped to a run). */
export async function getRetryEmailValidationsByIdsInRun(idList, runId) {
  return db.execute({
    sql: `SELECT id, submitter_name FROM platform_form_submissions WHERE id = ANY(?) AND run_id = ?`,
    args: [idList, parseInt(runId)],
  });
}

/** Full submission row for an activation-email retry. */
export async function getSubmissionForActivationRetryById(id) {
  return db.execute({ sql: "SELECT * FROM platform_form_submissions WHERE id = ?", args: [id] });
}

/** Full run row for an activation-email retry. */
export async function getRunDataForActivationRetryById(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [runId] });
}

/** Full form row for an activation-email retry. */
export async function getFormForActivationRetryById(formId) {
  return db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [formId] });
}

/** Submission ids for cancel-batch backend validation (scoped to a run). */
export async function getCancelledBatchSubmissionIdsInRun(idList, runId) {
  return db.execute({
    sql: `SELECT id FROM platform_form_submissions WHERE id = ANY(?) AND run_id = ?`,
    args: [idList, parseInt(runId)],
  });
}

/** Public slug lookup before a run launch (backfill for legacy runs). */
export async function getRunPublicSlugById(id) {
  return db.execute({ sql: "SELECT public_slug FROM platform_form_runs WHERE id = ?", args: [parseInt(id)] });
}

/** Set a run's public slug (launch-time backfill). */
export async function updateRunPublicSlugById(slug, id) {
  return db.execute({ sql: "UPDATE platform_form_runs SET public_slug = ? WHERE id = ?", args: [slug, parseInt(id)] });
}

/** Activate a run and ensure its public slug (returns the updated row). */
export async function launchRunById(id, slug) {
  return db.execute({
    sql: `UPDATE platform_form_runs SET status = 'active', public_slug = COALESCE(public_slug, ?), updated_at = NOW() WHERE id = ? RETURNING *`,
    args: [slug, parseInt(id)],
  });
}

/** Insert a run assignment (deduped) from the assign action. */
export async function insertRunAssignmentForAction({ runId, targetType, targetId, assignedBy }) {
  return db.execute({
    sql: "INSERT INTO platform_form_run_assignments (run_id, target_type, target_id, assigned_by) VALUES (?, ?, ?, ?) ON CONFLICT (run_id, target_type, target_id) DO NOTHING",
    args: [runId, targetType, targetId, assignedBy],
  });
}

/** Assignment rows after the assign action (refreshed list). */
export async function getAssignmentsAfterAssignByRunId(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_run_assignments WHERE run_id = ?", args: [runId] });
}

/** Full run row for the assignment-added automation. */
export async function getFullRunAfterAssignById(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [runId] });
}

/** Run id of an assignment (unassign action). */
export async function getRunIdByAssignmentId(assignmentId) {
  return db.execute({ sql: "SELECT run_id FROM platform_form_run_assignments WHERE id = ?", args: [parseInt(assignmentId)] });
}

/** Remove a run assignment (unassign action). */
export async function deleteAssignmentById(assignmentId) {
  return db.execute({ sql: "DELETE FROM platform_form_run_assignments WHERE id = ?", args: [parseInt(assignmentId)] });
}

/** Assignment rows after the unassign action (refreshed list). */
export async function getAssignmentsAfterUnassignByRunId(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_run_assignments WHERE run_id = ?", args: [parseInt(runId)] });
}

/** Delete a submission's reviews (delete-submission cleanup). */
export async function deleteReviewsBySubmissionId(submissionId) {
  return db.execute({ sql: "DELETE FROM platform_submission_reviews WHERE submission_id = ?", args: [parseInt(submissionId)] });
}

/** Delete a submission's timeline rows (delete-submission cleanup). */
export async function deleteTimelineBySubmissionId(submissionId) {
  return db.execute({ sql: "DELETE FROM platform_submission_timeline WHERE submission_id = ?", args: [parseInt(submissionId)] });
}

/** Delete a submission's evaluations (delete-submission cleanup). */
export async function deleteEvaluationsBySubmissionId(submissionId) {
  return db.execute({ sql: "DELETE FROM platform_submission_evaluations WHERE submission_id = ?", args: [parseInt(submissionId)] });
}

/** Delete the submission row itself (delete-submission action). */
export async function deleteSubmissionById(submissionId) {
  return db.execute({ sql: "DELETE FROM platform_form_submissions WHERE id = ?", args: [parseInt(submissionId)] });
}

/** Submission rows for the manual-message backend validation (scoped to a run). */
export async function getManualMessageSubmissionsByIdsInRun(idList, runId) {
  return db.execute({
    sql: `SELECT * FROM platform_form_submissions WHERE id = ANY(?) AND run_id = ?`,
    args: [idList, parseInt(runId)],
  });
}

/** Form field labels for a run (manual-message identity resolution). */
export async function getManualMessageFieldLabelsByRunId(runId) {
  return db.execute({
    sql: `SELECT f2.id, f2.label FROM platform_form_fields f2 JOIN platform_form_runs r2 ON f2.form_id = r2.form_id WHERE r2.id = ?`,
    args: [parseInt(runId)],
  });
}

/** Group name for a run (manual-message template variable). */
export async function getManualMessageGroupNameByRunId(runId) {
  return db.execute({
    sql: `SELECT f.name FROM platform_form_run_assignments a JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT)) WHERE a.run_id = ? AND a.target_type = 'group' LIMIT 1`,
    args: [parseInt(runId)],
  });
}

/** Submission rows for activation-message backend validation (scoped to a run). */
export async function getActivationMessageSubmissionsByIdsInRun(idList, runId) {
  return db.execute({
    sql: `SELECT * FROM platform_form_submissions WHERE id = ANY(?) AND run_id = ?`,
    args: [idList, parseInt(runId)],
  });
}

/** Contact status by cid (already-activated skip check). */
export async function getContactStatusForActivationById(cid) {
  return db.execute({
    sql: "SELECT status FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Full run row for the activation-message send. */
export async function getRunDataForActivationSendById(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [runId] });
}

/** Full form row for the activation-message send. */
export async function getFormForActivationSendById(formId) {
  return db.execute({ sql: "SELECT * FROM platform_forms WHERE id = ?", args: [formId] });
}

/** Rotate a run's public slug (regenerate-link action). */
export async function updatePublicSlugForRegeneratedLinkById(slug, id) {
  return db.execute({ sql: "UPDATE platform_form_runs SET public_slug = ? WHERE id = ?", args: [slug, parseInt(id)] });
}

/** Idempotent migration for legacy schemas missing the public_slug column. */
export async function addPublicSlugColumnIfMissing() {
  return db.execute({ sql: "ALTER TABLE platform_form_runs ADD COLUMN IF NOT EXISTS public_slug TEXT" });
}

/** Retry of the slug update after the column migration. */
export async function updatePublicSlugRetryAfterAlterById(slug, id) {
  return db.execute({ sql: "UPDATE platform_form_runs SET public_slug = ? WHERE id = ?", args: [slug, parseInt(id)] });
}

/** Fresh run row after rotating the public slug. */
export async function getRunAfterSlugRotationById(id) {
  return db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [parseInt(id)] });
}

/** Form version lookup at run-creation time. */
export async function getFormVersionById(formId) {
  return db.execute({ sql: "SELECT version FROM platform_forms WHERE id = ?", args: [parseInt(formId)] });
}

/** Insert a new form run (returns the created row). */
export async function createFormRun({ form_id, form_version, name, description, opens_at, closes_at, settings, owner_id, created_by, public_slug }) {
  return db.execute({
    sql: `INSERT INTO platform_form_runs (form_id, form_version, name, description, opens_at, closes_at, settings, owner_id, created_by, public_slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [parseInt(form_id), form_version, name.trim(), description || null, opens_at || null, closes_at || null, JSON.stringify(settings || {}), owner_id || null, created_by || null, public_slug],
  });
}

/** Insert a run assignment (deduped) during run creation. */
export async function createRunAssignmentForRunCreation({ runId, targetType, targetId, assignedBy }) {
  return db.execute({
    sql: "INSERT INTO platform_form_run_assignments (run_id, target_type, target_id, assigned_by) VALUES (?, ?, ?, ?) ON CONFLICT (run_id, target_type, target_id) DO NOTHING",
    args: [runId, targetType, targetId, assignedBy],
  });
}

