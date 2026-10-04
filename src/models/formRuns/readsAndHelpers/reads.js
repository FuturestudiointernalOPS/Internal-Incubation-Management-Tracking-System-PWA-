import db from "@/lib/db";

/**
 * Platform form-run model — reads (REPOSITORY layer).
 *
 * The submission/run lookups, dashboard stats, run-detail reads, the Responses
 * table source and the respondent-enrichment lookups behind
 * `GET /api/platform/form-runs`. Split verbatim out of
 * `models/formRuns/readsAndHelpers.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Full submission row for a submission-id request. */
export async function getSubmissionById(submissionId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
    args: [parseInt(submissionId)],
  });
}

/** Full run row (id lookup). */
export async function getRunById(runId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_runs WHERE id = ?",
    args: [runId],
  });
}

/** Review rows for one submission, newest first. */
export async function getSubmissionReviewsBySubmissionId(submissionId) {
  return db.execute({
    sql: "SELECT * FROM platform_submission_reviews WHERE submission_id = ? ORDER BY created_at DESC",
    args: [parseInt(submissionId)],
  });
}

/** A user's submissions (with run name/status), newest first. */
export async function getMySubmissionsBySubmitterId(submitterId) {
  return db.execute({
    sql: "SELECT ps.*, pfr.name as run_name, pfr.status as run_status FROM platform_form_submissions ps JOIN platform_form_runs pfr ON ps.run_id = pfr.id WHERE ps.submitter_id = ? ORDER BY ps.updated_at DESC",
    args: [submitterId],
  });
}

/** Participant-facing run row (fills forms). */
export async function getParticipantRunById(id) {
  return db.execute({
    sql: "SELECT * FROM platform_form_runs WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Participant's own submission for a run (single row). */
export async function getParticipantSubmissionByRunAndSubmitter(id, submitterId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ? LIMIT 1",
    args: [parseInt(id), submitterId],
  });
}

/** Timeline rows for one submission, oldest first. */
export async function getTimelineBySubmissionId(submissionId) {
  return db.execute({
    sql: "SELECT * FROM platform_submission_timeline WHERE submission_id = ? ORDER BY created_at ASC",
    args: [parseInt(submissionId)],
  });
}

/** Dashboard stat: currently active runs. */
export async function countActiveRuns() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_runs WHERE status = 'active'" });
}

/** Dashboard stat: total assignment rows. */
export async function countTotalAssignments() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_run_assignments" });
}

/** Dashboard stat: submissions that are not drafts. */
export async function countNonDraftSubmissions() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_submissions WHERE status != 'draft'" });
}

/** Dashboard stat: submissions in 'submitted' state. */
export async function countSubmittedSubmissions() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_submissions WHERE status = 'submitted'" });
}

/** Dashboard stat: approved submissions. */
export async function countApprovedSubmissions() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_submissions WHERE status = 'approved'" });
}

/** Dashboard stat: submitted submissions past their run's close date. */
export async function countOverdueSubmissions() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM platform_form_submissions ps JOIN platform_form_runs pfr ON ps.run_id = pfr.id WHERE ps.status = 'submitted' AND pfr.closes_at IS NOT NULL AND pfr.closes_at < NOW()" });
}

/**
 * How many responses a RUN already holds (drafts excluded).
 *
 * This is what the run's "Submission Limit" is measured against. The submitter's
 * own row is excluded so that saving/updating one's OWN response never counts as
 * filling a seat — only a NEW response does.
 */
export async function countNonDraftSubmissionsByRunId(runId, excludeSubmitterId = null) {
  if (excludeSubmitterId) {
    return db.execute({
      sql: "SELECT COUNT(*) as c FROM platform_form_submissions WHERE run_id = ? AND status != 'draft' AND submitter_id != ?",
      args: [parseInt(runId), excludeSubmitterId],
    });
  }
  return db.execute({
    sql: "SELECT COUNT(*) as c FROM platform_form_submissions WHERE run_id = ? AND status != 'draft'",
    args: [parseInt(runId)],
  });
}

