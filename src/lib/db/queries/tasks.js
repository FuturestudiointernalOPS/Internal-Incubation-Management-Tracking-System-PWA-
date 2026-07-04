import db from "@/lib/db";

/**
 * Data-access layer — tasks table.
 * Pure extraction of duplicated inline queries. SQL byte-identical to originals.
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
