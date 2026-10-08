import db from "@/lib/db";

/**
 * Platform form-run model — decision-email helpers (REPOSITORY layer).
 *
 * The lookups behind `sendDecisionEmailForSubmission`: submission identity,
 * field labels, group assignment and the template variables. Split verbatim out
 * of `models/formRuns/readsAndHelpers.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

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

/** Run + form context (names + form id + run settings) for a submission's result PDF. */
export async function getRunFormContextBySubmissionId(submissionId) {
  return db.execute({
    sql: `SELECT s.run_id, r.form_id, r.name AS run_name, r.settings AS run_settings, f.name AS form_name
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
