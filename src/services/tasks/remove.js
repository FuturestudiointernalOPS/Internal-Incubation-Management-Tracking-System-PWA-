/**
 * Tasks — deletion use case (SERVICE layer).
 *
 * The domain work behind DELETE /api/tasks. The CONTROLLER authenticates and
 * validates; everything below is the rule set:
 *
 *   - only the task's owner, assignee, supervisor, or Super Admin may delete it;
 *   - a locked task (older than the lock window) cannot be deleted;
 *   - a carry-over task cannot be deleted — it is a standup commitment that must
 *     be completed or resolved;
 *   - the dependants go first (blockers, subtasks), then the task; the audit is
 *     written, and the owner's standup is rebuilt (best effort).
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` (the audit/lock helpers through the
 * infra logger, an allowed dependency of the service layer).
 */

import {
  getTaskDeleteInfo,
  getTaskStandupInfo,
  deleteBlockersForTaskAndSubtasks,
  deleteSubtasksForTask,
  deleteTaskById,
} from "@/models/tasks";
import { rebuildStandupTasks } from "@/models/standupUpsert";
import { logAuditEvent, isTaskLocked } from "@/lib/audit";

/**
 * Delete a task and its dependants.
 *
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function deleteTaskRecord({ id, role, sessionCid, sessionName }) {
  // SECURITY: only the task owner, assignee, supervisor or Super Admin may delete.
  const taskCheckResult = await getTaskDeleteInfo(parseInt(id));
  if (taskCheckResult.rows.length > 0) {
    const taskRow = taskCheckResult.rows[0];
    if (
      role !== "super_admin" &&
      String(taskRow.user_id) !== String(sessionCid) &&
      String(taskRow.assigned_to || "") !== String(sessionCid) &&
      String(taskRow.supervisor_id || "") !== String(sessionCid)
    ) {
      return {
        status: 403,
        error: "You can only delete your own tasks, assigned tasks, or supervised tasks.",
      };
    }
  }

  // Locking: a locked task cannot be deleted.
  const locked = await isTaskLocked(id);
  if (locked) {
    const error = "Task is locked (older than 12 hours) and cannot be deleted.";
    return { status: 403, error, body: { success: false, error, locked: true } };
  }

  // A carry-over task is a standup commitment — it cannot be deleted.
  if (
    taskCheckResult.rows.length > 0 &&
    taskCheckResult.rows[0].status === "carried_over"
  ) {
    const error =
      "Carry-over tasks cannot be deleted. They must be completed or resolved.";
    return { status: 403, error, body: { success: false, error } };
  }

  // Capture the fields the standup rebuild needs before the row is gone.
  const taskInfo = await getTaskStandupInfo(parseInt(id));

  await deleteBlockersForTaskAndSubtasks(parseInt(id));
  await deleteSubtasksForTask(parseInt(id));
  await deleteTaskById(parseInt(id));

  if (taskInfo.rows.length > 0) {
    const task = taskInfo.rows[0];

    await logAuditEvent({
      entity_type: "task",
      entity_id: parseInt(id),
      user_id: sessionCid || task.user_id,
      user_name: sessionName || task.user_name,
      action: "deleted",
      details: `Task "${task.title}" deleted`,
      metadata: { title: task.title },
    });

    // Rebuild the owner's standup after the deletion (non-blocking).
    try {
      await rebuildStandupTasks(
        task.user_id,
        task.created_week,
        task.created_year,
      );
    } catch (error) {
      console.error("Standup rebuild failed (non-blocking):", error.message);
    }
  }

  return { status: 200, body: { success: true, action: "deleted" } };
}
