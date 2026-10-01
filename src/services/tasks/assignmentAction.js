/**
 * Tasks — assignment action use cases (SERVICE layer).
 *
 * The domain work behind POST /api/tasks/assignment-action: the assigned person
 * accepting, declining or completing their assignment.
 *
 * The CONTROLLER authenticates and validates the action name; everything below
 * is the rule set:
 *
 *   - only the person the task is assigned to may act on it;
 *   - accepted            → task stays assigned, status becomes in_progress;
 *   - declined            → assignment cleared, status back to pending, and the
 *                           original assigner is notified;
 *   - completed_assignment → task completed, and its carried-over ancestors too.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` (the audit trail through the infra
 * logger, an allowed dependency of the service layer).
 */

import { getTaskById } from "@/models/tasks";
import { logAuditEvent } from "@/lib/audit";
import { logTaskEvent, ACTION_TYPES } from "@/models/taskAudit";
import { completeCarryoverAncestors } from "@/models/taskCarryover";
import {
  markTaskAccepted,
  markTaskDeclined,
  getTaskAssignerFromLog,
  createDeclineNotification,
  markTaskCompleted,
} from "@/models/taskAssignments";

/**
 * Apply the assigned person's decision to a task.
 *
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function applyAssignmentAction({
  taskId,
  userId,
  userName,
  action,
  sessionCid,
}) {
  const task = await getTaskById(taskId);

  if (!task) {
    return { status: 404, error: "Task not found" };
  }

  // Only the assigned person may act.
  if (String(task.assigned_to) !== String(sessionCid)) {
    return {
      status: 403,
      error: "You are not the assigned person for this task",
    };
  }

  if (action === "accepted") {
    await markTaskAccepted(taskId);

    await logAuditEvent({
      entity_type: "task",
      entity_id: parseInt(taskId),
      user_id: userId,
      user_name: userName || "",
      action: "assignment_accepted",
      details: `Assignment accepted for task "${task.title}"`,
      metadata: { title: task.title, task_id: taskId },
    });

    await logTaskEvent({
      task_id: parseInt(taskId),
      project_id: task.project_id,
      actor_id: userId,
      target_user_id: userId,
      action_type: ACTION_TYPES.TASK_ACCEPTED,
      previous_state: { status: task.status, assigned_to: task.assigned_to },
      new_state: { status: "in_progress", assigned_to: userId },
      description: `Task "${task.title}" accepted by ${userName || userId}`,
    });

    return {
      status: 200,
      body: {
        success: true,
        action: "accepted",
        message: "Task accepted and moved to in_progress",
      },
    };
  }

  if (action === "declined") {
    await markTaskDeclined(taskId);

    await logAuditEvent({
      entity_type: "task",
      entity_id: parseInt(taskId),
      user_id: userId,
      user_name: userName || "",
      action: "assignment_declined",
      details: `Assignment declined for task "${task.title}"`,
      metadata: { title: task.title, task_id: taskId },
    });

    await logTaskEvent({
      task_id: parseInt(taskId),
      project_id: task.project_id,
      actor_id: userId,
      target_user_id: userId,
      action_type: ACTION_TYPES.TASK_UPDATED,
      previous_state: { status: task.status, assigned_to: task.assigned_to },
      new_state: { status: "pending", assigned_to: null },
      description: `Task "${task.title}" declined by ${userName || userId}`,
    });

    // Notify the original assigner when the assignment log still knows them.
    try {
      const assignerLog = await getTaskAssignerFromLog(taskId);
      if (assignerLog.rows.length > 0) {
        const assignerId = assignerLog.rows[0].actor_id;
        await createDeclineNotification(
          assignerId,
          "Assignment Declined",
          `${userName || userId} declined the task "${task.title}".`,
          "assignment",
        );
      }
    } catch (notifErr) {
      console.error("Decline notification failed:", notifErr.message);
    }

    return {
      status: 200,
      body: {
        success: true,
        action: "declined",
        message: "Task declined and assignment cleared",
      },
    };
  }

  if (action === "completed_assignment") {
    await markTaskCompleted(taskId);

    // Completing a cloned task also completes its carried-over ancestors.
    await completeCarryoverAncestors(taskId);

    await logAuditEvent({
      entity_type: "task",
      entity_id: parseInt(taskId),
      user_id: userId,
      user_name: userName || "",
      action: "completed",
      details: `Assigned task "${task.title}" completed`,
      metadata: { title: task.title, task_id: taskId },
    });

    await logTaskEvent({
      task_id: parseInt(taskId),
      project_id: task.project_id,
      actor_id: userId,
      target_user_id: userId,
      action_type: ACTION_TYPES.TASK_COMPLETED,
      previous_state: { status: task.status, assigned_to: task.assigned_to },
      new_state: { status: "completed", assigned_to: userId },
      description: `Assigned task "${task.title}" completed by ${userName || userId}`,
    });

    return {
      status: 200,
      body: { success: true, action: "completed", message: "Task marked as completed" },
    };
  }

  return { status: 400, error: "Invalid action" };
}
