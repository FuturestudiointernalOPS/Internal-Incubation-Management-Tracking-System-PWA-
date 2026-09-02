import db from "@/lib/db";

/**
 * Dashboard model — data access for the unified dashboard controller
 * (`src/app/api/dashboard/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

/** KPI summary for the Super Admin dashboard (program × avg KPI rate). */
export async function getProgramKpiSummary() {
  return db.execute({
    sql: `SELECT p.id, p.name, p.status,
                 ROUND(AVG(kp.progress)) AS avg_kpi_rate,
                 COUNT(DISTINCT kp.kpi_id) AS kpi_count
          FROM v2_programs p
          LEFT JOIN kpi_progress kp ON p.id::text = kp.program_id
          WHERE p.status NOT IN ('archived', 'cancelled')
          GROUP BY p.id, p.name, p.status
          HAVING COUNT(DISTINCT kp.kpi_id) > 0
          ORDER BY avg_kpi_rate DESC NULLS LAST`,
    args: [],
  });
}

/** User identity (name, email, role) by contact id. */
export async function getUserIdentity(userId) {
  return db.execute({
    sql: "SELECT name, email, role, cid FROM contacts WHERE cid = ?",
    args: [userId],
  });
}

/** Calendar source — user's tasks (own or assigned) with dates, not archived. */
export async function getCalendarTasks(userId) {
  return db.execute({
    sql: `SELECT id, title, description, start_date, end_date, status, priority, category, project_id, user_id, user_name, assigned_to, link
          FROM tasks
          WHERE (user_id = ? OR assigned_to = ?)
            AND status != 'archived'`,
    args: [userId, userId],
  });
}

/** Calendar source — programs visible to the user (own PM scope or admin). */
export async function getCalendarPrograms(userId, role) {
  return db.execute({
    sql: `SELECT id, name, start_date, end_date, assigned_pm_id
          FROM v2_programs
          WHERE (start_date IS NOT NULL OR end_date IS NOT NULL)
            AND (is_archived IS NULL OR is_archived = 0)
            AND (assigned_pm_id = ? OR ? IN ('super_admin', 'admin'))`,
    args: [userId, role],
  });
}

/** Calendar source — sessions for programs the user can see. */
export async function getCalendarSessions(userId, role) {
  return db.execute({
    sql: `SELECT s.id, s.title, s.start_at, s.teacher_id, s.program_id, p.name AS program_name
          FROM v2_sessions s
          LEFT JOIN v2_programs p ON s.program_id = p.id AND (p.is_archived IS NULL OR p.is_archived = 0)
          WHERE s.start_at IS NOT NULL
            AND (s.teacher_id = ? OR s.program_id IN (
              SELECT id FROM v2_programs WHERE assigned_pm_id = ?
            ) OR ? IN ('super_admin', 'admin'))`,
    args: [userId, userId, role],
  });
}

/** Calendar source — deliverables due in programs visible to the user. */
export async function getCalendarDeliverables(userId, role) {
  return db.execute({
    sql: `SELECT d.id, d.title, d.due_date, d.program_id
          FROM v2_deliverables d
          JOIN v2_programs p ON d.program_id = p.id AND (p.is_archived IS NULL OR p.is_archived = 0)
          WHERE d.due_date IS NOT NULL
            AND (p.assigned_pm_id = ? OR ? IN ('super_admin', 'admin'))`,
    args: [userId, role],
  });
}

/** Calendar source — v2_events created by the user. */
export async function getCalendarEvents(userId) {
  return db.execute({
    sql: `SELECT id, title, start_time, event_type, created_by
          FROM v2_events
          WHERE start_time IS NOT NULL
            AND created_by = ?`,
    args: [userId],
  });
}

/**
 * Top-level tasks (no parent_task_id, not archived) — the source of truth for
 * task statistics. Subtasks are tracked via their parent.
 */
export async function getTopLevelTasks(userId) {
  return db.execute({
    sql: `SELECT id, title, end_date, status, priority, project_id
          FROM tasks
          WHERE (user_id = ? OR assigned_to = ?)
            AND parent_task_id IS NULL
            AND status != 'archived'`,
    args: [userId, userId],
  });
}

/** Active blockers on the user's tasks, ordered by severity. */
export async function getActiveBlockers(userId) {
  return db.execute({
    sql: `SELECT b.id, b.title, b.severity, b.status, b.task_id, t.project_id, t.title AS task_title, t.end_date
          FROM blockers b
          JOIN tasks t ON b.task_id = t.id
          WHERE b.status = 'active'
            AND (t.user_id = ? OR t.assigned_to = ?)
          ORDER BY CASE b.severity
            WHEN 'critical' THEN 0 WHEN 'high' THEN 1
            WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
          END`,
    args: [userId, userId],
  });
}

/** Programs the user can see (own PM scope or admin), newest first. */
export async function getVisiblePrograms(userId, role) {
  return db.execute({
    sql: `SELECT id, name, status
          FROM v2_programs
          WHERE (is_archived IS NULL OR is_archived = 0)
            AND (assigned_pm_id = ?
             OR ? IN ('super_admin', 'admin'))
          ORDER BY created_at DESC`,
    args: [userId, role],
  });
}

