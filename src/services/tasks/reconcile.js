/**
 * Tasks — retro reconciliation use cases (SERVICE layer).
 *
 * The domain work behind POST /api/tasks/reconcile: the batch a retro submits,
 * where each task is completed, carried over or left in progress. The CONTROLLER
 * authenticates and validates; everything below is the per-task rule:
 *
 *   - the caller may only reconcile their own tasks unless they hold a portfolio
 *     role;
 *   - the status must be one of the three reconcile outcomes;
 *   - a task a caller does not own reports "Not your task" in the per-task
 *     result rather than failing the whole batch (one bad row never loses the
 *     rest);
 *   - completing a cloned task also completes its carried-over ancestors.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` (the audit trail through the infra
 * logger, which is an allowed dependency of the service layer).
 */

import {
  getTaskAccessForReconcile,
  updateTaskReconciledStatus,
} from "@/models/taskLifecycle";
import { getTaskTitleById } from "@/models/tasks";
import { completeCarryoverAncestors } from "@/models/taskCarryover";
import { logAuditEvent } from "@/lib/audit";
import {
  seesWholePortfolio,
  resolveListingScope,
} from "@/services/authorization/listingScope";

/** The only outcomes a retro reconciliation may record. */
export const RECONCILE_STATUSES = ["completed", "carried_over", "in_progress"];

const AUDIT_ACTION = {
  completed: "completed",
  carried_over: "carried_over",
  in_progress: "updated",
};

/**
 * Reconcile a batch of tasks as a retro submission.
 *
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function reconcileTasks({
  userId,
  userName,
  tasks,
  role,
  sessionCid,
}) {
  // The caller may only reconcile their own tasks unless they hold a portfolio
  // role (the shared listing-scope rule, applied as an equality check).
  const scope = resolveListingScope({
    role,
    sessionCid,
    requestedCid: userId,
    denialMessage: "You can only reconcile your own tasks.",
  });
  if (scope.denied) return { status: 403, error: scope.denied };

  const results = [];

  for (const task of tasks) {
    const { id, status } = task;

    if (!id || !status) {
      results.push({ id, success: false, error: "id and status required" });
      continue;
    }

    if (!RECONCILE_STATUSES.includes(status)) {
      results.push({ id, success: false, error: `Invalid status: ${status}` });
      continue;
    }

    // Non-portfolio users may only touch tasks they own, are assigned or
    // supervise — reported per row, not as a batch failure.
    if (!seesWholePortfolio(role)) {
      const taskResult = await getTaskAccessForReconcile(id);
      const row = taskResult.rows[0];
      if (
        !row ||
        (String(row.user_id) !== String(sessionCid) &&
          String(row.assigned_to || "") !== String(sessionCid) &&
          String(row.supervisor_id || "") !== String(sessionCid))
      ) {
        results.push({ id, success: false, error: "Not your task" });
        continue;
      }
    }

    try {
      // The current title, for the audit entry.
      const taskTitle = (await getTaskTitleById(id)) || `Task #${id}`;

      await updateTaskReconciledStatus(status, id);

      // Completing a cloned task also completes its carried-over ancestors.
      if (status === "completed") {
        await completeCarryoverAncestors(id);
      }

      await logAuditEvent({
        entity_type: "task",
        entity_id: parseInt(id),
        user_id: userId,
        user_name: userName || "",
        action: AUDIT_ACTION[status],
        details: `Task "${taskTitle}" reconciled as ${status}`,
        metadata: { status },
      });

      results.push({ id, success: true, status });
    } catch (error) {
      results.push({ id, success: false, error: error.message });
    }
  }

  return { status: 200, body: { success: true, results } };
}
