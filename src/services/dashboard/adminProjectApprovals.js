/**
 * Admin project approvals — the contribution review workflow (SERVICE layer).
 *
 * The work behind `GET`/`POST /api/admin/projects/[id]/approvals`: the tolerant
 * read, the input validation, the object-level authorization (the request must
 * belong to the project in the URL), the approve/reject write, the task linking
 * and the requester notification.
 *
 * HTTP-free: it reads and writes through `@/models/projects` and reads the task
 * title through `@/lib/db/queries/tasks`; answers `{ status, body }`. The
 * controller keeps `initDb`, the project-scope guard and the envelope.
 */

import { getTaskTitleById } from "@/lib/db/queries/tasks";
import {
  createApprovalApprovedNotification,
  createApprovalRejectedNotification,
  getProjectApprovalRequestById,
  getProjectApprovalRequests,
  linkTaskToProject,
  updateProjectApprovalRequestStatus,
} from "@/models/projects";

/** All pending and historical approval requests for a project. */
export async function listApprovals(projectId) {
  let result;
  try {
    result = await getProjectApprovalRequests(projectId);
  } catch (error) {
    console.error("GET project approvals query failed:", error.message);
    return { status: 200, body: { success: true, requests: [] } };
  }
  return { status: 200, body: { success: true, requests: result.rows } };
}

const badRequest = (error) => ({
  status: 400,
  body: { success: false, error },
});

/** Approve or reject a contribution request. */
export async function reviewApproval({
  projectId,
  requestId,
  reviewerId,
  reviewerName,
  action,
  rejectionReason,
}) {
  if (!requestId || !reviewerId || !action) {
    return badRequest("request_id, reviewer_id, and action are required");
  }
  if (!["approved", "rejected"].includes(action)) {
    return badRequest("action must be 'approved' or 'rejected'");
  }
  if (action === "rejected" && !rejectionReason) {
    return badRequest("rejection_reason is required when rejecting");
  }

  const requestResult = await getProjectApprovalRequestById(requestId);
  if (requestResult.rows.length === 0) {
    return {
      status: 404,
      body: { success: false, error: "Approval request not found" },
    };
  }

  const approvalRequest = requestResult.rows[0];

  // Object-level authorization: the request id comes from the body, so it must
  // belong to the project in the URL — otherwise a member of one project could
  // approve or reject another project's contribution by supplying its id.
  if (String(approvalRequest.project_id) !== String(projectId)) {
    return { status: 404, body: { success: false, error: "errors.notFound" } };
  }

  try {
    await updateProjectApprovalRequestStatus(
      action,
      reviewerId,
      rejectionReason,
      requestId,
    );
  } catch (error) {
    console.error("Failed to update project_approval_request:", error.message);
    return {
      status: 200,
      body: { success: false, error: "Approval workflow not available in this schema" },
    };
  }

  if (action === "approved") {
    // Update the task to link it to the project and set active status
    await linkTaskToProject(approvalRequest.project_id, approvalRequest.task_id);

    try {
      const taskTitle =
        (await getTaskTitleById(approvalRequest.task_id)) || "Task";
      await createApprovalApprovedNotification(
        approvalRequest.requester_id,
        "Project Contribution Approved",
        `Your contribution to link "${taskTitle}" was approved by ${reviewerName || reviewerId}.`,
        "approval",
      );
    } catch (notificationError) {
      console.error("Approval notification failed:", notificationError.message);
    }
  } else {
    try {
      const taskTitle =
        (await getTaskTitleById(approvalRequest.task_id)) || "Task";
      await createApprovalRejectedNotification(
        approvalRequest.requester_id,
        "Project Contribution Declined",
        `Your request to link "${taskTitle}" was declined. Reason: ${rejectionReason}`,
        "approval",
      );
    } catch (notificationError) {
      console.error("Rejection notification failed:", notificationError.message);
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      action,
      message:
        action === "approved"
          ? "Contribution approved. Task is now linked to the project."
          : "Contribution declined. Requester has been notified.",
    },
  };
}
