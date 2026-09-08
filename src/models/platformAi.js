import db from "@/lib/db";

/**
 * Platform AI + seed model — data access for the platform AI & seed controllers:
 *   - `src/app/api/platform/ai/evaluate-submission/route.js`   (24 queries)
 *   - `src/app/api/platform/ai/evaluation-scores/route.js`     (7 queries)
 *   - `src/app/api/platform/ai/generate-all/route.js`          (5 queries)
 *   - `src/app/api/platform/ai/analyze/route.js`               (4 queries)
 *   - `src/app/api/platform/ai/evaluation-config/route.js`     (3 queries)
 *   - `src/app/api/platform/seed/founder-assessment/route.js`  (22 queries)
 *   - `src/app/api/platform/seed/venture-application/route.js` (10 queries)
 *
 * Each function wraps exactly one SQL statement that used to live inline in a
 * controller. SQL is byte-identical to the original queries, so behavior is
 * unchanged — the API jest suites (which mock @/lib/db with SQL string
 * matching) act as the regression net. Extraction is strictly 1:1 with the
 * original inline call sites, so a handful of lookups (e.g. a submission or
 * form fetched by id from different controllers) intentionally repeat the
 * same SQL across functions.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it operates on.
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

// ── /api/platform/ai/evaluation-scores — run-scoped scoreboard ───────────────

/** Run row (id, name, form_id) that anchors the run-scoped scoreboard. */
export async function getRunInfoForScores(runId) {
  return db.execute({
    sql: "SELECT id, name, form_id FROM platform_form_runs WHERE id = ?",
    args: [parseInt(runId)],
  });
}

/** A form's real fields — the dynamic filter/answer-label source. */
export async function getFormFieldsForScores(formId) {
  return db.execute({
    sql: "SELECT id, label, field_type, options FROM platform_form_fields WHERE form_id::text = ? ORDER BY sort_order, id",
    args: [String(formId)],
  });
}

/** Total evaluated submissions in the run/form scope. */
export async function countEvaluatedSubmissionsForScores(whereSql, args) {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS cnt
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereSql}`,
    args,
  });
}

/** Count of qualifying submissions after the min/max score filters. */
export async function countQualifyingEvaluationsForScores(whereSql, args) {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS cnt
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereSql}`,
    args,
  });
}

/** Average overall score of the qualifying submissions. */
export async function getAverageQualifyingScoreForScores(whereSql, args) {
  return db.execute({
    sql: `SELECT COALESCE(AVG(e.overall_score), 0)::float AS avg
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereSql}`,
    args,
  });
}

/** Respondent rows with submission data, ordered by score (asc or desc). */
export async function listScoreRespondents(whereSql, args, sortDir) {
  return db.execute({
    sql: `SELECT
              s.submitter_name AS name,
              s.submitter_id,
              s.status AS submission_status,
              s.data AS submission_data,
              e.overall_score AS score,
              e.ranking,
              e.recommendation,
              e.submission_id
            FROM platform_submission_evaluations e
            JOIN platform_form_submissions s ON e.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE ${whereSql}
            ORDER BY e.overall_score ${sortDir}`,
    args,
  });
}

/** Batch contact emails for a list of cids (instead of one query per respondent). */
export async function getContactEmailsByCids(cids) {
  return db.execute({
    sql: "SELECT cid, email FROM contacts WHERE cid = ANY(?)",
    args: [cids],
  });
}

// ── /api/platform/ai/generate-all — AI-generated form + framework ────────────

/** Create the AI-generated form draft; returns the full form row. */
export async function createAiGeneratedForm(title, description, collectionId) {
  return db.execute({
    sql: `INSERT INTO platform_forms (name, description, collection_id, status, visibility, version, tags, owner_id, owner_name, settings, created_by)
            VALUES (?, ?, ?, 'draft', 'internal', 1, ARRAY['ai-generated'], 'system', 'AI', '{}', 'system') RETURNING *`,
    args: [title, description || null, collectionId ? parseInt(collectionId) : null],
  });
}

/** Insert one AI-generated section; returns its id. */
export async function insertAiGeneratedSection(formId, title, description, sortOrder) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, description, sort_order) VALUES (?, ?, ?, ?) RETURNING id",
    args: [formId, title, description || null, sortOrder],
  });
}

