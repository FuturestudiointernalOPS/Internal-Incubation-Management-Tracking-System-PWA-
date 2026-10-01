import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { duplicateTask } from "@/services/tasks/duplicate";

/**
 * POST /api/tasks/duplicate — controller layer.
 *
 * Duplicates a task (and its subtasks) with a new id, appending " (Copy)" to the
 * title and resetting the status to pending. The access rule and the copy order
 * live in `@/services/tasks/duplicate`.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { task_id } = await req.json();
    if (!task_id) {
      return NextResponse.json(
        { success: false, error: "task_id is required" },
        { status: 400 },
      );
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const result = await duplicateTask({
      taskId: task_id,
      role: session.role,
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
    console.error("POST /api/tasks/duplicate error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
