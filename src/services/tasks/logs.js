/**
 * Tasks — assignment log use case (SERVICE layer).
 *
 * The domain work behind GET /api/tasks/logs: the immutable assignment trail of
 * a task, gated by the shared task-access rule.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  getTaskAccessById,
  getTaskAssignmentLogs,
} from "@/models/taskLifecycle";
import { canAccessTask } from "./access";

/** The assignment log of a task the caller may see. */
export async function listTaskLogs({ taskId, limit, role, sessionCid }) {
  const taskResult = await getTaskAccessById(taskId);
  const task = taskResult.rows[0];
  if (!task) return { status: 404, error: "Task not found" };
  if (!canAccessTask({ task, role, cid: sessionCid })) {
    return { status: 403, error: "You do not have access to this task." };
  }

  const result = await getTaskAssignmentLogs(taskId, limit);
  return { status: 200, body: { success: true, logs: result.rows } };
}
