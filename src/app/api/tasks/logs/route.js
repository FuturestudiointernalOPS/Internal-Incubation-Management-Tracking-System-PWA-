import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getTaskAccessById,
  getTaskAssignmentLogs,
} from "@/models/taskLifecycle";

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

  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  const taskResult = await getTaskAccessById(task_id);
  const task = taskResult.rows[0];
  if (!task) {
    return NextResponse.json(
      { success: false, error: "Task not found" },
      { status: 404 },
    );
  }
  const staffSide = [
    "super_admin",
    "staff",
    "program_manager",
  ];
  if (
    !staffSide.includes(session.role) &&
    String(task.user_id) !== String(session.cid) &&
    String(task.assigned_to || "") !== String(session.cid) &&
    String(task.supervisor_id || "") !== String(session.cid)
  ) {
    return NextResponse.json(
      { success: false, error: "You do not have access to this task." },
      { status: 403 },
    );
  }

  const result = await getTaskAssignmentLogs(task_id, limit);
  return NextResponse.json({ success: true, logs: result.rows });
});