/** Insert one AI-generated field inside a section. */
export async function insertAiGeneratedField(formId, sectionId, field, sortOrder) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, placeholder, help_text, required, options, validation, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      formId,
      sectionId,
      field.field_type,
      field.label,
      field.placeholder || null,
      field.help_text || null,
      field.required,
      field.options ? JSON.stringify(field.options) : null,
      field.validation ? JSON.stringify(field.validation) : null,
      sortOrder,
    ],
  });
}

/** Save (or replace) the AI-generated evaluation framework for the form. */
export async function upsertAiEvaluationFramework(formId, framework, sourceDocument) {
  return db.execute({
    sql: `INSERT INTO platform_evaluation_frameworks (form_id, framework, source_document, created_by, updated_at)
              VALUES (?, ?, ?, 'ai', NOW())
              ON CONFLICT (form_id) DO UPDATE SET framework = EXCLUDED.framework, updated_at = NOW()`,
    args: [formId, JSON.stringify(framework), sourceDocument.substring(0, 500)],
  });
}

/** Delete a form by id (orphan cleanup after a failed AI generation). */
export async function deleteFormById(formId) {
  return db.execute({
    sql: "DELETE FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

// ── /api/platform/ai/analyze — submission summarize/analyze ──────────────────

/** Full submission row for AI analysis. */
export async function getSubmissionForAiAnalysis(submissionId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
    args: [submissionId],
  });
}

/** Full run row providing context for AI analysis. */
export async function getRunForAiAnalysis(runId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_runs WHERE id = ?",
    args: [runId],
  });
}

/** Full form row providing context for AI analysis. */
export async function getFormForAiAnalysis(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** Governance log entry recording that a submission was AI-analyzed. */
export async function logAiAnalysisToTimeline(submissionId, metadata) {
  return db.execute({
    sql: `INSERT INTO platform_submission_timeline (submission_id, action, actor_id, metadata)
              VALUES (?, 'ai_analyzed', ?, ?)`,
    args: [submissionId, "system", JSON.stringify(metadata)],
  });
}

// ── /api/platform/ai/evaluation-config — framework CRUD ──────────────────────

/** The saved evaluation framework for a form (if any). */
export async function getEvaluationFrameworkByFormId(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_evaluation_frameworks WHERE form_id = ?",
    args: [parseInt(formId)],
  });
}

/** Save or update an evaluation framework for a form. */
export async function upsertFormEvaluationFramework(formId, framework, sourceDocument) {
  return db.execute({
    sql: `INSERT INTO platform_evaluation_frameworks (form_id, framework, source_document, created_by, updated_at)
            VALUES (?, ?, ?, 'system', NOW())
            ON CONFLICT (form_id) DO UPDATE SET
              framework = EXCLUDED.framework,
              source_document = EXCLUDED.source_document,
              updated_at = NOW()`,
    args: [parseInt(formId), JSON.stringify(framework), sourceDocument || null],
  });
}

/** Remove the evaluation framework for a form (disables AI evaluation). */
export async function deleteEvaluationFrameworkByFormId(formId) {
  return db.execute({
    sql: "DELETE FROM platform_evaluation_frameworks WHERE form_id = ?",
    args: [parseInt(formId)],
  });
}

// ── /api/platform/seed/founder-assessment — Founder Fit Score form seed ──────

/** Upsert the "Founder Assessments" platform collection; returns its id. */
export async function upsertFounderAssessmentCollection() {
  return db.execute({
    sql: `INSERT INTO platform_collections (name, slug, description, status, visibility, tags, category, color, created_by)
            VALUES ('Founder Assessments', 'founder-assessments', 'Standardized founder evaluation assessments for incubation and acceleration programs', 'active', 'internal', ARRAY['assessment','founder','scoring','evaluation'], 'Assessment', '#FF6600', 'system')
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status, updated_at = NOW()
            RETURNING id`,
    args: [],
  });
}

/** Look up the existing Founder Fit Score form (id only). */
export async function findFounderAssessmentForm() {
  return db.execute({
    sql: "SELECT id FROM platform_forms WHERE name = 'Founder Fit Score Assessment'",
    args: [],
  });
}

/** Drop all fields of a form (reseeding wipes the old structure first). */
export async function deleteFounderFormFields(formId) {
  return db.execute({
    sql: "DELETE FROM platform_form_fields WHERE form_id = ?",
    args: [formId],
  });
}

/** Drop all sections of a form (reseeding wipes the old structure first). */
export async function deleteFounderFormSections(formId) {
  return db.execute({
    sql: "DELETE FROM platform_form_sections WHERE form_id = ?",
    args: [formId],
  });
}

