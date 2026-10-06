import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { listTaskLogs } from "@/services/tasks/logs";

/**
 * TASK ASSIGNMENT LOG API — controller layer.
 *
 * GET /api/tasks/logs?task_id=X&limit=N
 *
 * The task-access rule lives in `@/services/tasks/logs`.
 */
export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const task_id = searchParams.get("task_id");
  const limit = searchParams.get("limit");

  if (!task_id) {
    return NextResponse.json(
      { success: false, error: "task_id is required" },
      { status: 400 },
    );
  }

  const { getSession } = await import("@/server/auth/session");
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const result = await listTaskLogs({
    taskId: task_id,
    limit,
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
});
