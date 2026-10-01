/**
 * Venture project timeline, progress and dependencies — statements
 * (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/timeline`: the progress counts
 * (milestones, tasks, deliverables), the timeline row reads, the overdue /
 * delayed / upcoming reads, and the dependency graph read and writes.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Progress counts ──────────────────────────────────────────────────────────

/** Milestone totals (total / done / delayed / cancelled) of a Venture. */
export function selectMilestoneProgressCounts(ventureId) {
  return db.execute({
    sql: `SELECT COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as done,
       SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM venture_milestones WHERE venture_id = ?`,
    args: [ventureId],
  });
}

/** Task totals (total / done / blocked) of a Venture. */
export function selectTaskProgressCounts(ventureId) {
  return db.execute({
    sql: `SELECT COUNT(*) as total,
       SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
       SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
       FROM venture_tasks WHERE venture_id = ?`,
    args: [ventureId],
  });
}

/** Deliverable totals (total / done) of a Venture. */
export function selectDeliverableProgressCounts(ventureId) {
  return db.execute({
    sql: `SELECT COUNT(*) as total,
       SUM(CASE WHEN status IN ('approved','completed') THEN 1 ELSE 0 END) as done
       FROM venture_deliverables WHERE venture_id = ?`,
    args: [ventureId],
  });
}

// ── Timeline rows ────────────────────────────────────────────────────────────

/** Milestones as timeline rows, display order. */
export function selectTimelineMilestones(ventureId) {
  return db.execute({
    sql: `SELECT id, title, status, progress, target_date, created_at FROM venture_milestones WHERE venture_id = ? ORDER BY display_order ASC, created_at ASC`,
    args: [ventureId],
  });
}

/** Tasks as timeline rows, creation order. */
export function selectTimelineTasks(ventureId) {
  return db.execute({
    sql: `SELECT id, title, status, milestone_id, due_date, created_at FROM venture_tasks WHERE venture_id = ? ORDER BY created_at ASC`,
    args: [ventureId],
  });
}

/** Deliverables as timeline rows, creation order. */
export function selectTimelineDeliverables(ventureId) {
  return db.execute({
    sql: `SELECT vd.id, vd.title, vd.status, vd.milestone_id, vd.due_date, vd.created_at FROM venture_deliverables vd WHERE vd.venture_id = ? ORDER BY vd.created_at ASC`,
    args: [ventureId],
  });
}

/** Every dependency row of a Venture. */
export function selectTimelineDependencies(ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_dependencies WHERE venture_id = ?",
    args: [ventureId],
  });
}

// ── Delay reads ──────────────────────────────────────────────────────────────

/** A Venture's overdue tasks. */
export function selectOverdueTasks(ventureId) {
  return db.execute({
    sql: `SELECT id, title, status, due_date FROM venture_tasks WHERE venture_id = ? AND due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('done', 'cancelled') ORDER BY due_date ASC`,
    args: [ventureId],
  });
}

/** A Venture's milestones past their target date (`due_date` alias kept). */
export function selectDelayedMilestones(ventureId) {
  return db.execute({
    sql: `SELECT id, title, status, target_date AS due_date FROM venture_milestones WHERE venture_id = ? AND target_date IS NOT NULL AND target_date < NOW() AND status NOT IN ('completed', 'cancelled') ORDER BY target_date ASC`,
    args: [ventureId],
  });
}

/** A Venture's deadlines in the next 7 days (tasks then milestones). */
export function selectUpcomingDeadlines(ventureId) {
  return db.execute({
    sql: `SELECT id, title, 'task' as type, due_date FROM venture_tasks WHERE venture_id = ? AND due_date IS NOT NULL AND due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND status NOT IN ('done', 'cancelled') UNION ALL
          SELECT id, title, 'milestone' as type, target_date AS due_date FROM venture_milestones WHERE venture_id = ? AND target_date IS NOT NULL AND target_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND status NOT IN ('completed', 'cancelled') ORDER BY target_date ASC`,
    args: [ventureId, ventureId],
  });
}

// ── Dependency writes ────────────────────────────────────────────────────────

/** The dependency graph of a Venture (source→target, text ids). */
export function selectDependencyGraph(ventureId) {
  return db.execute({
    sql: "SELECT source_type, source_id, target_type, target_id FROM venture_dependencies WHERE venture_id::text = ?::text",
    args: [String(ventureId)],
  });
}

/** Insert one dependency edge (idempotent). */
export function insertDependencyEdge(ventureId, sourceType, sourceId, targetType, targetId) {
  return db.execute({
    sql: `INSERT INTO venture_dependencies (venture_id, source_type, source_id, target_type, target_id)
          VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    args: [ventureId, sourceType, sourceId, targetType, targetId],
  });
}

/** Delete one dependency scoped by a caller-built venture-id predicate. */
export function deleteDependencyScoped(dependencyId, scopeSql, scopedIds) {
  return db.execute({
    sql: `DELETE FROM venture_dependencies WHERE id::text = ?::text AND (${scopeSql})`,
    args: [String(dependencyId), ...scopedIds],
  });
}
