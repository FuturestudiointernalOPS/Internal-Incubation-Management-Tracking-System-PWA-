import db from "@/lib/db";

/**
 * Projects model — data access for the project controllers:
 * `src/app/api/projects/route.js`, `src/app/api/admin/projects/route.js`,
 * `src/app/api/admin/projects/[id]/route.js`,
 * `src/app/api/admin/projects/[id]/approvals/route.js`,
 * `src/app/api/admin/projects/[id]/updates/route.js`, and
 * `src/app/api/admin/projects/[id]/reports/generate/route.js`.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 * Where the original handlers ran the same query at multiple call sites, the
 * model keeps one function per call site (1:1 extraction — see the duplicated
 * upsert/notification helpers below, and docs/MVC_REFACTOR.md §4).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

/**
 * Create a project row, returning the new id.
 * Used by POST /api/projects.
 */
export async function createProject(
  program_id,
  name,
  status,
  start_date,
  end_date,
  priority,
  meta,
  primaryOwnerId,
) {
  return db.execute({
    sql: "INSERT INTO v2_projects (program_id, name, status, start_date, end_date, priority, meta, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    args: [
      program_id || null,
      name,
      status || "Active",
      start_date || null,
      end_date || null,
      ["critical", "high", "medium", "low"].includes(priority)
        ? priority
        : "medium",
      meta,
      primaryOwnerId,
    ],
  });
}

/** Add a lead PM as a project member (POST /api/projects lead loop). */
export async function upsertProjectLeadMember(projectId, leadId) {
  return db.execute({
    sql: "INSERT INTO project_members (project_id, user_cid, role) VALUES (?, ?, 'lead') ON CONFLICT (project_id, user_cid) DO UPDATE SET role = 'lead'",
    args: [String(projectId), leadId],
  });
}

/** Notify a lead PM of a new project assignment (POST /api/projects). */
export async function createProjectAssignmentNotification(
  recipient_id,
  title,
  message,
  type,
) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
    args: [recipient_id, title, message, type],
  });
}

/** Project list with program name, optional program / member filters. */
export async function getProjectsList(program_id, filterCid, include_archived) {
  let query = `
      SELECT p.*, pr.name as program_name
      FROM v2_projects p
      LEFT JOIN v2_programs pr ON p.program_id::text = pr.id::text
    `;
  const conditions = [];
  const args = [];

  // Filter by program
  if (program_id) {
    conditions.push("p.program_id = ?");
    args.push(program_id);
  }

  // Filter by user membership (project_members OR owner_id)
  if (filterCid) {
    conditions.push(
      "(EXISTS (SELECT 1 FROM project_members WHERE project_id::text = p.id::text AND user_cid = ?) OR p.owner_id = ?)",
    );
    args.push(filterCid, filterCid);
  }

  // Exclude archived unless explicitly requested
  if (include_archived !== "true") {
    conditions.push("p.status != 'Archived'");
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY p.created_at DESC";

  return db.execute({ sql: query, args });
}

/** Member rows (project_id, user_cid, role) for a set of project ids. */
export async function getProjectMembersForProjects(projectIds) {
  const placeholders = projectIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT project_id, user_cid, role FROM project_members WHERE project_id::text IN (${placeholders})`,
    args: projectIds,
  });
}

/** Aggregated task counts per project id for a set of project ids. */
export async function getTaskSummaryByProjectIds(projectIds) {
  const idsPh = projectIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT project_id::text AS pid,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
              FROM tasks WHERE project_id::text IN (${idsPh})
              GROUP BY project_id::text`,
    args: projectIds,
  });
}

/** Current meta JSON of a project (used before a meta update). */
export async function getProjectMetaById(id) {
  return db.execute({
    sql: "SELECT meta FROM v2_projects WHERE id::text = ?",
    args: [id],
  });
}

/** Update the mutable fields of a project (dynamic SET built by caller). */
export async function updateProject(updateFields, updateArgs) {
  return db.execute({
    sql: `UPDATE v2_projects SET ${updateFields.join(", ")} WHERE id::text = ?`,
    args: updateArgs,
  });
}

/** Remove all lead members of a project (PUT /api/projects lead sync). */
export async function deleteProjectLeads(id) {
  return db.execute({
    sql: "DELETE FROM project_members WHERE project_id::text = ? AND role = 'lead'",
    args: [String(id)],
  });
}

/**
 * Re-add a lead PM as a project member (PUT /api/projects lead loop).
 * Byte-identical query to upsertProjectLeadMember; extracted separately so
 * each original inline call site maps 1:1 to a model function.
 */
export async function upsertProjectLeadMemberOnUpdate(id, leadId) {
  return db.execute({
    sql: "INSERT INTO project_members (project_id, user_cid, role) VALUES (?, ?, 'lead') ON CONFLICT (project_id, user_cid) DO UPDATE SET role = 'lead'",
    args: [String(id), leadId],
  });
}

/** Remove all project members before deleting a project (DELETE handler). */
export async function deleteProjectMembersByProjectId(id) {
  return db.execute({
    sql: "DELETE FROM project_members WHERE project_id::text = ?",
    args: [id],
  });
}

/** Delete a project row (DELETE /api/projects). */
export async function deleteProjectById(id) {
  return db.execute({
    sql: "DELETE FROM v2_projects WHERE id::text = ?",
    args: [id],
  });
}

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

/** Approval requests for a project with requester + task titles, newest first. */
export async function getProjectApprovalRequests(id) {
  return db.execute({
    sql: `SELECT par.*, c.name AS requester_name_lookup, t.title AS task_title
              FROM project_approval_requests par
              LEFT JOIN contacts c ON par.requested_by = c.cid OR par.requested_by = c.id
              LEFT JOIN tasks t ON par.task_id = t.id
              WHERE par.project_id::text = ?
              ORDER BY par.created_at DESC`,
    args: [id],
  });
}

