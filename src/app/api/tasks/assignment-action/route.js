import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { applyAssignmentAction } from "@/services/tasks/assignmentAction";

/**
 * ASSIGNMENT ACTION API — controller layer.
 *
 * POST /api/tasks/assignment-action
 *
 * Allows the assigned person to accept, decline or complete their assignment.
 *
 * Body:
 *   task_id: number   — the task being acted on
 *   user_id: string   — the acting user (audit attribution)
 *   user_name: string — optional display name
 *   action: "accepted" | "declined" | "completed_assignment"
 *
 * The rules (only the assignee may act, status transitions, ancestor
 * completion, assigner notification) live in
 * `@/services/tasks/assignmentAction`.
 */

const ASSIGNMENT_ACTIONS = ["accepted", "declined", "completed_assignment"];

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

    if (!ASSIGNMENT_ACTIONS.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "action must be one of: accepted, declined, completed_assignment",
        },
        { status: 400 },
      );
    }

    const session = await getSession();

    const result = await applyAssignmentAction({
      taskId: task_id,
      userId: user_id,
      userName: user_name,
      action,
      sessionCid: session.cid,
    });

    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST assignment-action error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
