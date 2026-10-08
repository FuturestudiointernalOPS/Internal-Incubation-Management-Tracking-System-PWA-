import db from "@/lib/db";

/**
 * Projects model — Super Admin project reads (REPOSITORY layer).
 *
 * The admin project list and its per-project task/blocker/timeline detail reads,
 * split verbatim out of `models/projects.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Admin project list, optional archived/program filters (admin dashboard). */
export async function getAdminProjects(include_archived, program_id) {
  let projectSql = "SELECT * FROM v2_projects WHERE 1=1";
  const projectArgs = [];

  if (include_archived !== "true") {
    projectSql += " AND status != 'Archived'";
  }

  if (program_id) {
    projectSql += " AND program_id = ?";
    projectArgs.push(program_id);
  }
  projectSql += " ORDER BY created_at DESC";

  return db.execute({ sql: projectSql, args: projectArgs });
}

/** Per-project task stats (all statuses) for a set of project ids. */
export async function getAdminTaskStatsByProjectIds(projectIds) {
  const idsPh = projectIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT project_id::text AS pid,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
              SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
              SUM(CASE WHEN status = 'carried_over' THEN 1 ELSE 0 END) AS carried_over,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
              FROM tasks WHERE project_id::text IN (${idsPh})
              GROUP BY project_id::text`,
    args: projectIds,
  });
}

/** Per-project dated-task counts for a set of project ids (timeline health). */
export async function countDatedTasksByProjectIds(projectIds) {
  const idsPh = projectIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT project_id::text AS pid,
            SUM(CASE WHEN start_date IS NOT NULL AND end_date IS NOT NULL THEN 1 ELSE 0 END) AS dated
            FROM tasks WHERE project_id::text IN (${idsPh})
            GROUP BY project_id::text`,
    args: projectIds,
  });
}

/** Per-project blocker stats (total + active) for a set of project ids. */
export async function getAdminBlockerStatsByProjectIds(projectIds) {
  const idsPh = projectIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT t.project_id::text AS pid,
              COUNT(*) AS total,
              SUM(CASE WHEN b.status = 'active' THEN 1 ELSE 0 END) AS active
              FROM blockers b
              JOIN tasks t ON b.task_id = t.id
              WHERE t.project_id::text IN (${idsPh})
              GROUP BY t.project_id::text`,
    args: projectIds,
  });
}

/** Single project details with program name + owner contact name. */
export async function getAdminProjectDetails(id) {
  return db.execute({
    sql: `SELECT p.*, pr.name AS program_name, c.name AS owner_name
            FROM v2_projects p
            LEFT JOIN v2_programs pr ON p.program_id::text = pr.id::text
            LEFT JOIN contacts c ON (p.owner_id IS NOT NULL AND (p.owner_id = c.cid OR p.owner_id = c.id))
            WHERE p.id::text = ?`,
    args: [id],
  });
}

/** Aggregated task stats for one project (admin single-project view). */
export async function getTaskStatsForProject(id) {
  return db.execute({
    sql: `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN status = 'carried_over' THEN 1 ELSE 0 END) AS carried_over,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
        FROM tasks WHERE project_id::text = ?`,
    args: [id],
  });
}

/** All tasks of a project with assignee contact name. */
export async function getTasksForProject(id) {
  return db.execute({
    sql: `SELECT t.*, c.name AS assignee_name
            FROM tasks t
            LEFT JOIN contacts c ON (t.assigned_to IS NOT NULL AND (t.assigned_to = c.cid OR t.assigned_to = c.id))
            WHERE t.project_id::text = ?
            ORDER BY t.created_at DESC`,
    args: [id],
  });
}

/** Task resources for a set of task ids (batched, oldest first). */
export async function getResourcesByTaskIds(taskIds) {
  return db.execute({
    sql: `SELECT id, name, url, task_id, type, file_name, file_size, uploaded_by FROM task_resources WHERE task_id IN (${taskIds.map(() => "?").join(",")}) ORDER BY created_at ASC`,
    args: taskIds,
  });
}

/** Blockers for a set of task ids (batched, newest first). */
export async function getBlockersByTaskIds(taskIds) {
  const idsPh = taskIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT id, title, status, severity, description, reference_url, notes, created_at, resolved_at, task_id
                FROM blockers WHERE task_id IN (${idsPh}) ORDER BY created_at DESC`,
    args: taskIds,
  });
}

/** Subtasks whose parent is in a set of task ids (batched, oldest first). */
export async function getSubtasksByParentTaskIds(taskIds) {
  const idsPh = taskIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT id, title, status, parent_task_id AS task_id
                FROM tasks WHERE parent_task_id IN (${idsPh}) ORDER BY created_at ASC`,
    args: taskIds,
  });
}

/** All blockers of a project with task title + reporter name. */
export async function getProjectBlockers(id) {
  return db.execute({
    sql: `SELECT b.*, t.title AS task_title, c.name AS user_name
            FROM blockers b
            JOIN tasks t ON b.task_id = t.id
            LEFT JOIN contacts c ON (b.user_id IS NOT NULL AND (b.user_id = c.cid OR b.user_id = c.id))
            WHERE t.project_id::text = ?
            ORDER BY b.created_at DESC`,
    args: [id],
  });
}

/** Team members: union of project_members, v2_project_staff and assignees. */
export async function getProjectMembersUnion(id) {
  return db.execute({
    sql: `SELECT DISTINCT member_id, c.name, c.role, c.email, member_role FROM (
        SELECT user_cid AS member_id, role AS member_role FROM project_members WHERE project_id::text = ?
        UNION
        SELECT staff_cid AS member_id, role AS member_role FROM v2_project_staff WHERE project_id::text = ?
        UNION
        SELECT assigned_to AS member_id, 'member' AS member_role FROM tasks WHERE project_id::text = ? AND assigned_to IS NOT NULL
      ) combined
      LEFT JOIN contacts c ON (combined.member_id IS NOT NULL AND (combined.member_id = c.cid OR combined.member_id = c.id))`,
    args: [id, id, id],
  });
}

/** Recent activity timeline for a project (assignment log, capped at 50). */
export async function getProjectTimeline(id) {
  return db.execute({
    sql: `SELECT tal.*, t.title AS task_title, c.name AS actor_name
            FROM task_assignment_log tal
            LEFT JOIN tasks t ON tal.task_id = t.id
            LEFT JOIN contacts c ON (tal.actor_id IS NOT NULL AND (tal.actor_id = c.cid OR tal.actor_id = c.id))
            WHERE tal.project_id::text = ?
            ORDER BY tal.created_at DESC
            LIMIT 50`,
    args: [id],
  });
}

/** Number of dated (start+end set) tasks in a project — timeline health. */
export async function countDatedTasksForProject(id) {
  return db.execute({
    sql: "SELECT COUNT(*) AS count FROM tasks WHERE project_id::text = ? AND start_date IS NOT NULL AND end_date IS NOT NULL",
    args: [id],
  });
}
