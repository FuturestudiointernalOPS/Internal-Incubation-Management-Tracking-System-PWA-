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

/** Milestone statuses across the owner values (archived milestones excluded). */
export function selectReadinessMilestoneStatuses(ownersSql, args) {
  return db.execute({
    sql: `SELECT status FROM venture_milestones WHERE venture_id::text ${ownersSql} AND COALESCE(is_archived, FALSE) = FALSE`,
    args,
  });
}

/** Task statuses across the owner values (archived tasks excluded). */
export function selectReadinessTaskStatuses(ownersSql, args) {
  return db.execute({
    sql: `SELECT status FROM venture_tasks WHERE venture_id::text ${ownersSql} AND COALESCE(is_archived, FALSE) = FALSE`,
    args,
  });
}

/**
 * Submission states (status + review decision) across the owner values.
 *
 * ONE ROW PER TASK — the LATEST version. Without this, a task submitted three
 * times contributed three rows, so re-submitting work inflated the denominator
 * of the deliverables component instead of describing the task.
 */
export function selectReadinessSubmissionStates(ownersSql, args) {
  return db.execute({
    sql: `SELECT s.status, s.review_decision
            FROM venture_task_submissions s
            JOIN venture_tasks t ON t.id = s.task_id
            WHERE t.venture_id::text ${ownersSql}
              AND COALESCE(t.is_archived, FALSE) = FALSE
              AND s.version = (
                SELECT MAX(s2.version) FROM venture_task_submissions s2
                 WHERE s2.task_id = s.task_id
              )`,
    args,
  });
}

/**
 * The Venture's own deliverables (the journey's evidence items), each with the
 * status of the task it is linked to. A deliverable is what the Venture submits
 * and the manager approves; the linked task is not updated by that approval, so
 * the roadmap reads the deliverable itself.
 */
export function selectReadinessDeliverableStates(ownersSql, args) {
  return db.execute({
    sql: `SELECT d.status, d.approval_status, t.status AS task_status
            FROM venture_deliverables d
            LEFT JOIN venture_tasks t ON t.id = d.task_id
            WHERE d.venture_id::text ${ownersSql}`,
    args,
  });
}

/**
 * Every live milestone with its journey stage and its deliverable counts: the
 * raw material for PARTIAL progress (a milestone with 3 of 5 deliverables
 * approved is 60% done, not 0% until the whole milestone is closed).
 */
export function selectReadinessMilestoneGraph(ownersSql, args) {
  return db.execute({
    sql: `SELECT m.id::text AS milestone_id, m.journey_stage_id::text AS stage_id, m.status,
                 COUNT(d.id) AS total,
                 COUNT(d.id) FILTER (WHERE d.approval_status = 'approved') AS approved
            FROM venture_milestones m
            LEFT JOIN venture_deliverables d ON d.milestone_id = m.id
            WHERE m.venture_id::text ${ownersSql} AND COALESCE(m.is_archived, FALSE) = FALSE
            GROUP BY m.id, m.journey_stage_id, m.status`,
    args,
  });
}

/** Live Journey stages with their ids (to match them with their milestones). */
export function selectReadinessStageGraph(dbId) {
  return db.execute({
    sql: `SELECT id::text AS id, status FROM venture_journey_stages
            WHERE venture_id = ? AND COALESCE(is_archived, FALSE) = FALSE`,
    args: [dbId],
  });
}
