import db from "@/lib/db";

/**
 * Facilitation model — facilitator reviews (REPOSITORY layer).
 *
 * The structured-review statements: filtered listing, the additive-column
 * self-heal, the respond-to-changes lookup/reset, review creation and the PM
 * decision path. Split verbatim out of `models/facilitation.js` — see
 * docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Review rows filtered by program/facilitator/week, newest first; optionally restricted to one facilitator's own reviews. */
export async function listFacilitatorReviews(filters) {
  const { programId, facilitatorId, weekNumber, onlyOwn, ownCid } = filters;
  let sql = "SELECT * FROM program_facilitator_reviews WHERE 1=1";
  const args = [];

  if (programId) {
    sql += " AND CAST(program_id AS TEXT) = ?";
    args.push(String(programId));
  }
  if (facilitatorId) {
    sql += " AND facilitator_id = ?";
    args.push(facilitatorId);
  }
  if (weekNumber) {
    sql += " AND week_number = ?";
    args.push(parseInt(weekNumber));
  }

  // Non-management roles may only read their own reviews
  if (onlyOwn) {
    sql += " AND facilitator_id = ?";
    args.push(ownCid);
  }

  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/** Idempotent add of one structured-review column (the route loops it over the column list). */
export async function ensureFacilitatorReviewColumn(col) {
  return db.execute(
    `ALTER TABLE program_facilitator_reviews ADD COLUMN IF NOT EXISTS ${col}`,
  );
}

/** Most recent review for a program/week still awaiting PM changes (respond-to-changes path). */
export async function findChangesRequestedReview(programId, facilitatorCid, weekNumber) {
  return db.execute({
    sql: `SELECT id FROM program_facilitator_reviews
              WHERE CAST(program_id AS TEXT) = ?
                AND facilitator_id = ?
                AND week_number = ?
                AND pm_decision = 'changes_requested'
              ORDER BY created_at DESC LIMIT 1`,
    args: [String(programId), facilitatorCid, weekNumber],
  });
}

/** Reset an existing review's fields for resubmission (clears the PM decision). */
export async function resetReviewForResubmission(reviewId, values) {
  return db.execute({
    sql: `UPDATE program_facilitator_reviews SET
                  participant_progress = ?, attendance_concerns = ?, assignment_performance = ?,
                  challenges = ?, participants_needing_intervention = ?, completed_work = ?,
                  needs_attention = ?, recommendations = ?,
                  overall_rating = ?, went_well = ?, struggles = ?, engagement = ?,
                  needs_attention_type = ?, needs_attention_note = ?, focus_next_week = ?,
                  additional_notes = ?, status = 'submitted',
                  pm_decision = NULL, pm_decision_note = NULL, pm_decision_by = NULL, pm_decision_at = NULL,
                  updated_at = NOW()
                WHERE id = ?`,
    args: [...values, reviewId],
  });
}

/** Create a facilitator review row, returning its id. */
export async function createFacilitatorReview(review) {
  return db.execute({
    sql: `INSERT INTO program_facilitator_reviews (
        program_id, facilitator_id, facilitator_name, week_number,
        participant_progress, attendance_concerns, assignment_performance,
        challenges, participants_needing_intervention, completed_work,
        needs_attention, recommendations,
        overall_rating, went_well, struggles, engagement,
        needs_attention_type, needs_attention_note, focus_next_week,
        additional_notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted') RETURNING id`,
    args: [
      review.program_id,
      review.facilitatorCid,
      review.facilitatorName,
      review.weekNumber,
      ...review.values,
    ],
  });
}

/** Review row's program id (used to gate PM decisions on program ownership). */
export async function getReviewProgramId(id) {
  return db.execute({
    sql: "SELECT program_id FROM program_facilitator_reviews WHERE id = ?",
    args: [id],
  });
}

/** Program row's assigned_pm_id (ownership check before a PM decision). */
export async function getProgramAssignedPmId(progId) {
  return db.execute({
    sql: "SELECT assigned_pm_id FROM v2_programs WHERE id = ?",
    args: [progId],
  });
}

/** Record a PM decision/action on a review row. */
export async function decideFacilitatorReview(review) {
  return db.execute({
    sql: `UPDATE program_facilitator_reviews SET
              pm_decision = ?,
              pm_decision_note = ?,
              pm_decision_by = ?,
              pm_decision_at = NOW(),
              status = 'decided',
              updated_at = NOW()
            WHERE id = ?`,
    args: [
      review.pm_decision || null,
      review.pm_decision_note || null,
      review.decidedBy || null,
      review.id,
    ],
  });
}
