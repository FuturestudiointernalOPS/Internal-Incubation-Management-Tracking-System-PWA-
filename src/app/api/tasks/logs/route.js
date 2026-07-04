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
