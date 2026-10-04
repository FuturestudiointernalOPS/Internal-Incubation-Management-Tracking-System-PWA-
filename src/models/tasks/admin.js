import db from "@/lib/db";

/**
 * Tasks model — Super Admin lists (REPOSITORY layer).
 *
 * The task and blocker lists behind the admin screens, split verbatim out of
 * `models/tasks.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

// ── GET /api/admin/tasks + /api/admin/blockers (Super Admin lists) ───────────

/** Admin task rows with the assignee display name, filterable by status/project/user (limit 200). */
export async function getAdminTaskRows(status, projectId, userId) {
  let sql = `SELECT t.*, c.name AS user_display_name FROM tasks t LEFT JOIN contacts c ON t.user_id = c.cid OR t.user_id = c.id WHERE 1=1`;
  const args = [];
  if (status) {
    sql += " AND t.status = ?";
    args.push(status);
  }
  if (projectId) {
    sql += " AND t.project_id = ?";
    args.push(projectId);
  }
  if (userId) {
    sql += " AND t.user_id = ?";
    args.push(userId);
  }
  sql += " ORDER BY t.created_at DESC LIMIT 200";
  return db.execute({ sql, args });
}

/** Blockers for a batch of task ids (one IN query instead of one round-trip per task). */
export async function getAdminTaskBlockers(taskIds) {
  const idsPh = taskIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT id, title, status, severity, created_at, task_id
            FROM blockers WHERE task_id IN (${idsPh}) ORDER BY created_at DESC`,
    args: taskIds,
  });
}

/** Admin blocker rows with task title/owner, filterable by status/task (active first). */
export async function getAdminBlockerRows(status, taskId) {
  let sql = `SELECT b.*, t.title AS task_title, t.project_id, t.user_name AS task_owner FROM blockers b JOIN tasks t ON b.task_id = t.id WHERE 1=1`;
  const args = [];
  if (status) {
    sql += " AND b.status = ?";
    args.push(status);
  }
  if (taskId) {
    sql += " AND b.task_id = ?";
    args.push(parseInt(taskId));
  }
  sql += " ORDER BY CASE WHEN b.status = 'active' THEN 0 ELSE 1 END, b.created_at DESC";
  return db.execute({ sql, args });
}
