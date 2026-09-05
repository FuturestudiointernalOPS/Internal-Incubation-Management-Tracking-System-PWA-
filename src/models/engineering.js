import db from "@/lib/db";

/**
 * Engineering model — data access for the engineering API controllers under
 * `src/app/api/engineering/` (reports, dashboard, error-to-task conversion,
 * developer management).
 *
 * Each exported function wraps exactly one SQL statement, and SQL is
 * byte-identical to the queries that used to live inline in the controllers,
 * so behavior is unchanged (see docs/MVC_REFACTOR.md §4).
 *
 * Route → function-group mapping (extraction is strictly 1:1 with the
 * original inline call sites):
 *
 *  src/app/api/engineering/reports/route.js        → 10 functions
 *  src/app/api/engineering/dashboard/route.js      →  6 functions
 *  src/app/api/engineering/errors/create-task/route.js → 3 functions
 *  src/app/api/engineering/developers/route.js     →  3 functions
 */

// ── GET /api/engineering/reports ────────────────────────────────────────────

/** reports GET — total error_logs rows since the start of the period. */
export async function countErrorLogsSince(startDate) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM error_logs WHERE created_at >= ?",
    args: [startDate],
  });
}

/** reports GET — resolved error_logs rows since the start of the period. */
export async function countResolvedErrorLogsSince(startDate) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM error_logs WHERE created_at >= ? AND resolved = true",
    args: [startDate],
  });
}

/** reports GET — unresolved error_logs rows since the start of the period. */
export async function countUnresolvedErrorLogsSince(startDate) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM error_logs WHERE created_at >= ? AND (resolved IS NULL OR resolved = false)",
    args: [startDate],
  });
}

/** reports GET — average resolution time in hours for the period. */
export async function getAverageErrorResolutionHours(startDate) {
  return db.execute({
    sql: `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600), 0) as avg_hours
            FROM error_logs
            WHERE created_at >= ? AND resolved = true AND resolved_at IS NOT NULL`,
    args: [startDate],
  });
}

/** reports GET — most recurring errors (grouped by message), top 20. */
export async function listMostRecurringErrors(startDate) {
  return db.execute({
    sql: `SELECT message, COUNT(*) as count, MAX(created_at) as last_occurrence,
                   COUNT(CASE WHEN resolved = true THEN 1 END) as resolved_count,
                   MIN(severity) as severity
            FROM error_logs
            WHERE created_at >= ?
            GROUP BY message
            ORDER BY count DESC
            LIMIT 20`,
    args: [startDate],
  });
}

/** reports GET — error counts by severity for the period. */
export async function countErrorsBySeverity(startDate) {
  return db.execute({
    sql: `SELECT severity, COUNT(*) as count
            FROM error_logs
            WHERE created_at >= ?
            GROUP BY severity
            ORDER BY count DESC`,
    args: [startDate],
  });
}

/** reports GET — error counts by page for the period, top 15. */
export async function countErrorsByPage(startDate) {
  return db.execute({
    sql: `SELECT COALESCE(page, 'unknown') as page, COUNT(*) as count
            FROM error_logs
            WHERE created_at >= ?
            GROUP BY page
            ORDER BY count DESC
            LIMIT 15`,
    args: [startDate],
  });
}

/** reports GET — weekly error trend over the last 8 weeks. */
export async function getWeeklyErrorTrend() {
  return db.execute({
    sql: `SELECT DATE_TRUNC('week', created_at) as week,
                   COUNT(*) as total,
                   SUM(CASE WHEN resolved = true THEN 1 ELSE 0 END) as resolved
            FROM error_logs
            WHERE created_at >= NOW() - INTERVAL '8 weeks'
            GROUP BY DATE_TRUNC('week', created_at)
            ORDER BY week ASC`,
  });
}

/** reports GET — development task totals/completions/criticals for the period. */
export async function getDevelopmentTaskStats(startDate) {
  return db.execute({
    sql: `SELECT
              COUNT(*) as total_tasks,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
              SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical_tasks
            FROM tasks
            WHERE category = 'development'
              AND created_at >= ?`,
    args: [startDate],
  });
}

/** reports GET — most error-prone pages (per-page aggregates), top 10. */
export async function listTopErrorPronePages(startDate) {
  return db.execute({
    sql: `SELECT COALESCE(page, 'unknown') as page,
                   COUNT(*) as total_errors,
                   COUNT(DISTINCT user_id) as affected_users,
                   MAX(created_at) as last_error
            FROM error_logs
            WHERE created_at >= ?
            GROUP BY page
            ORDER BY total_errors DESC
            LIMIT 10`,
    args: [startDate],
  });
}

// ── GET /api/engineering/dashboard ──────────────────────────────────────────

/** dashboard GET — active developers & interns. */
export async function listEngineeringDevelopers() {
  return db.execute({
    sql: `SELECT cid, name, email, role, status, group_name, created_at
            FROM contacts
            WHERE role IN ('developer', 'intern')
            ORDER BY role, name`,
    args: [],
  });
}

