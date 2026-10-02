/**
 * Tasks — approval use cases (SERVICE layer).
 *
 * The domain work behind POST /api/tasks/approve. The CONTROLLER authenticates
 * (Super Admin only) and validates; everything below is what a review DOES:
 * approve links the pending task to its project, reject turns it into a
 * standalone task, and the audit trail records the decision.
 *
 * The schema-drift branch is preserved: if the approval-request table is not
 * there, the write is reported as "workflow not available" (HTTP 200) rather
 * than an error — the task change itself already went through.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` (the audit trail through the infra
 * logger, which is an allowed dependency of the service layer).
 */

import { getTaskById } from "@/models/tasks";
import {
  approveTask,
  markApprovalRequestApproved,
  rejectTaskAsStandalone,
  markApprovalRequestRejected,
} from "@/models/taskLifecycle";
import { logAuditEvent } from "@/services/tasks/auditLog";

/**
 * Approve or reject a task that is pending project approval.
 *
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function reviewTaskApproval({
  taskId,
  action,
  reviewerId,
  reviewerName,
  reason,
}) {
  const task = await getTaskById(taskId);

  if (!task) {
    return { status: 404, error: "Task not found." };
  }

  if (task.status !== "pending_project_approval") {
    return { status: 400, error: "Task is not pending approval." };
  }

  if (action === "approve") {
    // Set the task to active/pending under the project, then record the request.
    await approveTask(reviewerId, taskId);

    try {
      await markApprovalRequestApproved(reviewerId, taskId);
    } catch (error) {
      console.error(
        "Failed to update project_approval_request (approve):",
        error.message,
      );
      return {
        status: 200,
        body: {
          success: false,
          error: "Approval workflow not available in this schema",
        },
      };
    }
  } else {
    // Reject — remove project_id, set as standalone (category depends on reason).
    await rejectTaskAsStandalone(reason ? "rejected" : "other", taskId);

    try {
      await markApprovalRequestRejected(
        reviewerId,
        reason || "No reason provided",
        taskId,
      );
    } catch (error) {
      console.error(
        "Failed to update project_approval_request (reject):",
        error.message,
      );
      return {
        status: 200,
        body: {
          success: false,
          error: "Approval workflow not available in this schema",
        },
      };
    }
  }

  const verb = action === "approve" ? "approved" : "rejected";
  await logAuditEvent({
    entity_type: "task",
    entity_id: parseInt(taskId),
    user_id: reviewerId,
    user_name: reviewerName || "",
    action: verb,
    details: `Task "${task.title}" ${verb} by ${reviewerName || reviewerId}${reason ? `: ${reason}` : ""}`,
    metadata: {
      title: task.title,
      action,
      project_id: task.project_id,
      reviewer_id: reviewerId,
      reason: reason || null,
    },
  });

  return {
    status: 200,
    body: { success: true, action, taskId: parseInt(taskId) },
  };
}
