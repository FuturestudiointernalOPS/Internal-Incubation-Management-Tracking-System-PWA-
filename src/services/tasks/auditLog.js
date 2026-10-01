/**
 * TASK/BLOCKER AUDIT LOG.
 *
 * Logs lifecycle events for tasks and blockers (Notion-sync readiness) and
 * decides whether a task is locked (older than 6 days — locked tasks cannot have
 * their title/description modified or be deleted; status updates stay allowed).
 *
 * The decisions — the non-blocking write and the 6-day lock rule — live here;
 * every statement is in `@/models/taskAuditLogStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/audit` (the module it came from) — see
 * docs/LAYER_SPLIT.md.
 */

import { insertAuditLogRow, selectTaskCreatedAt } from "@/models/taskAuditLogStore";

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
    await insertAuditLogRow(
      entity_type,
      entity_id,
      user_id,
      user_name || "",
      action,
      details || null,
      metadata ? JSON.stringify(metadata) : null,
    );
  } catch (error) {
    console.error("Audit log error:", error.message);
  }
}

/**
 * Check if a task is locked (older than 6 days)
 * Locked tasks cannot have their title/description modified or be deleted.
 * Status updates are still allowed.
 */
export async function isTaskLocked(taskId) {
  try {
    const result = await selectTaskCreatedAt(parseInt(taskId));

    if (result.rows.length === 0) return false;

    const createdAt = new Date(result.rows[0].created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
    return hoursDiff >= 144; // 6 days
  } catch (error) {
    console.error("Task lock check error:", error.message);
    return false;
  }
}
