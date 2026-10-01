/**
 * Venture OS duplication — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/duplication`: the source-row
 * reads and the fresh-row inserts for a duplicated Journey stage, milestone or
 * task. The decisions — what a copy resets, the stage re-serialisation order,
 * the subtask re-parenting and the counters — live in the service.
 *
 * The statements that run INSIDE a transaction take the transaction's `query`
 * runner as their first argument, so the service owns the transaction boundary
 * while every statement stays here.
 *
 * SQL is byte-identical to what used to sit inline in
 * `src/lib/ventureDuplication.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Transaction control ──────────────────────────────────────────────────────

/** Run a duplication (stage re-order + copies) inside one transaction. */
export function runInTransaction(fn) {
  return db.transaction(fn);
}

// ── Source reads (no transaction) ────────────────────────────────────────────

/** The source Journey stage, scoped to its Venture. */
export function selectJourneyStageForDuplication(stageId, dbId) {
  return db.execute({
    sql: "SELECT * FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
    args: [stageId, dbId],
  });
}

/** The source milestone, matched on either accepted owner value. */
export function selectMilestoneForDuplication(milestoneId, owners) {
  const placeholders = owners.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT * FROM venture_milestones WHERE id = ? AND venture_id IN (${placeholders})`,
    args: [milestoneId, ...owners],
  });
}

/** The source task, matched on either accepted owner value. */
export function selectTaskForDuplication(taskId, owners) {
  const placeholders = owners.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT * FROM venture_tasks WHERE id = ? AND venture_id IN (${placeholders})`,
    args: [taskId, ...owners],
  });
}

/** Insert one standalone task copy (no parent — the duplicate path). */
export function insertDuplicatedTaskRow({ ventureId, milestoneId, title, description, priority, dueDate, estimatedHours, actorCid, labelsJson, checklistJson, displayOrder, reviewRequired, requiredDeliverableType }) {
  return db.execute({
    sql: `INSERT INTO venture_tasks
       (venture_id, milestone_id, title, description, status, priority,
        due_date, estimated_hours, assigned_cid, assigned_name, reporter_cid,
        reporter_name, labels, checklist, display_order, parent_task_id,
        review_required, required_deliverable_type)
     VALUES (?, ?, ?, ?, 'backlog', ?, ?, ?, NULL, NULL, ?, NULL, ?::jsonb, ?::jsonb, ?, NULL, ?, ?)
     RETURNING id`,
    args: [
      ventureId, milestoneId, title, description, priority, dueDate, estimatedHours, actorCid,
      labelsJson, checklistJson, displayOrder, reviewRequired, requiredDeliverableType,
    ],
  });
}

// ── Transaction statements (query runner first) ──────────────────────────────

/** The ordered stages of a Venture (insert-after-source input). */
export function selectJourneyStageOrdersForDuplication(query, dbId) {
  return query(
    "SELECT id, stage_order FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
    [dbId],
  );
}

/** Write one stage's order (negative parking and the final 1..n pass). */
export function setJourneyStageOrderForDuplication(query, stageOrder, stageId) {
  return query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [stageOrder, stageId]);
}

/** Insert the duplicated Journey stage (always 'upcoming'). */
export function insertJourneyStageCopyRow(query, { id, ventureId, name, description, objective, targetDate, stageOrder }) {
  return query(
    `INSERT INTO venture_journey_stages (id, venture_id, name, description, objective, target_date, stage_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'upcoming')`,
    [id, ventureId, name, description, objective, targetDate, stageOrder],
  );
}

/** The milestones bound to a stage (copy input). */
export function selectMilestonesForStageDuplication(query, stageId) {
  return query("SELECT * FROM venture_milestones WHERE journey_stage_id = ?", [stageId]);
}

/** Insert one milestone copy (status/progress supplied by the service). */
export function insertMilestoneCopyRow(query, { id, ventureId, title, description, objective, targetDate, startDate, status, priority, ownerCid, displayOrder, journeyStageId, createdBy }) {
  return query(
    `INSERT INTO venture_milestones
       (id, venture_id, title, description, objective, target_date, start_date,
        status, progress, priority, owner_cid, display_order, journey_stage_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [id, ventureId, title, description, objective, targetDate, startDate, status, priority, ownerCid, displayOrder, journeyStageId, createdBy],
  );
}

/** The tasks of a milestone — top-level first so re-parenting resolves. */
export function selectTasksForMilestoneDuplication(query, sourceMilestoneId) {
  return query(
    `SELECT * FROM venture_tasks
     WHERE milestone_id = ?
     ORDER BY (parent_task_id IS NULL) DESC, id ASC`,
    [sourceMilestoneId],
  );
}

/** Insert one copied task, re-parented through the service's task-id map. */
export function insertCopiedTaskWithParent(query, { ventureId, milestoneId, title, description, priority, dueDate, estimatedHours, actorCid, labelsJson, checklistJson, displayOrder, parentTaskId, reviewRequired, requiredDeliverableType }) {
  return query(
    `INSERT INTO venture_tasks
       (venture_id, milestone_id, title, description, status, priority,
        due_date, estimated_hours, assigned_cid, assigned_name, reporter_cid,
        reporter_name, labels, checklist, display_order, parent_task_id,
        review_required, required_deliverable_type)
     VALUES (?, ?, ?, ?, 'backlog', ?, ?, ?, NULL, NULL, ?, NULL, ?::jsonb, ?::jsonb, ?, ?, ?, ?)
     RETURNING id`,
    [
      ventureId, milestoneId, title, description, priority, dueDate, estimatedHours, actorCid,
      labelsJson, checklistJson, displayOrder, parentTaskId, reviewRequired, requiredDeliverableType,
    ],
  );
}
