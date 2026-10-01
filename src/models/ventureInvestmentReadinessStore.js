/**
 * Venture investment-readiness assessment — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/investmentReadiness`: the
 * per-category probes that score a Venture, the stored assessment / scores /
 * history reads and writes, and the recommendation reads and writes.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`
 * (including the `countVentureVerificationDocuments` call that carries a
 * placeholder but no bound args — preserved verbatim).
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Category probes ──────────────────────────────────────────────────────────

/** A Venture's startup profile row. */
export function selectReadinessStartupProfile(ventureId) {
  return db.execute({ sql: "SELECT * FROM startup_profiles WHERE venture_id = ?", args: [ventureId] });
}

/** A Venture's verification status. */
export function selectReadinessVerificationStatus(ventureId) {
  return db.execute({ sql: "SELECT status FROM venture_verifications WHERE venture_id = ?", args: [ventureId] });
}

/** A Venture's registration number. */
export function selectReadinessRegistrationNumber(ventureId) {
  return db.execute({ sql: "SELECT registration_number FROM ventures WHERE venture_id = ?", args: [ventureId] });
}

/** Count the Venture's verified financial documents. */
export function countVerifiedFinancialDocuments(ventureId) {
  return db.execute({
    sql: `SELECT COUNT(*) as c FROM venture_verification_items vi JOIN venture_verifications v ON vi.verification_id=v.id WHERE v.venture_id=? AND vi.category='financial_documents' AND vi.status='verified'`,
    args: [ventureId],
  });
}

/** Count the Venture's approved report/document deliverables. */
export function countApprovedFinancialDeliverables(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_deliverables WHERE venture_id=? AND status IN ('approved','completed') AND deliverable_type IN ('report','document')", args: [ventureId] });
}

/** Count the Venture's approved/completed deliverables. */
export function countApprovedDeliverables(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_deliverables WHERE venture_id=? AND status IN ('approved','completed')", args: [ventureId] });
}

/** Count the Venture's approved/completed prototype deliverables. */
export function countApprovedPrototypes(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_deliverables WHERE venture_id=? AND deliverable_type='prototype' AND status IN ('approved','completed')", args: [ventureId] });
}

/** Milestone totals (total / done) for readiness. */
export function selectReadinessMilestoneTotals(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as d FROM venture_milestones WHERE venture_id=?", args: [ventureId] });
}

/** Task totals (total / done) for readiness. */
export function selectReadinessTaskTotals(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as d FROM venture_tasks WHERE venture_id=?", args: [ventureId] });
}

/** Count the Venture's done tasks. */
export function countDoneTasks(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_tasks WHERE venture_id=? AND status='done'", args: [ventureId] });
}

/** A Venture's industry + business stage. */
export function selectReadinessIndustryAndStage(ventureId) {
  return db.execute({ sql: "SELECT industry, business_stage FROM ventures WHERE venture_id=?", args: [ventureId] });
}

/** A Venture's business stage. */
export function selectReadinessBusinessStage(ventureId) {
  return db.execute({ sql: "SELECT business_stage FROM ventures WHERE venture_id=?", args: [ventureId] });
}

/** Count the Venture's completed sessions. */
export function countReadinessCompletedSessions(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE venture_id=? AND status='completed'", args: [ventureId] });
}

/** Count the Venture's completed pitch-review sessions. */
export function countReadinessPitchReviews(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE venture_id=? AND session_type='pitch_review' AND status='completed'", args: [ventureId] });
}

/** Count the Venture's accepted founders. */
export function countReadinessAcceptedFounders(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_founders WHERE venture_id=? AND status='accepted'", args: [ventureId] });
}

/** Count the Venture's active coach assignments. */
export function countReadinessCoachAssignments(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_coach_assignments WHERE venture_id=? AND status='active'", args: [ventureId] });
}

/**
 * Count the Venture's verification documents. The statement carries a `?` but no
 * bound args — kept verbatim (the caller's try/catch absorbs the driver error).
 */
export function countVentureVerificationDocuments() {
  return db.execute({ sql: `SELECT COUNT(*) as c FROM venture_verification_documents vvd JOIN venture_verifications vv ON vvd.verification_id=vv.id WHERE vv.venture_id=?` });
}

