import db from "@/lib/db";

/**
 * Platform form-run model — data access for the form-runs controller
 * (`src/app/api/platform/form-runs/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── Shared helpers: timeline logging, assignment enrichment, scoring ──────────

/** Append a row to a submission's timeline (fire-and-forget at call site). */
export async function insertTimelineEntry(submissionId, action, actorId, actorName, meta) {
  return db.execute({
    sql: `INSERT INTO platform_submission_timeline (submission_id, action, actor_id, actor_name, metadata) VALUES (?, ?, ?, ?, ?)`,
    args: [submissionId, action, actorId || null, actorName || null, JSON.stringify(meta)],
  });
}

/** Contacts matched by cid OR lower(email) for assignment name/email enrichment. */
export async function getContactsForAssignmentEnrichment(userIds, emails) {
  return db.execute({
    sql: 'SELECT cid, name, email FROM contacts WHERE cid = ANY(?) OR LOWER(email) = ANY(?)',
    args: [userIds, emails],
  });
}

/** Families matched by registration_id OR cast(id) for assignment enrichment. */
export async function getFamiliesForAssignmentEnrichment(groupIds) {
  return db.execute({
    sql: 'SELECT id, registration_id, name FROM families WHERE registration_id = ANY(?) OR CAST(id AS TEXT) = ANY(?)',
    args: [groupIds, groupIds],
  });
}

/** Programs matched by id for assignment enrichment. */
export async function getProgramsForAssignmentEnrichment(programIds) {
  return db.execute({
    sql: 'SELECT id, name FROM v2_programs WHERE id = ANY(?)',
    args: [programIds],
  });
}

/** Run scoring settings lookup (run-level scoring config). */
export async function getRunScoringSettingsById(runId) {
  return db.execute({
    sql: "SELECT form_id, settings FROM platform_form_runs WHERE id = ?",
    args: [parseInt(runId)],
  });
}