/** dashboard GET — open development tasks (not completed/archived). */
export async function listActiveDevelopmentTasks() {
  return db.execute({
    sql: `SELECT t.*, c.name as assignee_name
            FROM tasks t
            LEFT JOIN contacts c ON t.assigned_to = c.cid
            WHERE t.category = 'development'
              AND t.status NOT IN ('completed', 'archived')
            ORDER BY
              CASE t.priority
                WHEN 'critical' THEN 0
                WHEN 'high' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'low' THEN 3
                ELSE 4
              END,
              t.end_date ASC NULLS LAST`,
    args: [],
  });
}

/** dashboard GET — unresolved error logs (newest 50). */
export async function listUnresolvedErrorLogs() {
  return db.execute({
    sql: `SELECT e.*, c.name as user_name
            FROM error_logs e
            LEFT JOIN contacts c ON e.user_id = c.cid
            WHERE (e.resolved IS NULL OR e.resolved = false)
            ORDER BY e.created_at DESC
            LIMIT 50`,
    args: [],
  });
}

/** dashboard GET — overdue development tasks before the given date. */
export async function listOverdueDevelopmentTasks(today) {
  return db.execute({
    sql: `SELECT t.*, c.name as assignee_name
            FROM tasks t
            LEFT JOIN contacts c ON t.assigned_to = c.cid
            WHERE t.category = 'development'
              AND t.end_date < ?
              AND t.status NOT IN ('completed', 'archived')
            ORDER BY t.end_date ASC`,
    args: [today],
  });
}

/** dashboard GET — active blockers with task/author names. */
export async function listActiveBlockers() {
  return db.execute({
    sql: `SELECT b.*, t.title as task_title, c.name as reported_by_name
            FROM blockers b
            JOIN tasks t ON b.task_id = t.id
            LEFT JOIN contacts c ON b.user_id = c.cid
            WHERE b.status = 'active'
            ORDER BY b.created_at DESC`,
    args: [],
  });
}

/** dashboard GET — weekly completion stats per assigned developer. */
export async function getWeeklyDevelopmentCompletionStats(weekNumber, year) {
  return db.execute({
    sql: `SELECT assigned_to, c.name as assignee_name,
                   COUNT(*) as total_tasks,
                   SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
            FROM tasks t
            LEFT JOIN contacts c ON t.assigned_to = c.cid
            WHERE t.category = 'development'
              AND t.created_week = ? AND t.created_year = ?
              AND t.assigned_to IS NOT NULL
            GROUP BY t.assigned_to, c.name`,
    args: [weekNumber, year],
  });
}

// ── POST /api/engineering/errors/create-task ────────────────────────────────

/** create-task POST — verify the error log exists before conversion. */
export async function getErrorLogById(errorId) {
  return db.execute({
    sql: "SELECT * FROM error_logs WHERE id = ?",
    args: [errorId],
  });
}

/** create-task POST — insert the development task derived from an error log. */
export async function createDevelopmentTaskFromErrorLog({
  errorLogUserId,
  errorLogMessage,
  error_id,
  title,
  description,
  priority,
  assignee,
  due_date,
  weekNumber,
  year,
}) {
  return db.execute({
    sql: `INSERT INTO tasks (user_id, user_name, title, description, status, category, priority, assigned_to, end_date, created_week, created_year, project_id)
            VALUES (?, ?, ?, ?, ?, 'development', ?, ?, ?, ?, ?, ?)`,
    args: [
      errorLogUserId || "system",
      "Engineering Ops",
      title,
      description ||
        `Auto-created from Error Log #${error_id}: ${errorLogMessage}`,
      "pending",
      priority || "medium",
      assignee || null,
      due_date || null,
      weekNumber,
      year,
      null,
    ],
  });
}

/** create-task POST — link the created task back to its error log. */
export async function linkErrorLogToTask(taskId, errorId) {
  return db.execute({
    sql: "UPDATE error_logs SET task_id = ? WHERE id = ?",
    args: [taskId, errorId],
  });
}

// ── GET/PATCH /api/engineering/developers ───────────────────────────────────

/** developers GET — developers & interns, optionally filtered by role. */
export async function listDevelopersAndInterns(role) {
  let sql = "SELECT * FROM contacts WHERE role IN ('developer', 'intern')";
  const args = [];

  if (role) {
    sql += " AND role = ?";
    args.push(role);
  }

  sql += " ORDER BY created_at DESC";

  return db.execute({ sql, args });
}

/** developers GET — active (non-completed/archived) task counts per assignee. */
export async function countActiveTasksForDeveloperCids(devIds) {
  const idsPh = devIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT assigned_to::text AS who, COUNT(*) AS cnt
              FROM tasks
              WHERE assigned_to::text IN (${idsPh})
                AND status NOT IN ('completed', 'archived')
              GROUP BY assigned_to::text`,
    args: devIds,
  });
}

/** developers PATCH — apply the dynamic UPDATE contacts SET ... WHERE cid = ?. */
export async function updateDeveloperFields(updates, args) {
  return db.execute({
    sql: `UPDATE contacts SET ${updates.join(", ")} WHERE cid = ?`,
    args,
  });
}
