import db from "@/lib/db";

/**
 * Tasks model — lookups and related reads (REPOSITORY layer).
 *
 * Task rows, their sub-tasks, blockers, resources and comment counts, split
 * verbatim out of `models/tasks.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Full row by primary key */
export async function getTaskById(id) {
  const result = await db.execute({
    sql: "SELECT * FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
  return result.rows[0] || null;
}

/** Title only — lightweight lookup (used by notifs, audit) */
export async function getTaskTitleById(id) {
  const result = await db.execute({
    sql: "SELECT title FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
  return result.rows[0]?.title || null;
}

/** End date only — used for parent sync checks */
export async function getTaskEndDateById(id) {
  const result = await db.execute({
    sql: "SELECT end_date FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
  return result.rows[0]?.end_date || null;
}

/** Existence check — returns boolean */
export async function taskExists(id) {
  const result = await db.execute({
    sql: "SELECT id FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
  return result.rows.length > 0;
}

/**
 * Full task row for the GET single-task path (id query param).
 * Keeps the original `WHERE 1=1` base byte-identical.
 */
export async function getTaskRowById(id) {
  return db.execute({
    sql: "SELECT * FROM tasks WHERE 1=1 AND id = ?",
    args: [parseInt(id)],
  });
}

/** Access-control + carry-over status row used by the DELETE handler. */
export async function getTaskDeleteInfo(id) {
  return db.execute({
    sql: "SELECT user_id, assigned_to, supervisor_id, title, status FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Task metadata (title/user/week/year) needed for standup rebuild + audit after delete. */
export async function getTaskStandupInfo(id) {
  return db.execute({
    sql: "SELECT title, user_id, user_name, created_week, created_year FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Parent task project/category — inherited by newly created sub-tasks. */
export async function getParentProjectCategory(parentTaskId) {
  return db.execute({
    sql: "SELECT project_id, category FROM tasks WHERE id = ?",
    args: [parseInt(parentTaskId)],
  });
}

/** Raw end_date row for a task — used for parent end-date sync checks. */
export async function getTaskEndDateRowById(taskId) {
  return db.execute({
    sql: "SELECT end_date FROM tasks WHERE id = ?",
    args: [parseInt(taskId)],
  });
}

/** Raw title row for a task — used when a nullable title must be kept as-is. */
export async function getTaskTitleRowById(taskId) {
  return db.execute({
    sql: "SELECT title FROM tasks WHERE id = ?",
    args: [taskId],
  });
}

/** Lightweight subtask list for one parent (GET single-task view). */
export async function getSubtasksForTask(taskId) {
  return db.execute({
    sql: "SELECT id, title, status FROM tasks WHERE parent_task_id = ?",
    args: [parseInt(taskId)],
  });
}

/** Blockers attached to one task (GET single-task view). */
export async function getBlockersForTask(taskId) {
  return db.execute({
    sql: "SELECT id, title, status, severity, description, reference_url, notes FROM blockers WHERE task_id = ?",
    args: [parseInt(taskId)],
  });
}

/** Active blocker ids for one task — cascade guard on completion. */
export async function getActiveBlockersForTask(taskId) {
  return db.execute({
    sql: "SELECT id FROM blockers WHERE task_id = ? AND status = 'active'",
    args: [parseInt(taskId)],
  });
}

/** Active blockers (id + title) for one task — shown when forcing completion. */
export async function getActiveBlockersForTaskWithTitle(taskId) {
  return db.execute({
    sql: "SELECT id, title FROM blockers WHERE task_id = ? AND status = 'active'",
    args: [parseInt(taskId)],
  });
}

/** Active blockers on a task's sub-tasks (Rule 25 completion guard). */
export async function getActiveBlockersOnSubtasks(parentTaskId) {
  return db.execute({
    sql: `SELECT b.id, b.title, b.task_id, t.title AS task_title
              FROM blockers b
              JOIN tasks t ON b.task_id = t.id
              WHERE t.parent_task_id = ? AND b.status = 'active'`,
    args: [parseInt(parentTaskId)],
  });
}

/** Single batch query for all blockers of many tasks (avoids N+1). */
export async function getBlockersForTasks(taskIds) {
  return db.execute({
    sql: `SELECT id, title, status, severity, description, reference_url, notes, task_id FROM blockers WHERE task_id IN (${taskIds.map(() => "?").join(",")}) ORDER BY created_at DESC`,
    args: taskIds,
  });
}

/** Single batch query for all subtasks of many parents — full field set (Ticket 1.3). */
export async function getSubtasksForTasks(taskIds) {
  return db.execute({
    sql: `SELECT id, title, description, status, priority, assigned_to,
                        start_date, end_date, created_week, created_year,
                        link, parent_task_id
                FROM tasks
                WHERE parent_task_id IN (${taskIds.map(() => "?").join(",")})
                ORDER BY created_at ASC`,
    args: taskIds,
  });
}

/** Single batch query for all resources attached to tasks + subtasks. */
export async function getResourcesForTasks(taskIds) {
  return db.execute({
    sql: `SELECT id, name, url, task_id, type, file_name, file_size, uploaded_by FROM task_resources WHERE task_id IN (${taskIds.map(() => "?").join(",")}) ORDER BY created_at ASC`,
    args: taskIds,
  });
}

/** Comment counts for tasks + subtasks (threads fetched on-demand). */
export async function getCommentCountsForTasks(taskIds) {
  return db.execute({
    sql: `SELECT task_id, COUNT(*) AS cnt FROM v2_task_comments WHERE task_id IN (${taskIds.map(() => "?").join(",")}) GROUP BY task_id`,
    args: taskIds,
  });
}
