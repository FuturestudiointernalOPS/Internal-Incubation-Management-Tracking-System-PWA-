import db from "@/lib/db";

/**
 * Venture Journey model — PMF and customer interviews (REPOSITORY layer).
 *
 * The product-market-fit and customer-interview create/read statements behind
 * `/api/ventures/[id]/pmf` and `/api/ventures/[id]/interviews`. Split verbatim
 * out of `models/ventureJourney.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getPmfVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** All PMF assessments for a venture, newest first. */
export async function getPmfAssessments(ventureId) {
  return db.execute({
    sql: `SELECT * FROM venture_pmf_assessments WHERE venture_id = ? ORDER BY created_at DESC`,
    args: [ventureId],
  });
}

/** Create a PMF assessment for a venture. */
export async function createPmfAssessment(ventureId, customerFeedback, improvements, pmfProgress, createdBy) {
  return db.execute({
    sql: `INSERT INTO venture_pmf_assessments (venture_id, customer_feedback, improvements, pmf_progress, created_by)
            VALUES (?, ?, ?, ?, ?)`,
    args: [ventureId, customerFeedback, improvements, pmfProgress, createdBy],
  });
}

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getInterviewsVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** All customer interviews for a venture, newest first. */
export async function getCustomerInterviews(ventureId) {
  return db.execute({
    sql: `SELECT * FROM venture_customer_interviews WHERE venture_id = ? ORDER BY created_at DESC`,
    args: [ventureId],
  });
}

/** Create a customer interview for a venture. */
export async function createCustomerInterview(ventureId, customerSegment, intervieweeName, interviewDate, notes, insights, createdBy) {
  return db.execute({
    sql: `INSERT INTO venture_customer_interviews (venture_id, customer_segment, interviewee_name, interview_date, notes, insights, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [ventureId, customerSegment, intervieweeName, interviewDate, notes, insights, createdBy],
  });
}
