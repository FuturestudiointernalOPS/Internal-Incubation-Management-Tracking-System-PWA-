/**
 * Task/blocker audit log — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/tasks/auditLog`: the lifecycle-event insert
 * and the task creation-time read the lock check uses.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/audit.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** Append one audit_log row. */
export function insertAuditLogRow(entityType, entityId, userId, userName, action, details, metadataJson) {
  return db.execute({
    sql: `INSERT INTO audit_log
        (entity_type, entity_id, user_id, user_name, action, details, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [entityType, entityId, userId, userName, action, details, metadataJson],
  });
}

/** The creation timestamp of a task. */
export function selectTaskCreatedAt(taskId) {
  return db.execute({
    sql: "SELECT created_at FROM tasks WHERE id = ?",
    args: [taskId],
  });
}
