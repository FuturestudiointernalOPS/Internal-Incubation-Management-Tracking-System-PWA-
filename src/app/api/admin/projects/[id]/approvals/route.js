import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * PROJECT APPROVALS API
 *
 * GET  /api/admin/projects/[id]/approvals
 *   - Returns all pending and historical approval requests for this project
 *
 * POST /api/admin/projects/[id]/approvals
 *   - Approve or reject a contribution request
 *
 * Body (POST):
 *   request_id: number  — the ID from project_approval_requests
 *   reviewer_id: string — the project owner / reviewer
 *   reviewer_name: string — display name
 *   action: "approved" | "rejected"
 *   rejection_reason: string (required if rejected)
 */

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const result = await db.execute({
      sql: `SELECT par.*, c.name AS requester_name_lookup, t.title AS task_title
            FROM project_approval_requests par
            LEFT JOIN contacts c ON par.requester_id = c.cid OR par.requester_id = c.id
            LEFT JOIN tasks t ON par.task_id = t.id
            WHERE par.project_id::text = ?
            ORDER BY par.created_at DESC`,
      args: [id],
    });

    return NextResponse.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error("GET project approvals error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const { request_id, reviewer_id, reviewer_name, action, rejection_reason } =
      await req.json();

    if (!request_id || !reviewer_id || !action) {
      return NextResponse.json(
        {
          success: false,
          error: "request_id, reviewer_id, and action are required",
        },
        { status: 400 },
      );
    }

    if (!["approved", "rejected"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: "action must be 'approved' or 'rejected'",
        },
        { status: 400 },
      );
    }

    if (action === "rejected" && !rejection_reason) {
      return NextResponse.json(
        {
          success: false,
          error: "rejection_reason is required when rejecting",
        },
        { status: 400 },
      );
    }

    // Fetch the request
    const requestRes = await db.execute({
      sql: "SELECT * FROM project_approval_requests WHERE id = ?",
      args: [parseInt(request_id)],
    });

    if (requestRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Approval request not found" },
        { status: 404 },
      );
    }

    const approvalRequest = requestRes.rows[0];

    // Update the request status
    await db.execute({
      sql: `UPDATE project_approval_requests
            SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
            WHERE id = ?`,
      args: [
        action,
        reviewer_id,
        action === "rejected" ? rejection_reason : null,
        parseInt(request_id),
      ],
    });

    if (action === "approved") {
      // Update the task to link it to the project and set active status
      await db.execute({
        sql: "UPDATE tasks SET project_id = ?, status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [approvalRequest.project_id, approvalRequest.task_id],
      });

      // Notify the requester
      try {
        const taskRes = await db.execute({
          sql: "SELECT title FROM tasks WHERE id = ?",
          args: [approvalRequest.task_id],
        });
        const taskTitle = taskRes.rows[0]?.title || "Task";

        await fetch(new URL("/api/notifications", req.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_id: approvalRequest.requester_id,
            title: "Project Contribution Approved",
            message: `Your contribution to link "${taskTitle}" was approved by ${reviewer_name || reviewer_id}.`,
            type: "approval",
          }),
        });
      } catch (notifErr) {
        console.error("Approval notification failed:", notifErr.message);
      }
    } else {
      // Rejected — notify the requester with reason
      try {
        const taskRes = await db.execute({
          sql: "SELECT title FROM tasks WHERE id = ?",
          args: [approvalRequest.task_id],
        });
        const taskTitle = taskRes.rows[0]?.title || "Task";

        await fetch(new URL("/api/notifications", req.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_id: approvalRequest.requester_id,
            title: "Project Contribution Declined",
            message: `Your request to link "${taskTitle}" was declined. Reason: ${rejection_reason}`,
            type: "approval",
          }),
        });
      } catch (notifErr) {
        console.error("Rejection notification failed:", notifErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      action,
      message:
        action === "approved"
          ? "Contribution approved. Task is now linked to the project."
          : "Contribution declined. Requester has been notified.",
    });
  } catch (error) {
    console.error("POST project approvals error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
