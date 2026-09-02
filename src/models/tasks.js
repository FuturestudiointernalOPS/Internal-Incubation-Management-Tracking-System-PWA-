import db from "@/lib/db";

/**
 * Tasks model — data access for the tasks domain (tasks, subtasks,
 * task assignments, task notifications).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller
 * (`src/app/api/tasks/route.js`), so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 *  - Notification/audit *content* is shaped by callers, not here.
 */

/** Full row by primary key */
export async function getTaskById(id) {
  const r = await db.execute({
    sql: "SELECT * FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
  return r.rows[0] || null;
}

/** Title only — lightweight lookup (used by notifs, audit) */
export async function getTaskTitleById(id) {
  const r = await db.execute({
    sql: "SELECT title FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
  return r.rows[0]?.title || null;
}

/** End date only — used for parent sync checks */
export async function getTaskEndDateById(id) {
  const r = await db.execute({
    sql: "SELECT end_date FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
  return r.rows[0]?.end_date || null;
}

/** Existence check — returns boolean */
export async function taskExists(id) {
  const r = await db.execute({
    sql: "SELECT id FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
  return r.rows.length > 0;
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

/**
 * Task list with the GET handler's authorization scoping + filters.
 * The SQL is assembled exactly as the controller used to assemble it
 * (scope is decided by the controller; the SQL text lives here).
 */
export async function getTasksByFilters({
  isSuperAdmin,
  scope,
  sessionCid,
  effectiveUserId,
  assignedTo,
  projectId,
  status,
  priority,
  week,
  year,
  sort,
  limit,
}) {
  let sql = "SELECT * FROM tasks WHERE 1=1";
  const args = [];

  // SECURITY (Phase 0/6): For non-SA users, scope to: owned tasks, assigned tasks, or supervised tasks.
  // When an explicit assigned_to filter is given, use that. Otherwise scope by session user.
  if (!isSuperAdmin) {
    if (scope === "self") {
      // No user/assignee filter given (with or without project_id): force scope to session user
      sql += " AND (user_id = ? OR assigned_to = ? OR supervisor_id = ?)";
      args.push(sessionCid, sessionCid, sessionCid);
    } else if (scope === "user") {
      // Explicit user_id filter (pre-authorized above): scope to that user
      sql += " AND user_id = ?";
      args.push(effectiveUserId);
      if (assignedTo) {
        sql += " AND assigned_to = ?";
        args.push(assignedTo);
      }
    } else if (scope === "assigned") {
      // Non-SA requesting by assigned_to: only own assignments (controller enforces equality)
      sql += " AND assigned_to = ?";
      args.push(assignedTo);
    }
  } else {
    // Super admin: apply filters as requested
    if (effectiveUserId) {
      sql += " AND user_id = ?";
      args.push(effectiveUserId);
    }
    if (assignedTo) {
      sql += " AND assigned_to = ?";
      args.push(assignedTo);
    }
  }

  if (projectId) {
    sql += " AND project_id::text = ?";
    args.push(projectId);
  }

  if (status) {
    sql += " AND status = ?";
    args.push(status);
  }

  if (priority) {
    sql += " AND priority = ?";
    args.push(priority);
  }

  if (week) {
    sql += " AND created_week = ?";
    args.push(parseInt(week));
  }

  if (year) {
    sql += " AND created_year = ?";
    args.push(parseInt(year));
  }

  // Sorting
  switch (sort) {
    case "oldest":
      sql += " ORDER BY created_at ASC";
      break;
    case "updated":
      sql += " ORDER BY updated_at DESC";
      break;
    case "priority":
      sql +=
        " ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, created_at DESC";
      break;
    default:
      sql += " ORDER BY created_at DESC";
  }

  if (limit) {
    sql += " LIMIT ?";
    args.push(parseInt(limit));
  }

  return db.execute({ sql, args });
}

/** Project status — blocks creating tasks on closed/archived projects. */
export async function getProjectStatus(projectId) {
  return db.execute({
    sql: "SELECT status FROM v2_projects WHERE id::text = ?",
    args: [projectId],
  });
}

/** Project owner — default assignee when a task has a project but no assignee. */
export async function getProjectOwnerId(projectId) {
  return db.execute({
    sql: "SELECT owner_id FROM v2_projects WHERE id::text = ?",
    args: [String(projectId)],
  });
}

/** Project membership row — used to re-validate project reassignment. */
export async function getProjectMembership(projectId, userCid) {
  return db.execute({
    sql: "SELECT id FROM project_members WHERE project_id = ? AND user_cid = ?",
    args: [projectId, userCid],
  });
}

/** Super-admin contact row — used to prevent assigning tasks to a Super Admin. */
export async function getSuperAdminContact(cid) {
  return db.execute({
    sql: "SELECT role FROM contacts WHERE cid = ? AND role = 'super_admin'",
    args: [cid],
  });
}

/** Active super admins (cid + name) — new sub-task notifications. */
export async function getActiveSuperAdmins() {
  return db.execute({
    sql: "SELECT cid, name FROM contacts WHERE role = 'super_admin' AND status = 'active'",
    args: [],
  });
}

/** Active super admin cids — auto-completed sub-task notifications. */
export async function getActiveSuperAdminCids() {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE role = 'super_admin' AND status = 'active'",
    args: [],
  });
}

/** Contact role (single row) — standup sync role lookup. */
export async function getContactRoleByCid(cid) {
  return db.execute({
    sql: "SELECT role FROM contacts WHERE cid = ? LIMIT 1",
    args: [cid],
  });
}

/** Contact display name by cid — notification fallback name lookup. */
export async function getContactNameByCid(cid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Intent responsible party — auto-populated supervisor on intent link. */
export async function getIntentResponsibleId(intentId) {
  return db.execute({
    sql: "SELECT responsible_id FROM intents WHERE id = ?",
    args: [intentId],
  });
}

/** Pending assignment id (duplicate guard before creating a new one). */
export async function getPendingAssignmentId(taskId, assigneeId) {
  return db.execute({
    sql: "SELECT id FROM task_assignments WHERE task_id = ? AND assignee_id = ? AND status = 'pending'",
    args: [taskId, assigneeId],
  });
}

/** Pending assignment full row by assignment id. */
export async function getPendingAssignmentById(assignmentId) {
  return db.execute({
    sql: "SELECT * FROM task_assignments WHERE id = ? AND status = 'pending'",
    args: [parseInt(assignmentId)],
  });
}

/** Pending assignment full row by task + assignee. */
export async function getPendingAssignmentByTaskAndAssignee(taskId, assigneeCid) {
  return db.execute({
    sql: "SELECT * FROM task_assignments WHERE task_id = ? AND assignee_id = ? AND status = 'pending'",
    args: [taskId, assigneeCid],
  });
}

/** Create a task — every input maps 1:1 to a column. */
export async function createTask({
  user_id,
  user_name,
  title,
  description,
  status,
  project_id,
  category,
  created_week,
  created_year,
  carried_over_from_task_id,
  parent_task_id,
  start_date,
  end_date,
  assigned_to,
  link,
  priority,
  context_type,
  context_id,
  supervisor_id,
  intent_id,
}) {
  return db.execute({
    sql: `INSERT INTO tasks
        (user_id, user_name, title, description, status, project_id, category,
         created_week, created_year, carried_over_from_task_id,
         parent_task_id, start_date, end_date, assigned_to, link, priority,
         context_type, context_id, supervisor_id, intent_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?)
         RETURNING id`,
    args: [
      user_id,
      user_name || "",
      title,
      description || null,
      status,
      project_id || null,
      category || null,
      created_week,
      created_year,
      carried_over_from_task_id || null,
      parent_task_id || null,
      start_date,
      end_date,
      assigned_to,
      link || null,
      priority,
      context_type || "staff",
      context_id || null,
      supervisor_id || null,
      intent_id || null,
    ],
  });
}

/** Incomplete (non-archived) subtask count for one parent. */
export async function countIncompleteSubtasks(parentTaskId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS total FROM tasks WHERE parent_task_id = ? AND status NOT IN ('completed', 'archived')",
    args: [parseInt(parentTaskId)],
  });
}

/** Complete a task (skips archived/completed) — cascade auto-complete of a parent. */
export async function markTaskCompleted(taskId) {
  return db.execute({
    sql: `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'archived' AND status != 'completed'`,
    args: [parseInt(taskId)],
  });
}

/** Reopen a completed task to in_progress — cascade reopen of a parent. */
export async function reopenCompletedTask(taskId) {
  return db.execute({
    sql: `UPDATE tasks SET status = 'in_progress', completed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'completed'`,
    args: [parseInt(taskId)],
  });
}

/** Complete all non-archived sub-tasks of a parent (parent completion cascade). */
export async function completeSubtasks(parentTaskId) {
  return db.execute({
    sql: `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE parent_task_id = ? AND status != 'completed' AND status != 'archived'`,
    args: [parseInt(parentTaskId)],
  });
}

/** Reopen completed sub-tasks of a reopened parent (keeps state consistent). */
export async function reopenCompletedSubtasks(parentTaskId) {
  return db.execute({
    sql: `UPDATE tasks SET status = 'in_progress', completed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE parent_task_id = ? AND status = 'completed'`,
    args: [parseInt(parentTaskId)],
  });
}

/** Sync a task's end_date (parent extends when a sub-task runs further). */
export async function updateTaskEndDate(endDate, taskId) {
  return db.execute({
    sql: "UPDATE tasks SET end_date = ? WHERE id = ?",
    args: [endDate, taskId],
  });
}

/** Dynamic field update — updateFields/updateArgs are built by the controller. */
export async function updateTaskFields(updateFields, updateArgs) {
  return db.execute({
    sql: `UPDATE tasks SET ${updateFields.join(", ")} WHERE id = ?`,
    args: updateArgs,
  });
}

/** Reschedule drift counter increment. */
export async function incrementTaskRescheduleCount(taskId) {
  return db.execute({
    sql: "UPDATE tasks SET reschedule_count = COALESCE(reschedule_count, 0) + 1 WHERE id = ?",
    args: [parseInt(taskId)],
  });
}

/** Delete a task's blockers plus its sub-tasks' blockers (cascade before delete). */
export async function deleteBlockersForTaskAndSubtasks(taskId) {
  return db.execute({
    sql: "DELETE FROM blockers WHERE task_id IN (SELECT id FROM tasks WHERE id = ? OR parent_task_id = ?)",
    args: [taskId, taskId],
  });
}

/** Delete sub-tasks pointing at this parent (cascade before delete). */
export async function deleteSubtasksForTask(parentTaskId) {
  return db.execute({
    sql: "DELETE FROM tasks WHERE parent_task_id = ?",
    args: [parseInt(parentTaskId)],
  });
}

/** Delete a task row by id. */
export async function deleteTaskById(taskId) {
  return db.execute({
    sql: "DELETE FROM tasks WHERE id = ?",
    args: [parseInt(taskId)],
  });
}

/** Pending-assignment status update (accept → 'accepted', decline → 'declined'). */
export async function updateAssignmentStatus(status, assignmentId) {
  return db.execute({
    sql: "UPDATE task_assignments SET status = ? WHERE id = ?",
    args: [status, assignmentId],
  });
}

/** Assign a task directly to a user (accept path of the pending workflow). */
export async function assignTaskToUser(userCid, taskId) {
  return db.execute({
    sql: "UPDATE tasks SET assigned_to = ? WHERE id = ?",
    args: [userCid, taskId],
  });
}

/** Create a pending task-assignment record. */
export async function insertTaskAssignment(taskId, assignerId, assigneeId) {
  return db.execute({
    sql: "INSERT INTO task_assignments (task_id, assigner_id, assignee_id) VALUES (?, ?, ?)",
    args: [taskId, assignerId, assigneeId],
  });
}

/** Insert a v2_notifications row (is_read defaults to 0). */
export async function insertNotification(recipientId, title, message, type) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
    args: [recipientId, title, message, type],
  });
}

/** Insert a v2_notifications row with an explicit created_at (NOW()). */
export async function insertNotificationWithCreatedAt(recipientId, title, message, type) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                  VALUES (?, ?, ?, ?, 0, NOW())`,
    args: [recipientId, title, message, type],
  });
}

/** Create a project reassignment approval request (staff not yet on the project). */
export async function insertProjectApprovalRequest(taskId, requesterId, requesterName, projectId) {
  return db.execute({
    sql: `INSERT INTO project_approval_requests
                (task_id, requester_id, requester_name, project_id, status)
                VALUES (?, ?, ?, ?, 'pending')`,
    args: [taskId, requesterId, requesterName, projectId],
  });
}

/** Immutable date-change audit row (task_audit_logs, action = schedule_changed). */
export async function insertTaskAuditLog(taskId, userId, fieldName, oldValue, newValue, metadata) {
  return db.execute({
    sql: `INSERT INTO task_audit_logs
          (task_id, user_id, action, field_name, old_value, new_value, metadata)
          VALUES (?, ?, 'schedule_changed', ?, ?, ?, ?)`,
    args: [taskId, userId, fieldName, oldValue, newValue, metadata],
  });
}
