/**
 * Audit Logger — facade over `@/services/tasks/auditLog`.
 *
 * Logs lifecycle events for tasks and blockers (Notion-sync readiness) and the
 * task lock check. The decisions and statements moved to the tasks service and
 * `@/models/taskAuditLogStore`; this module re-exports them so existing importers
 * keep working (see docs/LAYER_SPLIT.md).
 *
 * New code should import from `@/services/tasks/auditLog` directly.
 */

export { logAuditEvent, isTaskLocked } from "@/services/tasks/auditLog";