/** Reset an existing Founder Fit Score form to the canonical seed definition. */
export async function resetFounderAssessmentForm(description, collectionId, visibility, tags, settings, formId) {
  return db.execute({
    sql: `UPDATE platform_forms SET description = ?, collection_id = ?, visibility = ?, tags = ?, owner_id = 'system', owner_name = 'Platform', settings = ?, status = 'draft', version = 1, updated_at = NOW() WHERE id = ?`,
    args: [description, collectionId, visibility, tags, JSON.stringify(settings), formId],
  });
}

/** Create the Founder Fit Score form; returns its id. */
export async function insertFounderAssessmentForm(collectionId, settings) {
  return db.execute({
    sql: `INSERT INTO platform_forms (name, description, collection_id, status, visibility, version, tags, owner_id, owner_name, settings, created_by)
              VALUES ('Founder Fit Score Assessment', 'Intelligent assessment designed to evaluate whether an entrepreneur or founder is suitable for a startup incubation or acceleration program.', ?, 'draft', 'internal', 1, ARRAY['founder','assessment','scoring','incubation'], 'system', 'Platform', ?, 'system')
              RETURNING id`,
    args: [collectionId, JSON.stringify(settings)],
  });
}

/** Insert the Founder Profile section; returns its id. */
export async function insertFounderProfileSection(formId, sortOrder) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, description, sort_order) VALUES (?, 'Founder Profile', 'Basic founder and startup information', ?) RETURNING id",
    args: [formId, sortOrder],
  });
}

/** Insert one Founder Profile field; returns its id. */
export async function insertFounderProfileField(formId, sectionId, field) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, options, validation, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      formId,
      sectionId,
      field.field_type,
      field.label,
      field.required,
      field.options ? JSON.stringify(field.options) : null,
      field.validation ? JSON.stringify(field.validation) : null,
      field.sort_order,
    ],
  });
}

/** Insert one scored assessment section; returns its id. */
export async function insertScoredAssessmentSection(formId, title, sortOrder) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, sort_order) VALUES (?, ?, ?) RETURNING id",
    args: [formId, title, sortOrder],
  });
}

/** Insert one scored rating field inside a scored section. */
export async function insertScoredRatingField(formId, sectionId, label, ratingOptions, sortOrder) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, options, settings, sort_order)
                VALUES (?, ?, 'rating', ?, true, ?, ?, ?)`,
    args: [formId, sectionId, label, JSON.stringify(ratingOptions), JSON.stringify({ scored: true }), sortOrder],
  });
}

/** Insert the Open Response section; returns its id. */
export async function insertOpenResponseSection(formId, sortOrder) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, sort_order) VALUES (?, 'Open Response', ?) RETURNING id",
    args: [formId, sortOrder],
  });
}

/** Insert one open-response textarea field. */
export async function insertOpenResponseField(formId, sectionId, label, sortOrder) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, validation, sort_order)
              VALUES (?, ?, 'textarea', ?, true, ?, ?)`,
    args: [formId, sectionId, label, JSON.stringify({ minLength: 50 }), sortOrder],
  });
}

/** Bind the idea-validation question to the Stage-of-Business field. */
export async function setIdeaValidationApproachLogic(conditionalLogic, formId) {
  return db.execute({
    sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Describe your idea validation approach'`,
    args: [JSON.stringify(conditionalLogic), formId],
  });
}

/** Bind the customer-interviews question to the Stage-of-Business field. */
export async function setCustomerInterviewsLogic(conditionalLogic, formId) {
  return db.execute({
    sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Have you conducted any customer interviews?'`,
    args: [JSON.stringify(conditionalLogic), formId],
  });
}

/** Bind the revenue question to the Revenue-Generating/Scaling stages. */
export async function setMonthlyRecurringRevenueLogic(conditionalLogic, formId) {
  return db.execute({
    sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Monthly Recurring Revenue (USD)'`,
    args: [JSON.stringify(conditionalLogic), formId],
  });
}

/** Bind the paying-customers question to the Revenue-Generating/Scaling stages. */
export async function setPayingCustomersLogic(conditionalLogic, formId) {
  return db.execute({
    sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Number of Paying Customers'`,
    args: [JSON.stringify(conditionalLogic), formId],
  });
}

