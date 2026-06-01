import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/tasks/logs?task_id=X
 *
 * Returns immutable audit trail for a task.
 * Ordered by created_at ASC for chronological timeline view.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get("task_id");
    const limit = searchParams.get("limit");

    if (!task_id) {
      return NextResponse.json({ success: false, error: "task_id is required" }, { status: 400 });
    }

    let sql = "SELECT * FROM task_assignment_log WHERE task_id = ? ORDER BY created_at ASC";
    const args = [parseInt(task_id)];

    if (limit) {
      sql += " LIMIT ?";
      args.push(parseInt(limit));
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, logs: result.rows });
  } catch (error) {
    console.error("GET task logs error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
