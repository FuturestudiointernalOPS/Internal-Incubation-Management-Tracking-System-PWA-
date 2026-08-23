import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

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
  const taskRes = await db.execute({
    sql: "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
    args: [parseInt(task_id)],
  });
  const t = taskRes.rows[0];
  if (!t) {
    return NextResponse.json(
      { success: false, error: "Task not found" },
      { status: 404 },
    );
  }
  const staffSide = [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ];
  if (
    !staffSide.includes(session.role) &&
    String(t.user_id) !== String(session.cid) &&
    String(t.assigned_to || "") !== String(session.cid) &&
    String(t.supervisor_id || "") !== String(session.cid)
  ) {
    return NextResponse.json(
      { success: false, error: "You do not have access to this task." },
      { status: 403 },
    );
  }

  let sql =
    "SELECT * FROM task_assignment_log WHERE task_id = ? ORDER BY created_at ASC";
  const args = [parseInt(task_id)];
  if (limit) {
    sql += " LIMIT ?";
    args.push(parseInt(limit));
  }

  const result = await db.execute({ sql, args });
  return NextResponse.json({ success: true, logs: result.rows });
});
