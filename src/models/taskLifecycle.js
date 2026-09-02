import db from "@/lib/db";

/**
 * Task lifecycle model — data access for the task lifecycle controllers:
 *   - `src/app/api/tasks/approve/route.js`
 *   - `src/app/api/tasks/carryover/route.js`
 *   - `src/app/api/tasks/duplicate/route.js`
 *   - `src/app/api/tasks/logs/route.js`
 *   - `src/app/api/tasks/notify-deadlines/route.js`
 *   - `src/app/api/tasks/reconcile/route.js`
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

// ---------------------------------------------------------------------------
// Approval (api/tasks/approve) — 4 queries
// ---------------------------------------------------------------------------

/** Approve a pending_project_approval task: activate it under the project. */
export async function approveTask(reviewer_id, task_id) {
  return db.execute({
    sql: "UPDATE tasks SET status = 'pending', approved_by = ?, approved_at = NOW() WHERE id = ?",
    args: [reviewer_id, parseInt(task_id)],
  });
}

/** Mark the pending project-approval request approved. */
export async function markApprovalRequestApproved(reviewer_id, task_id) {
  return db.execute({
    sql: "UPDATE project_approval_requests SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE task_id = ? AND status = 'pending'",
    args: [reviewer_id, parseInt(task_id)],
  });
}

/** Reject a task: remove its project link and demote it to a standalone task. */
export async function rejectTaskAsStandalone(category, task_id) {
  return db.execute({
    sql: "UPDATE tasks SET status = 'pending', project_id = NULL, category = ?, approved_by = NULL WHERE id = ?",
    args: [category, parseInt(task_id)],
  });
}

/** Mark the pending project-approval request rejected, with a reason. */
export async function markApprovalRequestRejected(reviewer_id, reason, task_id) {
  return db.execute({
    sql: "UPDATE project_approval_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ? WHERE task_id = ? AND status = 'pending'",
    args: [reviewer_id, reason, parseInt(task_id)],
  });
}

// ---------------------------------------------------------------------------
// Carryover (api/tasks/carryover) — 10 queries
// ---------------------------------------------------------------------------

/**
 * Tasks that always need carryover consideration (in_progress/blocked) plus
 * carried_over tasks whose cloned copy has not been completed or archived,
 * filtered by user / week / year.
 */
export async function getCarryoverEligibleTasks(user_id, week_number, year) {
  // Fetch in_progress and blocked tasks — these always need carryover consideration.
  // For 'carried_over' tasks: only include them if their cloned copy has NOT been completed
  // or archived. This prevents completed carried-over tasks from re-appearing each week.
  let sql = `
    SELECT * FROM tasks
    WHERE status IN ('in_progress', 'blocked')
    UNION
    SELECT t.* FROM tasks t
    WHERE t.status = 'carried_over'
      AND NOT EXISTS (
        SELECT 1 FROM tasks clone
        WHERE clone.carried_over_from_task_id = t.id
          AND clone.status IN ('completed', 'archived')
      )
  `;
  const baseArgs = [];

  // Wrap with user/assigned_to/supervisor filters
  const filterClauses = [];
  const filterArgs = [];
  if (user_id) {
    filterClauses.push("(user_id = ? OR assigned_to = ? OR supervisor_id = ?)");
    filterArgs.push(user_id, user_id, user_id);
  }
  if (week_number) {
    filterClauses.push("created_week <= ?");
    filterArgs.push(parseInt(week_number));
  }
  if (year) {
    filterClauses.push("created_year = ?");
    filterArgs.push(parseInt(year));
  }

  if (filterClauses.length > 0) {
    sql = `SELECT * FROM (${sql}) AS eligible WHERE ${filterClauses.join(" AND ")} ORDER BY created_at DESC`;
  } else {
    sql = `SELECT * FROM (${sql}) AS eligible ORDER BY created_at DESC`;
  }

  const args = [...baseArgs, ...filterArgs];
  return db.execute({ sql, args });
}

/** Blockers attached to one task, newest first (carryover eligibility view). */
export async function getBlockersForTask(task_id) {
  return db.execute({
    sql: "SELECT id, title, status, severity FROM blockers WHERE task_id = ? ORDER BY created_at DESC",
    args: [task_id],
  });
}

