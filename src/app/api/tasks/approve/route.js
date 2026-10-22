import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { reviewTaskApproval } from "@/services/tasks/approval";

/**
 * TASK APPROVAL API — controller layer.
 *
 * POST /api/tasks/approve
 *   Body: { task_id, reviewer_id, reviewer_name, action, reason }
 *   Approves or rejects a pending_project_approval task.
 *
 * The approve/reject domain (project link, standalone conversion, audit) lives
 * in `@/services/tasks/approval`.
 */
export async function POST(req) {
  try {
    await initDb();
    // Approving or rejecting a project request changes a task: `tasks.edit`.
    // No standard profile carries tasks.*, so the platform owner keeps it.
    const capError = await requireAuthorization("tasks", "edit");
    if (capError) return capError;
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

    const result = await reviewTaskApproval({
      taskId: task_id,
      action,
      reviewerId: reviewer_id,
      reviewerName: reviewer_name,
      reason,
    });

    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST tasks/approve error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
