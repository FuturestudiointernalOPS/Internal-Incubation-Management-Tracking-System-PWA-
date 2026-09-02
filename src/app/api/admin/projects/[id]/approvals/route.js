import { initDb } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getTaskTitleById } from "@/lib/db/queries/tasks";
import {
  getProjectApprovalRequests,
  getProjectApprovalRequestById,
  updateProjectApprovalRequestStatus,
  linkTaskToProject,
  createApprovalApprovedNotification,
  createApprovalRejectedNotification,
} from "@/models/projects";

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
    const authError = await requireProjectAccess(id);
    if (authError) return authError;

    let result;
    try {
      result = await getProjectApprovalRequests(id);
    } catch (e) {
      console.error("GET project approvals query failed:", e.message);
      return NextResponse.json({ success: true, requests: [] });
    }

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
    const { id } = await params;
    const authError = await requireProjectAccess(id);
    if (authError) return authError;
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
    const requestRes = await getProjectApprovalRequestById(request_id);

    if (requestRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Approval request not found" },
        { status: 404 },
      );
    }

    const approvalRequest = requestRes.rows[0];

    // Update the request status
    try {
      await updateProjectApprovalRequestStatus(
        action,
        reviewer_id,
        rejection_reason,
        request_id,
      );
    } catch (e) {
      console.error("Failed to update project_approval_request:", e.message);
      return NextResponse.json(
        { success: false, error: "Approval workflow not available in this schema" },
        { status: 200 },
      );
    }

    if (action === "approved") {
      // Update the task to link it to the project and set active status
      await linkTaskToProject(approvalRequest.project_id, approvalRequest.task_id);

      // Notify the requester
      try {
        const taskTitle =
          (await getTaskTitleById(approvalRequest.task_id)) || "Task";

        await createApprovalApprovedNotification(
          approvalRequest.requester_id,
          "Project Contribution Approved",
          `Your contribution to link "${taskTitle}" was approved by ${reviewer_name || reviewer_id}.`,
          "approval",
        );
      } catch (notifErr) {
        console.error("Approval notification failed:", notifErr.message);
      }
    } else {
      // Rejected — notify the requester with reason
      try {
        const taskTitle =
          (await getTaskTitleById(approvalRequest.task_id)) || "Task";

        await createApprovalRejectedNotification(
          approvalRequest.requester_id,
          "Project Contribution Declined",
          `Your request to link "${taskTitle}" was declined. Reason: ${rejection_reason}`,
          "approval",
        );
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
