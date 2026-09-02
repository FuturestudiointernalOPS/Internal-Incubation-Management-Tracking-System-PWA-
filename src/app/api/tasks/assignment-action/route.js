import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { logTaskEvent, ACTION_TYPES } from "@/lib/taskAudit";
import { requireAuth, getSession } from "@/lib/auth";
import { getTaskById } from "@/lib/db/queries/tasks";
import { completeCarryoverAncestors } from "@/lib/taskCarryover";
import {
  markTaskAccepted,
  markTaskDeclined,
  getTaskAssignerFromLog,
  createDeclineNotification,
  markTaskCompleted,
} from "@/models/taskAssignments";

/**
 * ASSIGNMENT ACTION API
 *
 * POST /api/tasks/assignment-action
 *
 * Allows a user to accept or decline a task assignment.
 *
 * Body:
 *   task_id: number  — the task being accepted/declined
 *   user_id: string  — the user taking the action
 *   user_name: string — optional display name
 *   action: "accepted" | "declined" | "completed_assignment"
 *
 * Flow:
 *   accepted            → task stays assigned, status set to in_progress
 *   declined            → assigned_to cleared, status set to pending
 *   completed_assignment → task stays assigned, status set to completed
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { task_id, user_id, user_name, action } = await req.json();

    if (!task_id || !user_id || !action) {
      return NextResponse.json(
        {
          success: false,
          error: "task_id, user_id, and action are required",
        },
        { status: 400 },
      );
    }

    if (!["accepted", "declined", "completed_assignment"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "action must be one of: accepted, declined, completed_assignment",
        },
        { status: 400 },
      );
    }

    // Fetch the task
    const task = await getTaskById(task_id);

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    // Verify the authenticated user is the assigned person
    const session = await getSession();
    if (String(task.assigned_to) !== String(session.cid)) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not the assigned person for this task",
        },
        { status: 403 },
      );
    }

    if (action === "accepted") {
      await markTaskAccepted(task_id);

      // Audit log
      await logAuditEvent({
        entity_type: "task",
        entity_id: parseInt(task_id),
        user_id,
        user_name: user_name || "",
        action: "assignment_accepted",
        details: `Assignment accepted for task "${task.title}"`,
        metadata: { title: task.title, task_id },
      });

      // Immutable audit trail
      await logTaskEvent({
        task_id: parseInt(task_id),
        project_id: task.project_id,
        actor_id: user_id,
        target_user_id: user_id,
        action_type: ACTION_TYPES.TASK_ACCEPTED,
        previous_state: { status: task.status, assigned_to: task.assigned_to },
        new_state: { status: "in_progress", assigned_to: user_id },
        description: `Task "${task.title}" accepted by ${user_name || user_id}`,
      });

      return NextResponse.json({
        success: true,
        action: "accepted",
        message: "Task accepted and moved to in_progress",
      });
    }

    if (action === "declined") {
      await markTaskDeclined(task_id);

      // Audit log
      await logAuditEvent({
        entity_type: "task",
        entity_id: parseInt(task_id),
        user_id,
        user_name: user_name || "",
        action: "assignment_declined",
        details: `Assignment declined for task "${task.title}"`,
        metadata: { title: task.title, task_id },
      });

      // Immutable audit trail
      await logTaskEvent({
        task_id: parseInt(task_id),
        project_id: task.project_id,
        actor_id: user_id,
        target_user_id: user_id,
        action_type: ACTION_TYPES.TASK_UPDATED,
        previous_state: { status: task.status, assigned_to: task.assigned_to },
        new_state: { status: "pending", assigned_to: null },
        description: `Task "${task.title}" declined by ${user_name || user_id}`,
      });

      // Notify the original assigner (if known via audit log)
      try {
        const assignerLog = await getTaskAssignerFromLog(task_id);
        if (assignerLog.rows.length > 0) {
          const assignerId = assignerLog.rows[0].actor_id;
          await createDeclineNotification(
            assignerId,
            "Assignment Declined",
            `${user_name || user_id} declined the task "${task.title}".`,
            "assignment",
          );
        }
      } catch (notifErr) {
        console.error("Decline notification failed:", notifErr.message);
      }

      return NextResponse.json({
        success: true,
        action: "declined",
        message: "Task declined and assignment cleared",
      });
    }

    if (action === "completed_assignment") {
      await markTaskCompleted(task_id);

      // Completing a cloned task must also complete its carried-over ancestors
      await completeCarryoverAncestors(task_id);

      // Audit log
      await logAuditEvent({
        entity_type: "task",
        entity_id: parseInt(task_id),
        user_id,
        user_name: user_name || "",
        action: "completed",
        details: `Assigned task "${task.title}" completed`,
        metadata: { title: task.title, task_id },
      });

      await logTaskEvent({
        task_id: parseInt(task_id),
        project_id: task.project_id,
        actor_id: user_id,
        target_user_id: user_id,
        action_type: ACTION_TYPES.TASK_COMPLETED,
        previous_state: { status: task.status, assigned_to: task.assigned_to },
        new_state: { status: "completed", assigned_to: user_id },
        description: `Assigned task "${task.title}" completed by ${user_name || user_id}`,
      });

      return NextResponse.json({
        success: true,
        action: "completed",
        message: "Task marked as completed",
      });
    }
  } catch (error) {
    console.error("POST assignment-action error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
