/**
 * Tasks — duplication use case (SERVICE layer).
 *
 * The domain work behind POST /api/tasks/duplicate: copy a task (title suffixed
 * with " (Copy)", status reset to pending) and its subtasks, stamped with the
 * current week/year so the copy lands in the caller's current standup week.
 *
 * The CONTROLLER authenticates and validates; the access rule and the copy
 * order live here.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import { getTaskById } from "@/models/tasks";
import {
  createTaskCopy,
  getSubtasksByParentId,
  createSubtaskCopy,
} from "@/models/taskLifecycle";
import { canAccessTask } from "./access";

/** ISO week number for a date (copied verbatim from the original controller). */
function getWeekNumber(date) {
  const targetDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = targetDate.getUTCDay() || 7;
  targetDate.setUTCDate(targetDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(targetDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((targetDate - yearStart) / 86400000 + 1) / 7);
}

/**
 * Duplicate a task (and its subtasks) into the current week.
 *
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function duplicateTask({ taskId, role, sessionCid }) {
  const task = await getTaskById(taskId);
  if (!task) return { status: 404, error: "Task not found" };
  if (!canAccessTask({ task, role, cid: sessionCid })) {
    return {
      status: 403,
      error: "You do not have permission to duplicate this task.",
    };
  }

  const now = new Date();
  const created_week = getWeekNumber(now);
  const created_year = now.getFullYear();

  const result = await createTaskCopy(task, created_week, created_year);
  const newTaskId = result.rows[0]?.id ?? result.lastInsertRowid;

  // Copy the subtasks too, so a duplicated parent is not left childless.
  const subtasks = await getSubtasksByParentId(taskId);
  for (const subtask of subtasks.rows) {
    await createSubtaskCopy(subtask, created_week, created_year, newTaskId);
  }

  const newTask = await getTaskById(newTaskId);
  return { status: 200, body: { success: true, task: newTask || null } };
}
