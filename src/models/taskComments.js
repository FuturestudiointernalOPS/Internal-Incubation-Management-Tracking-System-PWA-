import db from "@/lib/db";

/**
 * Task comments model — data access for the task-comments controller
 * (`src/app/api/tasks/comments/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 * Where the original handler ran the same query at two call sites, the model
 * keeps one function per call site (1:1 extraction — see docs/MVC_REFACTOR.md).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

/** Task row (user_id, assigned_to, supervisor_id) — comment-list access check. */
export async function getTaskAccessById(task_id) {
  return db.execute({
    sql: "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
    args: [parseInt(task_id)],
  });
}

/** All comments on a task (or subtask), oldest first. */
export async function getCommentsByTaskId(task_id) {
  return db.execute({
    sql: `SELECT id, task_id, sender_id, sender_name, body, parent_id, is_edited, edited_at, created_at
          FROM v2_task_comments
          WHERE task_id = ?
          ORDER BY created_at ASC`,
    args: [parseInt(task_id)],
  });
}

/**
 * Task row (user_id, assigned_to, supervisor_id) — comment-creation access check.
 * Byte-identical query to getTaskAccessById; extracted separately so each
 * original inline call site maps 1:1 to a model function.
 */
export async function getTaskAccessForCreate(task_id) {
  return db.execute({
    sql: "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
    args: [parseInt(task_id)],
  });
}

/** Insert a comment (sender is always the authenticated session user). */
export async function createComment(task_id, sender_id, sender_name, body, parent_id) {
  return db.execute({
    sql: `INSERT INTO v2_task_comments (task_id, sender_id, sender_name, body, parent_id)
          VALUES (?, ?, ?, ?, ?)
          RETURNING id, created_at`,
    args: [
      parseInt(task_id),
      sender_id,
      sender_name || "",
      body.trim(),
      parent_id || null,
    ],
  });
}

/** Task row (user_id, assigned_to, title) — fields needed to notify on a comment. */
export async function getTaskNotifyFieldsById(task_id) {
  return db.execute({
    sql: "SELECT user_id, assigned_to, title FROM tasks WHERE id = ?",
    args: [parseInt(task_id)],
  });
}

/** Insert a notification row (with created_at defaulted by the engine). */
export async function createNotification(recipient_id, title, message, type) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
              VALUES (?, ?, ?, ?, 0, NOW())`,
    args: [recipient_id, title, message, type],
  });
}

/** Contacts whose normalized name matches any of the given names (mentions). */
export async function getContactsByNames(namesArray) {
  const placeholders = namesArray.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT cid, name FROM contacts
              WHERE LOWER(TRIM(name)) IN (${placeholders})
              AND deleted = 0`,
    args: namesArray,
  });
}

/** Sender id of a comment — delete permission check. */
export async function getCommentSenderById(id) {
  return db.execute({
    sql: "SELECT sender_id FROM v2_task_comments WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Delete one comment by id. */
export async function deleteComment(id) {
  return db.execute({
    sql: "DELETE FROM v2_task_comments WHERE id = ?",
    args: [parseInt(id)],
  });
}

/**
 * Sender id of a comment — edit permission check.
 * Byte-identical query to getCommentSenderById; extracted separately so each
 * original inline call site maps 1:1 to a model function.
 */
export async function getCommentSenderForEdit(id) {
  return db.execute({
    sql: "SELECT sender_id FROM v2_task_comments WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Rewrite a comment's body and flag it as edited. */
export async function updateCommentBody(id, newBody) {
  return db.execute({
    sql: "UPDATE v2_task_comments SET body = ?, is_edited = 1, edited_at = NOW() WHERE id = ?",
    args: [newBody.trim(), parseInt(id)],
  });
}