// ── Assessment reads / writes ────────────────────────────────────────────────

/** The most recent stored assessment's score + level. */
export function selectLatestAssessmentSummary(ventureId) {
  return db.execute({ sql: "SELECT overall_score, investment_level FROM investment_assessments WHERE venture_id=? ORDER BY calculated_at DESC LIMIT 1", args: [ventureId] });
}

/** The most recent stored assessment row. */
export function selectLatestAssessment(ventureId) {
  return db.execute({ sql: `SELECT * FROM investment_assessments WHERE venture_id=? ORDER BY calculated_at DESC LIMIT 1`, args: [ventureId] });
}

/** Insert one assessment, returning its id. */
export function insertAssessment(ventureId, overallScore, investmentLevel) {
  return db.execute({ sql: `INSERT INTO investment_assessments (venture_id, overall_score, investment_level, calculated_at) VALUES (?, ?, ?, NOW()) RETURNING id`, args: [ventureId, overallScore, investmentLevel] });
}

/** Insert one assessment category score. */
export function insertAssessmentScore(assessmentId, category, score, weight) {
  return db.execute({ sql: `INSERT INTO investment_scores (assessment_id, category, score, weight) VALUES (?, ?, ?, ?)`, args: [assessmentId, category, score, weight] });
}

/** The category scores of an assessment. */
export function selectAssessmentScores(assessmentId) {
  return db.execute({ sql: "SELECT * FROM investment_scores WHERE assessment_id=? ORDER BY category", args: [assessmentId] });
}

/** Append an investment-history row. */
export function insertInvestmentHistory(ventureId, previousScore, newScore, previousLevel, newLevel) {
  return db.execute({
    sql: `INSERT INTO investment_history (venture_id, previous_score, new_score, previous_level, new_level, trigger_event)
          VALUES (?, ?, ?, ?, ?, 'auto_evaluation')`,
    args: [ventureId, previousScore, newScore, previousLevel, newLevel],
  });
}

/** A Venture's investment-history rows, newest first. */
export function selectInvestmentHistory(ventureId) {
  return db.execute({ sql: `SELECT * FROM investment_history WHERE venture_id=? ORDER BY created_at DESC LIMIT 20`, args: [ventureId] });
}

// ── Recommendations ──────────────────────────────────────────────────────────

/** Drop a Venture's open recommendations (before regeneration). */
export function deleteOpenRecommendations(ventureId) {
  return db.execute({ sql: "DELETE FROM investment_recommendations WHERE venture_id=? AND is_completed=FALSE", args: [ventureId] });
}

/** A published knowledge resource whose tags match a term. */
export function selectResourceIdByTag(term) {
  return db.execute({ sql: "SELECT id FROM knowledge_resources WHERE tags::text ILIKE ? AND status='published' LIMIT 1", args: [term] });
}

/** Insert one recommendation. */
export function insertRecommendation({
  ventureId, assessmentId, category, priority, title, description, estimatedEffort, expectedImpact, resourceId,
}) {
  return db.execute({
    sql: `INSERT INTO investment_recommendations (venture_id, assessment_id, category, priority, title, description, estimated_effort, expected_impact, resource_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [ventureId, assessmentId, category, priority, title, description, estimatedEffort, expectedImpact, resourceId],
  });
}

/** A Venture's open recommendations, priority first. */
export function selectOpenRecommendations(ventureId) {
  return db.execute({
    sql: `SELECT * FROM investment_recommendations WHERE venture_id=? AND is_completed=FALSE ORDER BY
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC`,
    args: [ventureId],
  });
}

/** A Venture's open recommendations with their resource title, priority first. */
export function selectInvestmentRecommendations(ventureId) {
  return db.execute({
    sql: `SELECT ir.*, kr.title as resource_title FROM investment_recommendations ir
          LEFT JOIN knowledge_resources kr ON ir.resource_id = kr.id
          WHERE ir.venture_id=? AND ir.is_completed=FALSE
          ORDER BY CASE ir.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, ir.created_at DESC`,
    args: [ventureId],
  });
}
