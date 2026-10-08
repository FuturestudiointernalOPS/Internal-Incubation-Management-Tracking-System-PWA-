import db from "@/lib/db";

/**
 * Projects model — contribution approval reads and decisions (REPOSITORY layer).
 *
 * Approval-request reads, the reviewer decision write, task linking and the
 * requester notifications, split verbatim out of `models/projects.js` — see
 * docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

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
