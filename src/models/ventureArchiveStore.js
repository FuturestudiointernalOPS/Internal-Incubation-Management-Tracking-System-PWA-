/**
 * Venture milestone / task archive — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/archive`: the filed-work probes
 * and the soft-delete/restore writes on `venture_tasks` and `venture_milestones`.
 * The decisions (archive/restore/blocked classification, and the cascade from a
 * milestone to its tasks) live in the service.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventureArchive.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Filed-work probes ────────────────────────────────────────────────────────

/** A task's first submission, if any (filed-work check). */
export function selectTaskSubmissionProbe(taskId) {
  return db.execute({
    sql: `SELECT 1 FROM venture_task_submissions WHERE task_id = ? LIMIT 1`,
    args: [String(taskId)],
  });
}

/** A task's first staff review, if any (filed-work check). */
export function selectTaskReviewProbe(taskId) {
  return db.execute({
    sql: `SELECT 1 FROM venture_task_reviews WHERE task_id = ? LIMIT 1`,
    args: [String(taskId)],
  });
}

/**
 * A milestone's first deliverable that has been WORKED ON, if any (filed-work
 * check).
 *
 * A deliverable ROW is not evidence: a tracker import creates one pristine row
 * per tracker line. Counting rows made every imported journey permanently
 * undeletable even though nobody had filed anything, so the probe asks for
 * engagement instead — the deliverable left its initial state, carries an
 * evidence attachment, or was reviewed. An untouched import row is plan
 * structure, and a permanent delete removes it with the rest of the plan.
 */
export function selectMilestoneDeliverableProbe(milestoneId) {
  return db.execute({
    sql: `SELECT 1 FROM venture_deliverables d
           WHERE d.milestone_id = ?
             AND (
               COALESCE(d.status, 'pending') NOT IN ('pending', 'not_started')
               OR COALESCE(d.approval_status, '') NOT IN ('', 'pending')
               OR NULLIF(TRIM(d.attachment_url), '') IS NOT NULL
               OR NULLIF(TRIM(d.reviewer_name), '') IS NOT NULL
               OR NULLIF(TRIM(d.rejection_reason), '') IS NOT NULL
               OR EXISTS (SELECT 1 FROM venture_deliverable_reviews r WHERE r.deliverable_id = d.id)
             )
           LIMIT 1`,
    args: [String(milestoneId)],
  });
}

/** A milestone's first task submission, if any (filed-work check). */
export function selectMilestoneSubmissionProbe(milestoneId) {
  return db.execute({
    sql: `SELECT 1 FROM venture_task_submissions s
            JOIN venture_tasks t ON t.id = s.task_id
            WHERE t.milestone_id = ? LIMIT 1`,
    args: [String(milestoneId)],
  });
}

/** A milestone's first task review, if any (filed-work check). */
export function selectMilestoneReviewProbe(milestoneId) {
  return db.execute({
    sql: `SELECT 1 FROM venture_task_reviews vr
            JOIN venture_tasks t ON t.id = vr.task_id
            WHERE t.milestone_id = ? LIMIT 1`,
    args: [String(milestoneId)],
  });
}

// ── Soft delete / restore ────────────────────────────────────────────────────

/** Archive one task (soft delete). */
export function archiveTaskRow(actorCid, taskId) {
  return db.execute({
    sql: "UPDATE venture_tasks SET is_archived = TRUE, archived_at = COALESCE(archived_at, NOW()), archived_by = COALESCE(archived_by, ?) WHERE id = ? AND (is_archived = FALSE OR is_archived IS NULL)",
    args: [actorCid, String(taskId)],
  });
}

/** Restore one archived task. */
export function restoreTaskRow(taskId) {
  return db.execute({
    sql: "UPDATE venture_tasks SET is_archived = FALSE, archived_at = NULL, archived_by = NULL WHERE id = ?",
    args: [String(taskId)],
  });
}

/** Archive one milestone (soft delete). */
export function archiveMilestoneRow(actorCid, milestoneId) {
  return db.execute({
    sql: "UPDATE venture_milestones SET is_archived = TRUE, archived_at = COALESCE(archived_at, NOW()), archived_by = COALESCE(archived_by, ?) WHERE id = ? AND (is_archived = FALSE OR is_archived IS NULL)",
    args: [actorCid, String(milestoneId)],
  });
}

/** Restore one archived milestone. */
export function restoreMilestoneRow(milestoneId) {
  return db.execute({
    sql: "UPDATE venture_milestones SET is_archived = FALSE, archived_at = NULL, archived_by = NULL WHERE id = ?",
    args: [String(milestoneId)],
  });
}

/** Restore every archived task of a milestone. */
export function restoreMilestoneTasks(milestoneId) {
  return db.execute({
    sql: "UPDATE venture_tasks SET is_archived = FALSE, archived_at = NULL, archived_by = NULL WHERE milestone_id = ?",
    args: [String(milestoneId)],
  });
}

/** The still-live tasks of a milestone (cascade input). */
export function selectActiveTaskIdsForMilestone(milestoneId) {
  return db.execute({
    sql: "SELECT id FROM venture_tasks WHERE milestone_id = ? AND (is_archived = FALSE OR is_archived IS NULL)",
    args: [String(milestoneId)],
  });
}
