/**
 * Venture tasks, dependencies, comments and attachments — statements
 * (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/tasks`: the task list and row,
 * the task-to-task dependency graph (read and, inside a transaction, the
 * replace), the block-state release, and the comment / attachment reads and
 * writes.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Transaction control ──────────────────────────────────────────────────────

/** Run the dependency-graph replace inside one transaction. */
export function runInTransaction(fn) {
  return db.transaction(fn);
}

// ── Tasks ────────────────────────────────────────────────────────────────────

/** A Venture's tasks (optional milestone / status / assignee filters), ordered. */
export function selectTasks(ventureId, milestoneId, status, assignedCid) {
  let sql = `SELECT vt.*, pt.title AS parent_title FROM venture_tasks vt LEFT JOIN venture_tasks pt ON vt.parent_task_id = pt.id WHERE vt.venture_id = ?`;
  const args = [ventureId];
  if (milestoneId) { sql += " AND vt.milestone_id = ?"; args.push(milestoneId); }
  if (status) { sql += " AND vt.status = ?"; args.push(status); }
  if (assignedCid) { sql += " AND vt.assigned_cid = ?"; args.push(assignedCid); }
  sql += " ORDER BY vt.display_order ASC, vt.created_at DESC";
  return db.execute({ sql, args });
}

/** One task row. */
export function selectTaskById(taskId) {
  return db.execute({ sql: "SELECT * FROM venture_tasks WHERE id = ?", args: [taskId] });
}

/** One task's id + status (used by the block-state sync). */
export function selectTaskStatusById(taskId) {
  return db.execute({ sql: "SELECT id, status FROM venture_tasks WHERE id = ?", args: [taskId] });
}

/** The next display order for a Venture's tasks. */
export function selectNextTaskDisplayOrder(ventureId) {
  return db.execute({ sql: "SELECT COALESCE(MAX(display_order), 0) + 1 as n FROM venture_tasks WHERE venture_id = ?", args: [ventureId] });
}

/** Insert one task, returning its id. */
export function insertTask({
  ventureId, milestoneId, title, description, priority, startDate, dueDate,
  estimatedHours, assignedCid, assignedName, reporterCid, reporterName,
  labelsJson, displayOrder, parentTaskId,
}) {
  return db.execute({
    sql: `INSERT INTO venture_tasks (venture_id, milestone_id, title, description, priority, start_date, due_date, estimated_hours, assigned_cid, assigned_name, reporter_cid, reporter_name, labels, display_order, parent_task_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id`,
    args: [ventureId, milestoneId, title, description, priority, startDate, dueDate, estimatedHours, assignedCid, assignedName, reporterCid, reporterName, labelsJson, displayOrder, parentTaskId],
  });
}

/** Apply a computed SET list to a task. */
export function updateTaskColumns(sets, args) {
  return db.execute({ sql: `UPDATE venture_tasks SET ${sets.join(", ")} WHERE id = ?`, args });
}

/** Delete one task. */
export function deleteTaskRow(taskId) {
  return db.execute({ sql: "DELETE FROM venture_tasks WHERE id = ?", args: [taskId] });
}

// ── Task-to-task dependency graph ────────────────────────────────────────────

/** Every dependency row of a Venture (all types), source→target. */
export function selectVentureDependencies(ventureId) {
  return db.execute({
    sql: "SELECT source_type, source_id, target_type, target_id FROM venture_dependencies WHERE venture_id::text = ?::text",
    args: [String(ventureId)],
  });
}

/** Every task→task edge of a Venture. */
export function selectVentureTaskEdges(ventureId) {
  return db.execute({
    sql: `SELECT source_id, target_id FROM venture_dependencies
          WHERE venture_id::text = ?::text AND source_type = 'task' AND target_type = 'task'`,
    args: [String(ventureId)],
  });
}

/** The not-yet-done blockers of a task (`doneSqlList` is a quoted status list). */
export function selectUnmetTaskDependencies(ventureId, taskId, doneSqlList) {
  return db.execute({
    sql: `SELECT blocker.id, blocker.title, blocker.status
          FROM venture_dependencies d
          JOIN venture_tasks blocker ON CAST(blocker.id AS TEXT) = d.source_id
          WHERE d.venture_id::text = ?::text
            AND d.target_type = 'task' AND d.target_id = ?
            AND d.source_type = 'task'
            AND blocker.status NOT IN (${doneSqlList})`,
    args: [String(ventureId), String(taskId)],
  });
}

