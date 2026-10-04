import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import {
  listTaskAssignments,
  respondToTaskAssignment,
} from "@/services/tasks/assignments";

/**
 * TASK ASSIGNMENTS API — controller layer.
 *
 * GET  /api/tasks/assignments?assignee_id=X&status=pending
 * POST /api/tasks/assignments  { assignment_id, action: "accept"|"decline"|"reassign", new_assignee_id }
 *
 * The own-scope rule, the accept/decline/reassign permissions and the contact
 * group check live in `@/services/tasks/assignments`.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const { searchParams } = new URL(req.url);

    const result = await listTaskAssignments({
      role: session.role,
      sessionCid: session.cid,
      requestedCid: searchParams.get("assignee_id"),
      status: searchParams.get("status"),
    });

    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const { assignment_id, action, new_assignee_id } = await req.json();

    if (!assignment_id || !action) {
      return NextResponse.json(
        { success: false, error: "assignment_id and action required" },
        { status: 400 },
      );
    }

    const result = await respondToTaskAssignment({
      assignmentId: assignment_id,
      action,
      newAssigneeId: new_assignee_id,
      sessionCid: session.cid,
      sessionName: session.name,
      role: session.role,
    });

    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST assignments error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
