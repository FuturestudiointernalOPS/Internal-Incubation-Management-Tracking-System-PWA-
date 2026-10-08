import db from "@/lib/db";

/**
 * Platform AI model — the batch evaluation engine (REPOSITORY layer).
 *
 * The claims/failures/progress reads, the auto-approval reads and writes, the
 * duplicate guard and the batch claim scope. Split verbatim out of
 * `models/platformAi.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

// ── /api/platform/ai/evaluate-submission — batch evaluation engine ───────────

/** Ensure the claims table exists (batch evaluation claim guard). */
export async function createEvaluationClaimsTable() {
  return db.execute(`CREATE TABLE IF NOT EXISTS platform_evaluation_claims (
      submission_id INTEGER PRIMARY KEY,
      claimed_at TIMESTAMP DEFAULT NOW()
    )`);
}

/** Ensure the evaluation-failures table exists (retryable failure records). */
export async function createEvaluationFailuresTable() {
  return db.execute(`CREATE TABLE IF NOT EXISTS platform_evaluation_failures (
      submission_id INTEGER PRIMARY KEY,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
}

/** Delete claims older than the claim TTL so they can be re-attempted. */
export async function deleteExpiredEvaluationClaims(claimTtlMinutes) {
  return db.execute({
    sql: `DELETE FROM platform_evaluation_claims WHERE claimed_at < NOW() - INTERVAL '${claimTtlMinutes} minutes'`,
    args: [],
  });
}

/** Progress denominator: all real submissions of a form, in any review state. */
export async function countProgressTotalSubmissions(formId) {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS cnt FROM platform_form_submissions ps
            JOIN platform_form_runs r ON ps.run_id = r.id
            WHERE r.form_id = ? AND ps.status IN ('submitted', 'approved', 'rejected', 'revision_requested')`,
    args: [parseInt(formId)],
  });
}

/** Progress numerator: distinct submissions of a form that have an evaluation. */
export async function countProgressEvaluatedSubmissions(formId) {
  return db.execute({
    sql: `SELECT COUNT(DISTINCT e.submission_id)::int AS cnt
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions ps ON e.submission_id = ps.id
            JOIN platform_form_runs r ON ps.run_id = r.id
            WHERE r.form_id = ?`,
    args: [parseInt(formId)],
  });
}