/** Activity feed: latest timeline rows with human-readable action details. */
export async function getRecentActivityTimeline() {
  return db.execute({
    sql: `SELECT pst.action, pst.actor_name, pst.created_at,
              CASE pst.action
                WHEN 'submitted' THEN 'New submission received'
                WHEN 'approved' THEN 'Submission approved'
                WHEN 'rejected' THEN 'Submission rejected'
                WHEN 'revision_requested' THEN 'Revision requested'
                WHEN 'launched' THEN 'Form run launched'
                WHEN 'created' THEN 'Form run created'
                ELSE pst.action
              END as details
              FROM platform_submission_timeline pst
              ORDER BY pst.created_at DESC LIMIT 20`,
    args: [],
  });
}

/** Assignable contacts dropdown source (non-deleted, name-ordered). */
export async function getAssignableContactsList() {
  return db.execute({ sql: "SELECT cid, name, email, role FROM contacts WHERE deleted = 0 ORDER BY name ASC LIMIT 1000" });
}

/** Full submission row for the scoring-breakdown endpoint. */
export async function getScoringSubmissionById(submissionId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
    args: [submissionId],
  });
}

/** Run context (id/name/form_id/settings) for the scoring-breakdown endpoint. */
export async function getRunContextForScoringById(runId) {
  return db.execute({
    sql: "SELECT id, name, form_id, settings FROM platform_form_runs WHERE id = ?",
    args: [runId],
  });
}

