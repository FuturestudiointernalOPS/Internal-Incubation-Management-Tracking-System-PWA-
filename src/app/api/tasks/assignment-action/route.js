import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { logTaskEvent, ACTION_TYPES } from "@/lib/taskAudit";
import { requireAuth } from "@/lib/auth";

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
    const taskRes = await db.execute({
      sql: "SELECT * FROM tasks WHERE id = ?",
      args: [parseInt(task_id)],
    });

    if (taskRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    const task = taskRes.rows[0];

    // Verify the user is the assigned person
    if (String(task.assigned_to) !== String(user_id)) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not the assigned person for this task",
        },
        { status: 403 },
      );
    }

    if (action === "accepted") {
      await db.execute({
        sql: "UPDATE tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [parseInt(task_id)],
      });

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
      await db.execute({
        sql: "UPDATE tasks SET assigned_to = NULL, status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [parseInt(task_id)],
      });

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
        const assignerLog = await db.execute({
          sql: `SELECT actor_id FROM task_assignment_log
                WHERE task_id = ? AND action_type = 'TASK_ASSIGNED'
                ORDER BY created_at DESC LIMIT 1`,
          args: [parseInt(task_id)],
        });
        if (assignerLog.rows.length > 0) {
          const assignerId = assignerLog.rows[0].actor_id;
          await fetch(new URL("/api/notifications", req.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient_id: assignerId,
              title: "Assignment Declined",
              message: `${user_name || user_id} declined the task "${task.title}".`,
              type: "assignment",
            }),
          });
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
      await db.execute({
        sql: "UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [parseInt(task_id)],
      });

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
