import db from "@/lib/db";

/**
 * Tasks model — task mutations (REPOSITORY layer).
 *
 * Creation, the completion/reopen lifecycle, deletions, assignment writes and
 * the notification/approval/audit inserts, split verbatim out of
 * `models/tasks.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per statement, named after the write.
 */

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