/** Bind the team-management question to the Team-Size field. */
export async function setTeamManagementLogic(conditionalLogic, formId) {
  return db.execute({
    sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'How do you manage and coordinate your team?'`,
    args: [JSON.stringify(conditionalLogic), formId],
  });
}

/** All sections of a form in display order (version snapshot). */
export async function getFormSectionsForSnapshot(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_sections WHERE form_id = ? ORDER BY sort_order",
    args: [formId],
  });
}

/** All fields of a form in display order (version snapshot). */
export async function getFormFieldsForSnapshot(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_fields WHERE form_id = ? ORDER BY sort_order",
    args: [formId],
  });
}

/** Full form row (version snapshot settings). */
export async function getFormForSnapshot(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** Publish the seeded form structure as version 1 snapshot. */
export async function upsertFounderAssessmentVersion(formId, snapshot) {
  return db.execute({
    sql: `INSERT INTO platform_form_versions (form_id, version, snapshot, published_at, published_by)
            VALUES (?, 1, ?, NOW(), 'system')
            ON CONFLICT (form_id, version) DO UPDATE SET snapshot = EXCLUDED.snapshot, published_at = NOW()`,
    args: [formId, JSON.stringify(snapshot)],
  });
}

/** Flip the seeded form to published once its snapshot is stored. */
export async function publishFounderAssessmentForm(formId) {
  return db.execute({
    sql: "UPDATE platform_forms SET status = 'published', version = 1, updated_at = NOW() WHERE id = ?",
    args: [formId],
  });
}

// ── /api/platform/seed/venture-application — Venture intake form seed ────────

/** Existing Venture Application form row (if any). */
export async function findVentureApplicationFormByName(name) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE name = ?",
    args: [name],
  });
}

/** (Re)flag an existing form as the single Venture intake. */
export async function flagFormAsVentureApplication(formId) {
  return db.execute({
    sql: `UPDATE platform_forms
                SET settings = settings || '{"venture_application": true}'::jsonb,
                    updated_at = NOW()
                WHERE id = ?`,
    args: [formId],
  });
}

/** Create the Venture Application form; returns its id. */
export async function createVentureApplicationForm(name, description, settings) {
  return db.execute({
    sql: `INSERT INTO platform_forms (name, description, status, visibility, version, settings, created_by, owner_id, owner_name, created_at, updated_at)
              VALUES (?, ?, 'published', 'internal', 1, ?::jsonb, 'system', 'system', 'Platform', NOW(), NOW())
              RETURNING id`,
    args: [name, description, JSON.stringify(settings)],
  });
}

/** Insert one Venture Application section; returns its id. */
export async function insertVentureApplicationSection(formId, title, sortOrder) {
  return db.execute({
    sql: `INSERT INTO platform_form_sections (form_id, title, sort_order, created_at)
                VALUES (?, ?, ?, NOW()) RETURNING id`,
    args: [formId, title, sortOrder],
  });
}

/** Insert one Venture Application field inside a section. */
export async function insertVentureApplicationField(formId, sectionId, field, sortOrder) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, options, settings, sort_order, created_at)
                  VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, NOW())`,
    args: [
      formId,
      sectionId,
      field.type,
      field.label,
      field.required ? true : false,
      JSON.stringify(field.options || []),
      JSON.stringify({ key: field.key }),
      sortOrder,
    ],
  });
}

/** Store the Venture Application form's version-1 snapshot. */
export async function insertVentureApplicationSnapshot(formId, snapshot) {
  return db.execute({
    sql: `INSERT INTO platform_form_versions (form_id, version, snapshot, published_at, published_by, created_at)
              VALUES (?, 1, ?::jsonb, NOW(), 'system', NOW())`,
    args: [formId, JSON.stringify(snapshot)],
  });
}

/** Full seeded Venture Application form row (post-insert re-read). */
export async function getFormByIdForVentureSeed(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** The most recent active run of a form that has a public slug. */
export async function findActiveVentureRun(formId) {
  return db.execute({
    sql: `SELECT * FROM platform_form_runs
            WHERE form_id = ? AND status = 'active' AND public_slug IS NOT NULL
            ORDER BY created_at DESC LIMIT 1`,
    args: [formId],
  });
}

/** Create the active Venture Application run; returns its id. */
export async function createVentureApplicationRun(formId, formVersion, name, description, slug) {
  return db.execute({
    sql: `INSERT INTO platform_form_runs (form_id, form_version, name, description, status, settings, owner_id, created_by, public_slug, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'active', ?::jsonb, 'system', 'system', ?, NOW(), NOW())
              RETURNING id`,
    args: [formId, formVersion || 1, name, description, JSON.stringify({}), slug],
  });
}

/** Full seeded Venture Application run row (post-insert re-read). */
export async function getVentureRunById(runId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_runs WHERE id = ?",
    args: [runId],
  });
}
