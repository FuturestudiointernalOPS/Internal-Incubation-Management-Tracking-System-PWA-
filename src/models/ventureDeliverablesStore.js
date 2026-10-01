/**
 * Venture milestones and deliverables — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/deliverables`: the milestone row,
 * the deliverables of a milestone (with their review count), the deliverable
 * row, the review write, the dynamic deliverable UPDATE and the milestone
 * progress recount.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Milestones ───────────────────────────────────────────────────────────────

/** One milestone row. */
export function selectMilestoneById(milestoneId) {
  return db.execute({ sql: "SELECT * FROM venture_milestones WHERE id = ?", args: [milestoneId] });
}

/** The deliverable counts (total, done) of a milestone. */
export function selectDeliverableCountsByMilestone(milestoneId) {
  return db.execute({
    sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status IN ('approved','completed') THEN 1 ELSE 0 END) as d FROM venture_deliverables WHERE milestone_id = ?",
    args: [milestoneId],
  });
}

/** Write a milestone's recomputed progress. */
export function updateMilestoneProgress(milestoneId, progress) {
  return db.execute({ sql: "UPDATE venture_milestones SET progress = ?, updated_at = NOW() WHERE id = ?", args: [progress, milestoneId] });
}

// ── Deliverables ─────────────────────────────────────────────────────────────

/** The deliverables of a milestone, oldest first, with their review count. */
export function selectDeliverablesByMilestone(milestoneId) {
  return db.execute({
    sql: `SELECT vd.*, (SELECT COUNT(*) FROM venture_deliverable_reviews vdr WHERE vdr.deliverable_id = vd.id) as review_count
          FROM venture_deliverables vd WHERE vd.milestone_id = ? ORDER BY vd.created_at ASC`,
    args: [milestoneId],
  });
}

/** One deliverable row. */
export function selectDeliverableById(deliverableId) {
  return db.execute({ sql: "SELECT * FROM venture_deliverables WHERE id = ?", args: [deliverableId] });
}

/** Insert one deliverable, returning its id. */
export function insertDeliverable({
  milestoneId, ventureId, title, description, deliverableType, dueDate, assignedCid, assignedName, createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO venture_deliverables (milestone_id, venture_id, title, description, deliverable_type, due_date, assigned_cid, assigned_name, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [milestoneId, ventureId, title, description, deliverableType, dueDate, assignedCid, assignedName, createdBy],
  });
}

/** Apply a computed SET list to a deliverable. */
export function updateDeliverableColumns(sets, args) {
  return db.execute({ sql: `UPDATE venture_deliverables SET ${sets.join(", ")} WHERE id = ?`, args });
}

/** Record a deliverable review decision. */
export function insertDeliverableReview(deliverableId, reviewerCid, reviewerName, decision, rejectionReason) {
  return db.execute({
    sql: `INSERT INTO venture_deliverable_reviews (deliverable_id, reviewer_cid, reviewer_name, decision, comments)
          VALUES (?, ?, ?, ?, ?)`,
    args: [deliverableId, reviewerCid, reviewerName, decision, rejectionReason],
  });
}