/** Full task row by id (the carry-over source lookup). */
export async function getTaskRowById(task_id) {
  return db.execute({
    sql: "SELECT * FROM tasks WHERE id = ?",
    args: [task_id],
  });
}

/** Newest non-archived clone in a carry-over chain, by origin task id. */
export async function getLatestCarriedOverClone(task_id) {
  return db.execute({
    sql: "SELECT * FROM tasks WHERE carried_over_from_task_id = ? AND status != 'archived' ORDER BY created_week DESC, id DESC LIMIT 1",
    args: [task_id],
  });
}

/** Clone the latest task in the chain into the target week, preserving fields. */
export async function createCarriedOverClone({ user_id, user_name, target_week, target_year, sourceId, sourceTask }) {
  return db.execute({
    sql: `INSERT INTO tasks
      (user_id, user_name, title, description, status, project_id, category,
       created_week, created_year, carried_over_from_task_id,
       parent_task_id, start_date, end_date, assigned_to, link, priority,
       context_type, context_id, supervisor_id, intent_id)
      VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?,
              ?, ?, ?, ?)
      RETURNING id`,
    args: [
      user_id || sourceTask.user_id,
      user_name || sourceTask.user_name,
      sourceTask.title,
      sourceTask.description,
      sourceTask.project_id,
      sourceTask.category,
      target_week,
      target_year,
      sourceId,
      sourceTask.start_date,
      sourceTask.end_date,
      sourceTask.assigned_to || null,
      sourceTask.link || null,
      sourceTask.priority || null,
      sourceTask.context_type || "staff",
      sourceTask.context_id || null,
      sourceTask.supervisor_id || null,
      sourceTask.intent_id || null,
    ],
  });
}

/** Re-point the carried task's blockers at the new clone. */
export async function migrateBlockersToTask(newId, sourceId) {
  return db.execute({
    sql: "UPDATE blockers SET task_id = ? WHERE task_id = ?",
    args: [newId, sourceId],
  });
}

/** Re-point the carried task's comments at the new clone. */
export async function migrateCommentsToTask(newId, sourceId) {
  return db.execute({
    sql: "UPDATE v2_task_comments SET task_id = ? WHERE task_id = ?",
    args: [newId, sourceId],
  });
}

/** Re-point the carried task's resources at the new clone. */
export async function migrateResourcesToTask(newId, sourceId) {
  return db.execute({
    sql: "UPDATE task_resources SET task_id = ? WHERE task_id = ?",
    args: [newId, sourceId],
  });
}

/** Re-parent the carried task's subtasks onto the new clone. */
export async function reparentSubtasksToTask(newId, sourceId) {
  return db.execute({
    sql: "UPDATE tasks SET parent_task_id = ? WHERE parent_task_id = ?",
    args: [newId, sourceId],
  });
}

/** Mark the latest task in the chain as carried over. */
export async function markTaskCarriedOver(sourceId) {
  return db.execute({
    sql: "UPDATE tasks SET status = 'carried_over', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [sourceId],
  });
}

// ---------------------------------------------------------------------------
// Duplicate (api/tasks/duplicate) — 3 queries
// ---------------------------------------------------------------------------