/** How many tasks declare this task as their blocker. */
export function countTaskBlockersRows(ventureId, taskId) {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS n FROM venture_dependencies
          WHERE venture_id::text = ?::text AND source_type = 'task' AND target_type = 'task' AND target_id = ?`,
    args: [String(ventureId), String(taskId)],
  });
}

/** The distinct task ids this task blocks. */
export function selectTasksBlockedByRows(ventureId, blockerTaskId) {
  return db.execute({
    sql: `SELECT DISTINCT target_id FROM venture_dependencies
          WHERE venture_id::text = ?::text AND source_type = 'task' AND source_id = ? AND target_type = 'task'`,
    args: [String(ventureId), String(blockerTaskId)],
  });
}

/** Delete a task's inbound task edges (transaction runner). */
export function deleteTaskDependencyEdges(query, ventureId, targetId) {
  return query(
    `DELETE FROM venture_dependencies
     WHERE venture_id::text = ?::text AND source_type = 'task' AND target_type = 'task' AND target_id = ?`,
    [String(ventureId), targetId],
  );
}

/** Insert one task→task edge (transaction runner). */
export function insertTaskDependencyEdge(query, ventureId, sourceId, targetId) {
  return query(
    `INSERT INTO venture_dependencies (venture_id, source_type, source_id, target_type, target_id)
     VALUES (?, 'task', ?, 'task', ?) ON CONFLICT DO NOTHING`,
    [ventureId, sourceId, targetId],
  );
}

/** Return a dependency-held blocked task to `todo`. */
export function releaseBlockedTaskRow(taskId) {
  return db.execute({
    sql: "UPDATE venture_tasks SET status = 'todo', updated_at = NOW() WHERE id = ? AND status = 'blocked' RETURNING id",
    args: [taskId],
  });
}

// ── Task comments ────────────────────────────────────────────────────────────

/** A task's live comments, oldest first. */
export function selectTaskComments(taskId) {
  return db.execute({
    sql: "SELECT * FROM venture_task_comments WHERE task_id = ? AND is_deleted = FALSE ORDER BY created_at ASC",
    args: [taskId],
  });
}

/** Insert one comment, returning its id. */
export function insertTaskComment(taskId, parentId, authorCid, authorName, body) {
  return db.execute({
    sql: `INSERT INTO venture_task_comments (task_id, parent_id, author_cid, author_name, body) VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [taskId, parentId, authorCid, authorName, body],
  });
}

/** Soft-delete a comment scoped through the Venture's tasks. */
export function softDeleteTaskComment(commentId, ventureId) {
  return db.execute({
    sql: `UPDATE venture_task_comments SET is_deleted = TRUE, updated_at = NOW()
          WHERE id = ? AND task_id IN (SELECT id FROM venture_tasks WHERE venture_id = ?)`,
    args: [commentId, ventureId],
  });
}

// ── Task attachments ─────────────────────────────────────────────────────────

/** A task's attachments, newest first. */
export function selectTaskAttachments(taskId) {
  return db.execute({ sql: "SELECT * FROM venture_task_attachments WHERE task_id = ? ORDER BY uploaded_at DESC", args: [taskId] });
}

/** Insert one attachment, returning its id. */
export function insertTaskAttachment(taskId, fileName, fileSize, fileType, fileUrl, uploadedBy) {
  return db.execute({
    sql: `INSERT INTO venture_task_attachments (task_id, file_name, file_size, file_type, file_url, uploaded_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [taskId, fileName, fileSize, fileType, fileUrl, uploadedBy],
  });
}

/** Delete an attachment scoped through the Venture's tasks. */
export function deleteTaskAttachmentRow(attachmentId, ventureId) {
  return db.execute({
    sql: `DELETE FROM venture_task_attachments
          WHERE id = ? AND task_id IN (SELECT id FROM venture_tasks WHERE venture_id = ?)`,
    args: [attachmentId, ventureId],
  });
}