/** Progress failures: recorded failures of a form with no saved evaluation. */
export async function countProgressFailedSubmissions(formId) {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS cnt
            FROM platform_evaluation_failures f
            JOIN platform_form_submissions ps ON f.submission_id = ps.id
            JOIN platform_form_runs r ON ps.run_id = r.id
            WHERE r.form_id = ?
            AND f.submission_id NOT IN (SELECT submission_id FROM platform_submission_evaluations)`,
    args: [parseInt(formId)],
  });
}

/** Clear a submission's failure record after a successful evaluation. */
export async function deleteEvaluationFailureRecord(submissionId) {
  return db.execute({
    sql: "DELETE FROM platform_evaluation_failures WHERE submission_id = ?",
    args: [submissionId],
  });
}

/** Record (or refresh) the failure message for a submission that failed. */
export async function recordEvaluationFailure(submissionId, error) {
  return db.execute({
    sql: `INSERT INTO platform_evaluation_failures (submission_id, error)
              VALUES (?, ?)
              ON CONFLICT (submission_id) DO UPDATE SET error = EXCLUDED.error, created_at = NOW()`,
    args: [submissionId, error.substring(0, 500)],
  });
}

/** Name of the group a run is assigned to (approval email template lookup). */
export async function getGroupNameForRun(runId) {
  return db.execute({
    sql: `SELECT f.name
            FROM platform_form_run_assignments a
            JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT))
            WHERE a.run_id = ? AND a.target_type = 'group'
            LIMIT 1`,
    args: [runId],
  });
}

/** Full submission row used by the auto-approval cutoff check. */
export async function getSubmissionForAutoApprove(submissionId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
    args: [submissionId],
  });
}

/** Full run row used by the auto-approval cutoff check. */
export async function getRunForAutoApprove(runId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_runs WHERE id = ?",
    args: [runId],
  });
}

/** Full form row used by the auto-approval cutoff check. */
export async function getFormForAutoApprove(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** Field ids + labels of a form (duplicate-guard email resolution). */
export async function getFieldLabelsForDuplicateGuard(formId) {
  return db.execute({
    sql: "SELECT id, label FROM platform_form_fields WHERE form_id = ?",
    args: [formId],
  });
}

/** Same-email siblings of a submission; the highest score wins auto-approval. */
export async function findHigherScoredDuplicateSubmissions(runId, submissionId, applicantEmail) {
  return db.execute({
    sql: `SELECT s.id, s.status,
                      (SELECT overall_score FROM platform_submission_evaluations
                       WHERE submission_id = s.id ORDER BY evaluated_at DESC LIMIT 1) AS overall_score
                FROM platform_form_submissions s
                WHERE s.run_id = ? AND s.id != ?
                  AND s.data::text ILIKE '%' || ? || '%'
                  AND s.status IN ('submitted','approved')`,
    args: [runId, submissionId, applicantEmail],
  });
}

/** Record the review row for a system auto-approval decision. */
export async function insertAutoApprovalReview(submissionId, comment) {
  return db.execute({
    sql: `INSERT INTO platform_submission_reviews (submission_id, reviewer_id, reviewer_name, decision, comment) VALUES (?, 'system', 'System Auto-Approval', 'approved', ?)`,
    args: [submissionId, comment],
  });
}

/** Flip a still-submitted submission to approved; returns the updated row. */
export async function approveSubmissionAndReturn(submissionId) {
  return db.execute({
    sql: "UPDATE platform_form_submissions SET status = 'approved', updated_at = NOW() WHERE id = ? AND status = 'submitted' RETURNING *",
    args: [submissionId],
  });
}

/** Field ids + labels of a form (auto-approval email name/address resolution). */
export async function getFieldLabelsForApprovalEmail(formId) {
  return db.execute({
    sql: "SELECT id, label FROM platform_form_fields WHERE form_id = ?",
    args: [formId],
  });
}

/** Contact name for the auto-approval email's personalized greeting. */
export async function getContactNameByCid(cid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Batch candidates: submitted, unevaluated, unclaimed (retry scope optional). */
export async function findEvaluationBatchCandidates(formId, batchSize, onlyFailed, claimTtlMinutes) {
  const where = onlyFailed
    ? `AND ps.id IN (SELECT submission_id FROM platform_evaluation_failures)`
    : `AND ps.id NOT IN (SELECT submission_id FROM platform_evaluation_failures)`;
  return db.execute({
    sql: `SELECT ps.id FROM platform_form_submissions ps
          JOIN platform_form_runs r ON ps.run_id = r.id
          WHERE r.form_id = ? AND ps.status = 'submitted'
          ${where}
          AND ps.id NOT IN (SELECT submission_id FROM platform_submission_evaluations)
          AND NOT EXISTS (
            SELECT 1 FROM platform_evaluation_claims c
            WHERE c.submission_id = ps.id AND c.claimed_at > NOW() - INTERVAL '${claimTtlMinutes} minutes'
          )
          ORDER BY ps.id
          LIMIT ?`,
    args: [parseInt(formId), batchSize],
  });
}

/** Claim a batch candidate (ON CONFLICT DO NOTHING — losers were claimed). */
export async function claimEvaluationSubmission(submissionId) {
  return db.execute({
    sql: `INSERT INTO platform_evaluation_claims (submission_id)
              VALUES (?) ON CONFLICT (submission_id) DO NOTHING RETURNING submission_id`,
    args: [submissionId],
  });
}

/** Release a claim after its submission was evaluated (success or failure). */
export async function releaseEvaluationClaim(submissionId) {
  return db.execute({
    sql: "DELETE FROM platform_evaluation_claims WHERE submission_id = ?",
    args: [submissionId],
  });
}

/** Approved/rejected counts of a form (approval panel on the progress view). */
export async function countApprovalDecisionsForForm(formId) {
  return db.execute({
    sql: `SELECT ps.status, COUNT(*)::int AS cnt
                FROM platform_form_submissions ps
                JOIN platform_form_runs r ON ps.run_id = r.id
                WHERE r.form_id = ? AND ps.status IN ('approved','rejected')
                GROUP BY ps.status`,
    args: [parseInt(formId)],
  });
}

/** Manual re-evaluate: drop prior evaluations so exactly one current row stays. */
export async function deleteEvaluationsForSubmission(submissionId) {
  return db.execute({
    sql: "DELETE FROM platform_submission_evaluations WHERE submission_id = ?",
    args: [parseInt(submissionId)],
  });
}

/** Manual re-evaluate: drop the failure record so the retry starts clean. */
export async function resetEvaluationFailuresForSubmission(submissionId) {
  return db.execute({
    sql: "DELETE FROM platform_evaluation_failures WHERE submission_id = ?",
    args: [parseInt(submissionId)],
  });
}
