/**
 * Venture roadmap readiness — statements (REPOSITORY layer).
 *
 * The four reads behind `@/services/ventures/readiness`: the Journey stages, the
 * milestones, the tasks and the reviewed submissions of a Venture, each returning
 * the status columns the scoring needs. The weighting and the counts live in the
 * service.
 *
 * The three owner-scoped reads take the `IN (…)` clause the service built (the
 * owners may be the VNT code, the internal id, or both).
 *
 * SQL is byte-identical to what used to sit inline in
 * `src/lib/ventureReadiness.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** Live Journey stages of a Venture (archive column present). */
export function selectReadinessStageStatuses(dbId) {
  return db.execute({
    sql: `SELECT status FROM venture_journey_stages WHERE venture_id = ? AND COALESCE(is_archived, FALSE) = FALSE`,
    args: [dbId],
  });
}

/** Journey stages of a Venture, without the archive filter (fallback). */
export function selectReadinessStageStatusesPlain(dbId) {
  return db.execute({
    sql: `SELECT status FROM venture_journey_stages WHERE venture_id = ?`,
    args: [dbId],
  });
}

/** Milestone statuses across the owner values. */
export function selectReadinessMilestoneStatuses(ownersSql, args) {
  return db.execute({
    sql: `SELECT status FROM venture_milestones WHERE venture_id ${ownersSql}`,
    args,
  });
}

/** Task statuses across the owner values. */
export function selectReadinessTaskStatuses(ownersSql, args) {
  return db.execute({
    sql: `SELECT status FROM venture_tasks WHERE venture_id ${ownersSql}`,
    args,
  });
}

/** Submission states (status + review decision) across the owner values. */
export function selectReadinessSubmissionStates(ownersSql, args) {
  return db.execute({
    sql: `SELECT s.status, s.review_decision
            FROM venture_task_submissions s
            JOIN venture_tasks t ON t.id = s.task_id
            WHERE t.venture_id ${ownersSql}`,
    args,
  });
}
