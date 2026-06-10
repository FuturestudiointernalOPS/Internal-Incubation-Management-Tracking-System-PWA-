import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";

/**
 * TASK APPROVAL API
 *
 * POST /api/tasks/approve
 *   Body: { task_id, reviewer_id, reviewer_name }
 *   Approves a pending_project_approval task — links it to the requested project
 *
 * POST /api/tasks/reject
 *   Body: { task_id, reviewer_id, reviewer_name, reason }
 *   Rejects — converts task to standalone (removes project_id, sets category)
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const body = await req.json();
    const { task_id, reviewer_id, reviewer_name, action, reason } = body;

    if (!task_id || !reviewer_id || !action) {
      return NextResponse.json(
        {
          success: false,
          error: "task_id, reviewer_id, and action are required.",
        },
        { status: 400 },
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "action must be 'approve' or 'reject'." },
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
        { success: false, error: "Task not found." },
        { status: 404 },
      );
    }

    const task = taskRes.rows[0];

    if (task.status !== "pending_project_approval") {
      return NextResponse.json(
        { success: false, error: "Task is not pending approval." },
        { status: 400 },
      );
    }

    if (action === "approve") {
      // Set task to active/pending under the project
      await db.execute({
        sql: "UPDATE tasks SET status = 'pending', approved_by = ?, approved_at = NOW() WHERE id = ?",
        args: [reviewer_id, parseInt(task_id)],
      });

      // Update approval request
      await db.execute({
        sql: "UPDATE project_approval_requests SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE task_id = ? AND status = 'pending'",
        args: [reviewer_id, parseInt(task_id)],
      });
    } else {
      // Reject — remove project_id, set as standalone with 'other' category
      await db.execute({
        sql: "UPDATE tasks SET status = 'pending', project_id = NULL, category = ?, approved_by = NULL WHERE id = ?",
        args: [reason ? "rejected" : "other", parseInt(task_id)],
      });

      // Update approval request
      await db.execute({
        sql: "UPDATE project_approval_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ? WHERE task_id = ? AND status = 'pending'",
        args: [reviewer_id, reason || "No reason provided", parseInt(task_id)],
      });
    }

    // Audit log
    await logAuditEvent({
      entity_type: "task",
      entity_id: parseInt(task_id),
      user_id: reviewer_id,
      user_name: reviewer_name || "",
      action: action === "approve" ? "approved" : "rejected",
      details: `Task "${task.title}" ${action === "approve" ? "approved" : "rejected"} by ${reviewer_name || reviewer_id}${reason ? `: ${reason}` : ""}`,
      metadata: {
        title: task.title,
        action,
        project_id: task.project_id,
        reviewer_id,
        reason: reason || null,
      },
    });

    return NextResponse.json({
      success: true,
      action,
      taskId: parseInt(task_id),
    });
  } catch (error) {
    console.error("POST tasks/approve error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
