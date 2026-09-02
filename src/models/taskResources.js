import db from "@/lib/db";

/**
 * Task resources model — data access for the task-resources controller
 * (`src/app/api/tasks/resources/route.js`).
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

/** Task row (user_id, assigned_to, supervisor_id) — resource-create access check. */
export async function getTaskAccessById(task_id) {
  return db.execute({
    sql: "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
    args: [parseInt(task_id)],
  });
}

/** Insert a task resource (link or file), returning the new id. */
export async function createResource(task_id, name, url, type, file_name, file_size, uploaded_by) {
  return db.execute({
    sql: `INSERT INTO task_resources (task_id, name, url, type, file_name, file_size, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      parseInt(task_id),
      name || null,
      url,
      type || "url",
      file_name || null,
      file_size || null,
      uploaded_by || null,
    ],
  });
}

/** Owning task id of a resource — delete access check. */
export async function getResourceById(id) {
  return db.execute({
    sql: "SELECT task_id FROM task_resources WHERE id = ?",
    args: [parseInt(id)],
  });
}

/**
 * Task row (user_id, assigned_to, supervisor_id) — resource-delete access check.
 * Byte-identical query to getTaskAccessById; extracted separately so each
 * original inline call site maps 1:1 to a model function.
 */
export async function getTaskAccessForDelete(task_id) {
  return db.execute({
    sql: "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
    args: [parseInt(task_id)],
  });
}

/** Delete one task resource by id. */
export async function deleteResource(id) {
  return db.execute({
    sql: `DELETE FROM task_resources WHERE id = ?`,
    args: [parseInt(id)],
  });
}
