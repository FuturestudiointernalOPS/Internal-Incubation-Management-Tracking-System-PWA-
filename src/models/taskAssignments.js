import db from "@/lib/db";

/**
 * Task assignments model — data access for the task-assignment controllers
 * (`src/app/api/tasks/assignments/route.js` and
 * `src/app/api/tasks/assignment-action/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 * Where the original handlers ran the same query at multiple call sites, the
 * model keeps one function per call site (1:1 extraction —
 * see docs/MVC_REFACTOR.md).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

/** Assignments (with task title/project and assigner name), optional filters. */
export async function getAssignments(assignee_id, status) {
  let sql =
    "SELECT ta.*, t.title as task_title, t.project_id, c.name AS assigner_name FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id LEFT JOIN contacts c ON c.cid = ta.assigner_id WHERE 1=1";
  const args = [];
  if (assignee_id) {
    sql += " AND ta.assignee_id = ?";
    args.push(assignee_id);
  }
  if (status) {
    sql += " AND ta.status = ?";
    args.push(status);
  }
  sql += " ORDER BY ta.created_at DESC";

  return db.execute({ sql, args });
}

/** Full assignment row by id. */
export async function getAssignmentById(assignment_id) {
  return db.execute({
    sql: "SELECT * FROM task_assignments WHERE id = ?",
    args: [parseInt(assignment_id)],
  });
}

/** Task fields (title, project, week/year) used when acting on an assignment. */
export async function getTaskAssignmentMeta(task_id) {
  return db.execute({
    sql: "SELECT title, project_id, created_week, created_year FROM tasks WHERE id = ?",
    args: [task_id],
  });
}

/** Mark an assignment declined (responded_at set by the engine). */
export async function declineAssignment(assignment_id) {
  return db.execute({
    sql: "UPDATE task_assignments SET status = 'declined', responded_at = NOW() WHERE id = ?",
    args: [parseInt(assignment_id)],
  });
}

/** Notification row for an assignment decline. */
export async function createAssignmentDeclinedNotification(recipient_id, title, message, type) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
    args: [recipient_id, title, message, type],
  });
}

/** Mark an assignment accepted (responded_at set by the engine). */
export async function acceptAssignment(assignment_id) {
  return db.execute({
    sql: "UPDATE task_assignments SET status = 'accepted', responded_at = NOW() WHERE id = ?",
    args: [parseInt(assignment_id)],
  });
}

/** Point a task at its current assignee. */
export async function updateTaskAssignedTo(assignee_id, task_id) {
  return db.execute({
    sql: "UPDATE tasks SET assigned_to = ? WHERE id = ?",
    args: [assignee_id, task_id],
  });
}

/** Contact name/role by cid (assignee profile for standup sync). */
export async function getContactById(cid) {
  return db.execute({
    sql: "SELECT name, role FROM contacts WHERE cid = ? LIMIT 1",
    args: [cid],
  });
}

/**
 * Notification row for an assignment acceptance.
 * Byte-identical query to createAssignmentDeclinedNotification; extracted
 * separately so each original inline call site maps 1:1 to a model function.
 */
export async function createAssignmentAcceptedNotification(recipient_id, title, message, type) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
    args: [recipient_id, title, message, type],
  });
}

/** Task context (venture/team fields) used for contact-group checks. */
export async function getTaskAssignmentContext(task_id) {
  return db.execute({
    sql: "SELECT context_type, context_id FROM tasks WHERE id = ?",
    args: [task_id],
  });
}

/**
 * Mark a pending assignment declined when it is replaced by a reassignment.
 * Byte-identical query to declineAssignment; extracted separately so each
 * original inline call site maps 1:1 to a model function.
 */
export async function declineAssignmentForReassign(assignment_id) {
  return db.execute({
    sql: "UPDATE task_assignments SET status = 'declined', responded_at = NOW() WHERE id = ?",
    args: [parseInt(assignment_id)],
  });
}

/** Unassign a task (used when an accepted assignment is reassigned). */
export async function clearTaskAssignee(task_id) {
  return db.execute({
    sql: "UPDATE tasks SET assigned_to = NULL WHERE id = ?",
    args: [task_id],
  });
}

/** Insert a new pending assignment for the new assignee. */
export async function createAssignment(task_id, assigner_id, assignee_id) {
  return db.execute({
    sql: "INSERT INTO task_assignments (task_id, assigner_id, assignee_id) VALUES (?, ?, ?)",
    args: [task_id, assigner_id, assignee_id],
  });
}

/**
 * Notification row for a reassigned assignment.
 * Byte-identical query to createAssignmentDeclinedNotification; extracted
 * separately so each original inline call site maps 1:1 to a model function.
 */
export async function createAssignmentReassignedNotification(recipient_id, title, message, type) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
    args: [recipient_id, title, message, type],
  });
}

/** Move an accepted task into in_progress (assignment-action). */
export async function markTaskAccepted(task_id) {
  return db.execute({
    sql: "UPDATE tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [parseInt(task_id)],
  });
}

/** Clear a declined task back to unassigned pending (assignment-action). */
export async function markTaskDeclined(task_id) {
  return db.execute({
    sql: "UPDATE tasks SET assigned_to = NULL, status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [parseInt(task_id)],
  });
}

/** Most recent assigner for a task (from the immutable assignment log). */
export async function getTaskAssignerFromLog(task_id) {
  return db.execute({
    sql: `SELECT actor_id FROM task_assignment_log
                WHERE task_id = ? AND action_type = 'TASK_ASSIGNED'
                ORDER BY created_at DESC LIMIT 1`,
    args: [parseInt(task_id)],
  });
}

/** Notification row (created_at defaulted) for a declined task assignment. */
export async function createDeclineNotification(recipient_id, title, message, type) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                  VALUES (?, ?, ?, ?, 0, NOW())`,
    args: [recipient_id, title, message, type],
  });
}

/** Complete a task that was finished via its assignment (assignment-action). */
export async function markTaskCompleted(task_id) {
  return db.execute({
    sql: "UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [parseInt(task_id)],
  });
}