/** Form settings lookup for the scoring-breakdown endpoint (run fallback). */
export async function getFormScoringConfigById(formId) {
  return db.execute({
    sql: "SELECT settings FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** Run detail row including the run's group target (for the run detail view). */
export async function getRunDetailWithGroupTargetById(id) {
  return db.execute({ sql: "SELECT r.*, (SELECT a.target_id FROM platform_form_run_assignments a WHERE a.run_id = r.id AND a.target_type = 'group' LIMIT 1) as group_target_id FROM platform_form_runs r WHERE r.id = ?", args: [parseInt(id)] });
}

/** Assignment rows for a run (run detail view). */
export async function getAssignmentsByRunId(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_run_assignments WHERE run_id = ?", args: [parseInt(runId)] });
}

/** Submission rows for a run, newest first (run detail view). */
export async function getSubmissionsByRunId(runId) {
  return db.execute({ sql: "SELECT * FROM platform_form_submissions WHERE run_id = ? ORDER BY updated_at DESC", args: [parseInt(runId)] });
}

/**
 * Every submission of every run that is still open, with the run it answers.
 *
 * The Responses table used to fetch each open run's FULL detail to get at its
 * submissions - one heavy round trip per run, in sequence, with the table waiting
 * for the last one. A submission already knows which run it belongs to, so one
 * query serves the whole table.
 *
 * "Still open" matches what the table shows: a run whose status is draft or
 * cancelled is left out. COALESCE rather than NOT IN on its own, because a run
 * with no status recorded is shown and a bare NOT IN would drop it.
 */
export async function listSubmissionsForOpenRuns() {
  return db.execute({
    sql: `SELECT ps.*, r.name AS run_name, r.form_id AS form_id, r.status AS run_status
          FROM platform_form_submissions ps
          JOIN platform_form_runs r ON r.id = ps.run_id
          WHERE COALESCE(r.status, '') NOT IN ('draft', 'cancelled')
          ORDER BY ps.updated_at DESC`,
  });
}

/**
 * Approved submissions whose result email has not gone out yet, together with
 * the settings the delay is read from (the run's and its form's).
 *
 * The automatic send is time-based per RUN, so the decision cannot be taken by
 * SQL alone: this query narrows the field to the submissions that COULD be due
 * (approved, submitted, no result email ever marked 'sent' for them), and the
 * caller applies each run's delay. A submission with no sent result row is the
 * only candidate — the sent row is the idempotency sentinel, so a second pass
 * can never resend.
 */
export async function listApprovedSubmissionsAwaitingResultEmail() {
  return db.execute({
    sql: `SELECT ps.id, ps.run_id, ps.submitter_id, ps.submitted_at, ps.updated_at,
                 r.name AS run_name, r.settings AS run_settings,
                 f.name AS form_name, f.settings AS form_settings
          FROM platform_form_submissions ps
          JOIN platform_form_runs r ON r.id = ps.run_id
          JOIN platform_forms f ON f.id = r.form_id
          WHERE ps.status = 'approved'
            AND ps.submitted_at IS NOT NULL
            AND COALESCE(r.status, '') NOT IN ('draft', 'cancelled')
            AND NOT EXISTS (
              SELECT 1 FROM platform_email_log el
              WHERE el.submission_id = ps.id AND el.email_type = 'result' AND el.status = 'sent'
            )
          ORDER BY ps.submitted_at ASC`,
  });
}

/** Review rows for a run's submissions (run detail view). */
export async function getReviewsByRunId(runId) {
  return db.execute({ sql: "SELECT pr.* FROM platform_submission_reviews pr JOIN platform_form_submissions ps ON pr.submission_id = ps.id WHERE ps.run_id = ? ORDER BY pr.created_at DESC", args: [parseInt(runId)] });
}

/** Latest AI evaluation per submission of a run (run detail view). */
export async function getLatestEvaluationsByRunId(runId) {
  return db.execute({
    sql: `SELECT DISTINCT ON (submission_id) *
                FROM platform_submission_evaluations
                WHERE submission_id IN (SELECT id FROM platform_form_submissions WHERE run_id = ?)
                ORDER BY submission_id, evaluated_at DESC`,
    args: [parseInt(runId)],
  });
}

/** Latest email-log row per (submission, email_type) for a run. */
export async function getLatestEmailsByRunId(runId) {
  return db.execute({
    sql: `SELECT DISTINCT ON (submission_id, email_type) *
                FROM platform_email_log
                WHERE submission_id IN (SELECT id FROM platform_form_submissions WHERE run_id = ?)
                ORDER BY submission_id, email_type, id DESC`,
    args: [parseInt(runId)],
  });
}

/** Full activation-email history (all rows) for a run's submissions. */
export async function getActivationEmailLogsByRunId(runId) {
  return db.execute({
    sql: `SELECT el.submission_id, el.status, el.sent_at, el.created_at
                FROM platform_email_log el
                JOIN platform_form_submissions s ON el.submission_id = s.id
                WHERE s.run_id = ? AND el.email_type = 'activation'
                ORDER BY el.id ASC`,
    args: [parseInt(runId)],
  });
}

/** Form fields for a run (respondent enrichment: labels + filterable options). */
export async function getFormFieldsForRunById(formIdOfRun) {
  return db.execute({
    sql: "SELECT id, label, options FROM platform_form_fields WHERE form_id::text = ? ORDER BY sort_order, id",
    args: [String(formIdOfRun)],
  });
}

/** Contact account rows by cid (respondent enrichment). */
export async function getContactsByCids(cids) {
  return db.execute({
    sql: "SELECT cid, email, name, password, status, archived_at, deleted, deleted_at FROM contacts WHERE cid = ANY(?)",
    args: [cids],
  });
}

/** Contact account rows by lower(email) (respondent enrichment). */
export async function getContactsByLowerEmails(emailKeys) {
  return db.execute({
    sql: "SELECT cid, email, name, password, status, archived_at, deleted, deleted_at FROM contacts WHERE LOWER(email) = ANY(?)",
    args: [emailKeys],
  });
}

/** Latest password-setup token per contact (activation link validity). */
export async function getPasswordTokensByContactCids(contactCids) {
  return db.execute({
    sql: `SELECT contact_cid, used, expires_at
                  FROM password_setup_tokens
                  WHERE contact_cid = ANY(?)
                  ORDER BY created_at DESC, id DESC`,
    args: [contactCids],
  });
}

/** A submitter's submissions (with run name/status) for the submitter_id param. */
export async function getSubmissionsBySubmitterId(submitterId) {
  return db.execute({ sql: "SELECT ps.*, pfr.name as run_name, pfr.status as run_status FROM platform_form_submissions ps JOIN platform_form_runs pfr ON ps.run_id = pfr.id WHERE ps.submitter_id = ? ORDER BY ps.updated_at DESC", args: [submitterId] });
}