/** Form settings lookup — fallback scoring config when the run has none. */
export async function getFormScoringSettingsById(formId) {
  return db.execute({
    sql: "SELECT settings FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

// ── GET /api/platform/form-runs ──────────────────────────────────────────────

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

/** Count of runs matching the list filters (paginated run list). */
export async function countFormRuns({ groupId, programId, formId, status }) {
  const baseFrom = `FROM platform_form_runs r
      JOIN platform_forms f ON r.form_id = f.id
      LEFT JOIN LATERAL (
        SELECT a.target_id
        FROM platform_form_run_assignments a
        WHERE a.run_id = r.id AND a.target_type = 'group'
        LIMIT 1
      ) ga ON true`;
  const conditions = [];
  const args = [];

  if (groupId) {
    conditions.push("EXISTS (SELECT 1 FROM platform_form_run_assignments ga2 WHERE ga2.run_id = r.id AND ga2.target_type = 'group' AND ga2.target_id = ?)");
    args.push(groupId);
  }
  if (programId) {
    conditions.push("EXISTS (SELECT 1 FROM platform_form_run_assignments pa WHERE pa.run_id = r.id AND pa.target_type = 'program' AND pa.target_id = ?)");
    args.push(programId);
  }
  if (formId) { conditions.push("r.form_id = ?"); args.push(parseInt(formId)); }
  if (status && status !== "all") {
    conditions.push("r.status = ?");
    args.push(status);
  } else {
    conditions.push("r.status IS DISTINCT FROM 'archived'");
  }

  const whereClause = conditions.length ? " WHERE " + conditions.join(" AND ") : "";

  return db.execute({ sql: `SELECT COUNT(*) AS total ${baseFrom}${whereClause}`, args });
}

/** Page of runs matching the list filters (paginated run list). */
export async function listFormRuns({ groupId, programId, formId, status, perPage, offset }) {
  const baseFrom = `FROM platform_form_runs r
      JOIN platform_forms f ON r.form_id = f.id
      LEFT JOIN LATERAL (
        SELECT a.target_id
        FROM platform_form_run_assignments a
        WHERE a.run_id = r.id AND a.target_type = 'group'
        LIMIT 1
      ) ga ON true`;
  const conditions = [];
  const args = [];

  if (groupId) {
    conditions.push("EXISTS (SELECT 1 FROM platform_form_run_assignments ga2 WHERE ga2.run_id = r.id AND ga2.target_type = 'group' AND ga2.target_id = ?)");
    args.push(groupId);
  }
  if (programId) {
    conditions.push("EXISTS (SELECT 1 FROM platform_form_run_assignments pa WHERE pa.run_id = r.id AND pa.target_type = 'program' AND pa.target_id = ?)");
    args.push(programId);
  }
  if (formId) { conditions.push("r.form_id = ?"); args.push(parseInt(formId)); }
  if (status && status !== "all") {
    conditions.push("r.status = ?");
    args.push(status);
  } else {
    conditions.push("r.status IS DISTINCT FROM 'archived'");
  }

  const whereClause = conditions.length ? " WHERE " + conditions.join(" AND ") : "";

  return db.execute({
    sql: `SELECT r.*, f.name as form_name, ga.target_id as group_target_id ${baseFrom}${whereClause} ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`,
    args: [...args, perPage, offset],
  });
}

// ── Decision-email helper queries (sendDecisionEmailForSubmission) ───────────

/** Full submission row for the tracked decision-email flow. */
export async function getDecisionEmailSubmissionById(submission_id) {
  return db.execute({
    sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
    args: [parseInt(submission_id)],
  });
}

/** Form field labels for a run (name resolution in the decision email). */
export async function getFieldLabelsByRunId(runId) {
  return db.execute({
    sql: `SELECT f2.id, f2.label
              FROM platform_form_fields f2
              JOIN platform_form_runs r2 ON f2.form_id = r2.form_id
              WHERE r2.id = ?`,
    args: [runId],
  });
}

/** Contact name + email by cid (decision-email CRM identity). */
export async function getContactNameEmailByCid(cid) {
  return db.execute({
    sql: "SELECT name, email FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Group-assignment existence check for a run (approval emails require a group). */
export async function getGroupAssignedToRunById(runId) {
  return db.execute({
    sql: `SELECT 1
                FROM platform_form_run_assignments a
                JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT))
                WHERE a.run_id = ? AND a.target_type = 'group'
                LIMIT 1`,
    args: [runId],
  });
}

/** Run form_id + form settings (rejection-automation toggle check). */
export async function getRunFormSettingsForDecisionById(runId) {
  return db.execute({ sql: "SELECT r.form_id, f.settings FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.id = ?", args: [runId] });
}

/** Run form name/settings + run settings (decision-email template selection). */
export async function getRunTemplateSettingsForDecisionById(runId) {
  return db.execute({ sql: "SELECT f.name, f.settings, r.settings AS run_settings FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.id = ?", args: [runId] });
}

/** Group name for a run's assignment (decision-email template variable). */
export async function getGroupNameForDecisionEmailByRunId(runId) {
  return db.execute({
    sql: `SELECT f.name AS group_name
                  FROM platform_form_run_assignments a
                  JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT))
                  WHERE a.run_id = ? AND a.target_type = 'group'
                  LIMIT 1`,
    args: [runId],
  });
}

/** Latest stored overall score for a submission (decision-email variable). */
export async function getLatestScoreBySubmissionId(submissionId) {
  return db.execute({
    sql: "SELECT overall_score FROM platform_submission_evaluations WHERE submission_id = ? ORDER BY evaluated_at DESC LIMIT 1",
    args: [parseInt(submissionId)],
  });
}

/** Run + form context (names + form id) for a submission's result PDF. */
export async function getRunFormContextBySubmissionId(submissionId) {
  return db.execute({
    sql: `SELECT s.run_id, r.form_id, r.name AS run_name, f.name AS form_name
          FROM platform_form_submissions s
          JOIN platform_form_runs r ON s.run_id = r.id
          JOIN platform_forms f ON r.form_id = f.id
          WHERE s.id = ?`,
    args: [parseInt(submissionId)],
  });
}

/** Latest full evaluation row (dimensions/overall/ranking) for a submission. */
export async function getLatestEvaluationBySubmissionId(submissionId) {
  return db.execute({
    sql: "SELECT * FROM platform_submission_evaluations WHERE submission_id = ? ORDER BY evaluated_at DESC LIMIT 1",
    args: [parseInt(submissionId)],
  });
}

// ── Review workflow queries (processReviewInternal) ──────────────────────────

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

// ── POST /api/platform/form-runs ─────────────────────────────────────────────

/** Change a run's status (close/cancel/archive/reactivate). */
export async function updateRunStatusById(id, status) {
  return db.execute({
    sql: `UPDATE platform_form_runs SET status = ?, updated_at = NOW() WHERE id = ? RETURNING *`,
    args: [status, parseInt(id)],
  });
}

/** Run status + close date (submission deadline gate). */
export async function getRunSubmissionGateById(runId) {
  return db.execute({ sql: "SELECT status, closes_at FROM platform_form_runs WHERE id = ?", args: [parseInt(runId)] });
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

/** Super-admin migration action: run an arbitrary SQL statement as-is. */
export async function executeRawMigrationSql(sql) {
  return db.execute({ sql, args: [] });
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

// ── PUT /api/platform/form-runs ──────────────────────────────────────────────

/** Update run metadata fields present on the payload (returns the updated row). */
export async function updateFormRunMetadataById({ id, name, description, status, opens_at, closes_at, settings }) {
  const fields = [];
  const args = [];
  const updatable = { name, description, status, opens_at, closes_at };
  for (const [k, v] of Object.entries(updatable)) {
    if (v !== undefined) { fields.push(`${k} = ?`); args.push(v); }
  }
  if (settings !== undefined) { fields.push("settings = ?"); args.push(JSON.stringify(settings)); }
  fields.push("updated_at = NOW()");
  args.push(parseInt(id));

  return db.execute({
    sql: `UPDATE platform_form_runs SET ${fields.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

// ── DELETE /api/platform/form-runs ───────────────────────────────────────────

/** Delete a run's email-log rows (cascade cleanup before run delete). */
export async function deleteEmailLogsByRunId(runId) {
  return db.execute({ sql: "DELETE FROM platform_email_log WHERE submission_id IN (SELECT id FROM platform_form_submissions WHERE run_id = ?)", args: [runId] });
}

/** Delete a run's review rows (cascade cleanup before run delete). */
export async function deleteReviewsByRunId(runId) {
  return db.execute({ sql: "DELETE FROM platform_submission_reviews WHERE submission_id IN (SELECT id FROM platform_form_submissions WHERE run_id = ?)", args: [runId] });
}

/** Delete a run's evaluation rows (cascade cleanup before run delete). */
export async function deleteEvaluationsByRunId(runId) {
  return db.execute({ sql: "DELETE FROM platform_submission_evaluations WHERE submission_id IN (SELECT id FROM platform_form_submissions WHERE run_id = ?)", args: [runId] });
}

/** Delete the run row itself (runs with FK cascades). */
export async function deleteFormRunById(runId) {
  return db.execute({ sql: "DELETE FROM platform_form_runs WHERE id = ?", args: [runId] });
}