/** Full approval-request row by numeric id. */
export async function getProjectApprovalRequestById(request_id) {
  return db.execute({
    sql: "SELECT * FROM project_approval_requests WHERE id = ?",
    args: [parseInt(request_id)],
  });
}

/** Record a reviewer decision on an approval request. */
export async function updateProjectApprovalRequestStatus(
  action,
  reviewer_id,
  rejection_reason,
  request_id,
) {
  return db.execute({
    sql: `UPDATE project_approval_requests
              SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
              WHERE id = ?`,
    args: [
      action,
      reviewer_id,
      action === "rejected" ? rejection_reason : null,
      parseInt(request_id),
    ],
  });
}

/** Link an approved contribution task to the project and activate it. */
export async function linkTaskToProject(project_id, task_id) {
  return db.execute({
    sql: "UPDATE tasks SET project_id = ?, status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [project_id, task_id],
  });
}

/** Notify the requester that their contribution was approved. */
export async function createApprovalApprovedNotification(
  recipient_id,
  title,
  message,
  type,
) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, ?, 0, NOW())`,
    args: [recipient_id, title, message, type],
  });
}

/**
 * Notify the requester that their contribution was rejected.
 * Byte-identical query to createApprovalApprovedNotification; extracted
 * separately so each original inline call site maps 1:1 to a model function.
 */
export async function createApprovalRejectedNotification(
  recipient_id,
  title,
  message,
  type,
) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, ?, 0, NOW())`,
    args: [recipient_id, title, message, type],
  });
}

/** Weekly project updates, newest first (admin project-updates view). */
export async function getProjectUpdates(id) {
  return db.execute({
    sql: "SELECT * FROM v2_project_updates WHERE project_id::text = ? ORDER BY year DESC, week_number DESC",
    args: [id],
  });
}

/** Id of an existing weekly update for a project/week/year (upsert check). */
export async function findProjectUpdateId(id, currentWeek, currentYear) {
  return db.execute({
    sql: "SELECT id FROM v2_project_updates WHERE project_id::text = ? AND week_number = ? AND year = ?",
    args: [id, currentWeek, currentYear],
  });
}

/** Update an existing weekly update (dynamic SET built by caller). */
export async function updateProjectUpdate(updateFields, updateArgs) {
  return db.execute({
    sql: `UPDATE v2_project_updates SET ${updateFields.join(", ")} WHERE id = ?`,
    args: updateArgs,
  });
}

/** Insert a new weekly project update, returning the new id. */
export async function createProjectUpdate(
  project_id,
  user_id,
  user_name,
  week_number,
  year,
  status,
  accomplishments,
  current_focus,
  blockers,
  next_steps,
  overall_status,
  notes,
) {
  return db.execute({
    sql: `INSERT INTO v2_project_updates
        (project_id, user_id, user_name, week_number, year, status,
         accomplishments, current_focus, blockers, next_steps,
         overall_status, notes)
        VALUES (?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?) RETURNING id`,
    args: [
      project_id,
      user_id,
      user_name || "",
      week_number,
      year,
      status || "draft",
      accomplishments || null,
      current_focus || null,
      blockers || null,
      next_steps || null,
      overall_status || "on_track",
      notes || null,
    ],
  });
}

/**
 * Task-status stats for the auto-generated weekly report.
 * Uses native Postgres $n placeholders (no ? translation) — byte-identical
 * to the original inline query.
 */
export async function getProjectReportTaskStats(id) {
  return db.execute({
    sql: `SELECT COUNT(*) AS t, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS c,
            SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS ip,
            SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) AS b,
            SUM(CASE WHEN status='carried_over' THEN 1 ELSE 0 END) AS co
            FROM tasks WHERE project_id::text = \$1`,
    args: [id],
  });
}

/** Recently updated tasks of a project (report detail lines, capped at 10). */
export async function getRecentTasksForReport(id) {
  return db.execute({
    sql: "SELECT title, status FROM tasks WHERE project_id::text = \$1 ORDER BY updated_at DESC LIMIT 10",
    args: [id],
  });
}

/** Id of an existing update for the report's project/week/year. */
export async function findProjectUpdateForReport(id, weekNumber, year) {
  return db.execute({
    sql: "SELECT id FROM v2_project_updates WHERE project_id::text = \$1 AND week_number = \$2 AND year = \$3",
    args: [id, weekNumber, year],
  });
}

/** Overwrite an existing update with the auto-generated report contents. */
export async function updateAutoGeneratedProjectUpdate(
  summary,
  details,
  overall,
  updateId,
) {
  return db.execute({
    sql: "UPDATE v2_project_updates SET accomplishments=\$1, current_focus=\$2, overall_status=\$3, notes=\$4, updated_at=NOW() WHERE id=\$5",
    args: [summary, details, overall, "Auto-generated", updateId],
  });
}

/** Insert the auto-generated weekly report as a submitted update. */
export async function createAutoGeneratedProjectUpdate(
  id,
  weekNumber,
  year,
  summary,
  details,
  overall,
) {
  return db.execute({
    sql: "INSERT INTO v2_project_updates (project_id,user_id,user_name,week_number,year,status,accomplishments,current_focus,overall_status,notes) VALUES (\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10)",
    args: [
      id,
      "system",
      "System",
      weekNumber,
      year,
      "submitted",
      summary,
      details,
      overall,
      "Auto-generated",
    ],
  });
}