/** Projects the user owns or leads, with aggregated task/blocker stats. */
export async function getOwnedProjectsWithStats(userId, role) {
  return db.execute({
    sql: `SELECT
            p.id, p.name, p.status, p.owner_id, p.meta,
            COALESCE(t_stats.total, 0) AS task_total,
            COALESCE(t_stats.completed, 0) AS task_completed,
            COALESCE(b_stats.active, 0) AS blocker_active
          FROM v2_projects p
          LEFT JOIN (
            SELECT project_id,
                   COUNT(*) AS total,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
            FROM tasks GROUP BY project_id
          ) t_stats ON p.id::text = t_stats.project_id
          LEFT JOIN (
            SELECT t.project_id, COUNT(*) AS active
            FROM blockers b JOIN tasks t ON b.task_id = t.id
            WHERE b.status = 'active' GROUP BY t.project_id
          ) b_stats ON p.id::text = b_stats.project_id
          WHERE (p.owner_id::text = ?::text OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id::text = p.id::text AND pm.user_cid::text = ?::text AND pm.role = 'lead'
          )) OR ?::text IN ('super_admin', 'admin')
          ORDER BY p.created_at DESC`,
    args: [userId, userId, role],
  });
}

/** Project ids the user is a member of (collaborator view). */
export async function getCollabProjectIds(userId) {
  return db.execute({
    sql: `SELECT DISTINCT project_id FROM project_members WHERE user_cid = ?`,
    args: [userId],
  });
}

/**
 * Full project rows (with task/blocker stats) for a set of project ids.
 * The placeholder list is derived from the number of ids, so the generated
 * SQL is identical to the original inline `p.id IN (?,?,...)` query.
 */
export async function getCollabProjectsByIds(projectIds) {
  const placeholders = projectIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT
            p.id, p.name, p.status, p.owner_id, p.meta,
            COALESCE(t_stats.total, 0) AS task_total,
            COALESCE(t_stats.completed, 0) AS task_completed,
            COALESCE(b_stats.active, 0) AS blocker_active
          FROM v2_projects p
          LEFT JOIN (
            SELECT project_id, COUNT(*) AS total,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
            FROM tasks GROUP BY project_id
          ) t_stats ON p.id::text = t_stats.project_id
          LEFT JOIN (
            SELECT t.project_id, COUNT(*) AS active
            FROM blockers b JOIN tasks t ON b.task_id = t.id
            WHERE b.status = 'active' GROUP BY t.project_id
          ) b_stats ON p.id::text = b_stats.project_id
          WHERE p.id IN (${placeholders})
          ORDER BY p.created_at DESC`,
    args: projectIds,
  });
}

/** Recent activity feed — completed tasks, resolved blockers, assignments, audits. */
export async function getRecentActivity(userId) {
  return db.execute({
    sql: `(SELECT 'task_completed' AS action, title AS description, updated_at AS timestamp, user_id::text
           FROM tasks WHERE (user_id::text = ?::text OR assigned_to::text = ?::text) AND status = 'completed'
           ORDER BY updated_at DESC LIMIT 5)
          UNION ALL
          (SELECT 'blocker_resolved' AS action, title AS description, resolved_at AS timestamp, resolved_by::text AS user_id
           FROM blockers WHERE resolved_by::text = ?::text AND status = 'resolved'
           ORDER BY resolved_at DESC LIMIT 3)
          UNION ALL
          (SELECT 'task_assigned' AS action, title AS description, created_at AS timestamp, user_id::text
           FROM tasks WHERE assigned_to::text = ?::text
           ORDER BY created_at DESC LIMIT 3)
          UNION ALL
          (SELECT DISTINCT ON (entity_id, action) action, details AS description, created_at AS timestamp, user_id
           FROM audit_log WHERE entity_type = 'program_assignment' AND user_id = ?
           ORDER BY entity_id, action, created_at DESC LIMIT 3)
          ORDER BY timestamp DESC LIMIT 10`,
    args: [userId, userId, userId, userId, userId],
  });
}

/** Tasks assigned TO the user (assignment inbox), newest first. */
export async function getAssignedTasks(userId) {
  return db.execute({
    sql: `SELECT id, title, status, end_date, user_name, user_id, priority, created_at
          FROM tasks WHERE assigned_to::text = ?::text ORDER BY created_at DESC`,
    args: [userId],
  });
}

/** Quick access — user's own top-level tasks, prioritized by status/due date. */
export async function getQuickAccessTasks(userId) {
  return db.execute({
    sql: `SELECT id, title, status, end_date, priority, project_id
          FROM tasks WHERE user_id::text = ?::text
            AND parent_task_id IS NULL
            AND status != 'archived'
          ORDER BY
            CASE status
              WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1
              WHEN 'blocked' THEN 2 WHEN 'carried_over' THEN 3 ELSE 4
            END,
            end_date ASC NULLS LAST
          LIMIT 5`,
    args: [userId],
  });
}

/** KPI progress rows for programs the user manages or handles. */
export async function getKpiProgressRows(userId) {
  return db.execute({
    sql: `SELECT kp.program_id, kp.kpi_id, k.title, k.weight, k.target_value, k.auto_weight,
                 kp.approved_count, kp.participant_count, kp.completion_rate
          FROM kpi_progress kp
          JOIN v2_kpis k ON kp.kpi_id::text = k.id::text AND kp.program_id::text = k.program_id::text
          WHERE kp.program_id IN (SELECT id::text FROM v2_programs WHERE assigned_pm_id = ? OR assigned_assistant_id LIKE ? OR id::text IN (SELECT program_id::text FROM v2_teams WHERE handler_id = ?))
          ORDER BY kp.program_id, kp.kpi_id`,
    args: [userId, `%${userId}%`, userId],
  });
}
