import db, { initDb } from "@/lib/db";

/**
 * Audit Logger Utility
 *
 * Logs lifecycle events for tasks and blockers.
 * Designed for future Notion sync readiness.
 */

export async function logAuditEvent({
  entity_type,
  entity_id,
  user_id,
  user_name,
  action,
  details,
  metadata,
}) {
  try {
    await db.execute({
      sql: `INSERT INTO audit_log
        (entity_type, entity_id, user_id, user_name, action, details, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        entity_type,
        entity_id,
        user_id,
        user_name || "",
        action,
        details || null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    });
  } catch (e) {
    console.error("Audit log error:", e.message);
  }
}

/**
 * Check if a task is locked (older than 6 days)
 * Locked tasks cannot have their title/description modified or be deleted.
 * Status updates are still allowed.
 */
export async function isTaskLocked(taskId) {
  try {
    const result = await db.execute({
      sql: "SELECT created_at FROM tasks WHERE id = ?",
      args: [parseInt(taskId)],
    });

    if (result.rows.length === 0) return false;

    const createdAt = new Date(result.rows[0].created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
    return hoursDiff >= 144; // 6 days
  } catch (e) {
    console.error("Task lock check error:", e.message);
    return false;
  }
}