/** Insert a " (Copy)" task row for the duplicated source task. */
export async function createTaskCopy(task, created_week, created_year) {
  return db.execute({
    sql: `INSERT INTO tasks
        (user_id, user_name, title, description, status, project_id, category,
         created_week, created_year, parent_task_id, start_date, end_date, assigned_to, priority, link)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
    args: [
      task.user_id,
      task.user_name || "",
      `${task.title} (Copy)`,
      task.description || null,
      "pending",
      task.project_id || null,
      task.category || null,
      created_week,
      created_year,
      null, // duplicate is never a subtask of the original parent
      task.start_date || null,
      task.end_date || null,
      task.assigned_to || null,
      task.priority || "medium",
      task.link || null,
    ],
  });
}

/** Insert a " (Copy)" row for a subtask of the duplicated task. */
export async function createSubtaskCopy(st, created_week, created_year, newTaskId) {
  return db.execute({
    sql: `INSERT INTO tasks
          (user_id, user_name, title, description, status, project_id, category,
           created_week, created_year, parent_task_id, start_date, end_date, assigned_to, priority, link)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id`,
    args: [
      st.user_id,
      st.user_name || "",
      `${st.title} (Copy)`,
      st.description || null,
      "pending",
      st.project_id || null,
      st.category || null,
      created_week,
      created_year,
      newTaskId,
      st.start_date || null,
      st.end_date || null,
      st.assigned_to || null,
      st.priority || "medium",
      st.link || null,
    ],
  });
}

/** Direct subtasks of a parent task (rows to copy when duplicating). */
export async function getSubtasksByParentId(task_id) {
  return db.execute({
    sql: "SELECT * FROM tasks WHERE parent_task_id = ?",
    args: [parseInt(task_id)],
  });
}

// ---------------------------------------------------------------------------
// Logs (api/tasks/logs) — 2 queries
// ---------------------------------------------------------------------------

/** Task row (user_id, assigned_to, supervisor_id) — log access check. */
export async function getTaskAccessById(task_id) {
  return db.execute({
    sql: "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
    args: [parseInt(task_id)],
  });
}

/** Assignment-log rows for a task, oldest first, optionally limited. */
export async function getTaskAssignmentLogs(task_id, limit) {
  let sql =
    "SELECT * FROM task_assignment_log WHERE task_id = ? ORDER BY created_at ASC";
  const args = [parseInt(task_id)];
  if (limit) {
    sql += " LIMIT ?";
    args.push(parseInt(limit));
  }

  return db.execute({ sql, args });
}

// ---------------------------------------------------------------------------
// Deadline notifications (api/tasks/notify-deadlines) — 2 queries
// ---------------------------------------------------------------------------

/** Tasks ending within the next 24h that have not been notified today. */
export async function getTasksEndingWithin24Hours() {
  return db.execute({
    sql: `SELECT t.id, t.title, t.assigned_to, t.user_id, t.user_name, t.end_date
            FROM tasks t
            WHERE t.end_date IS NOT NULL
              AND t.end_date >= NOW()
              AND t.end_date <= NOW() + INTERVAL '24 hours'
              AND t.status NOT IN ('completed', 'carried_over', 'archived')
              AND NOT EXISTS (
                SELECT 1 FROM v2_notifications n
                WHERE n.recipient_id = COALESCE(t.assigned_to, t.user_id)
                  AND n.type = 'deadline'
                  AND n.created_at > NOW() - INTERVAL '24 hours'
                  AND n.message LIKE '%' || t.id || '%'
              )`,
  });
}

/** Notification row for an upcoming deadline. */
export async function createDeadlineNotification(recipient_id, title, message, type) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read)
              VALUES (?, ?, ?, ?, 0)`,
    args: [recipient_id, title, message, type],
  });
}

// ---------------------------------------------------------------------------
// Reconcile (api/tasks/reconcile) — 2 queries
// ---------------------------------------------------------------------------

/**
 * Task row (user_id, assigned_to, supervisor_id) — reconcile ownership check.
 * Byte-identical query to getTaskAccessById; extracted separately so each
 * original inline call site maps 1:1 to a model function.
 */
export async function getTaskAccessForReconcile(id) {
  return db.execute({
    sql: "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
    args: [parseInt(id)],
  });
}

/**
 * Reconcile a task to a status; completed tasks also stamp completed_at.
 * The SET clause is assembled from the same field list as the original
 * inline query, so the produced SQL is byte-identical.
 */
export async function updateTaskReconciledStatus(status, id) {
  const updateFields = ["status = ?", "updated_at = CURRENT_TIMESTAMP"];
  const updateArgs = [status, parseInt(id)];

  if (status === "completed") {
    updateFields.push("completed_at = CURRENT_TIMESTAMP");
  }

  return db.execute({
    sql: `UPDATE tasks SET ${updateFields.join(", ")} WHERE id = ?`,
    args: updateArgs,
  });
}
