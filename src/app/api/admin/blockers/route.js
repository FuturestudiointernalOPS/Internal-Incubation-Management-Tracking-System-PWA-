import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/blockers
 *
 * Super Admin view: all blockers across all users, with task and project context.
 * Default: active blockers first, resolved below.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const task_id = searchParams.get("task_id");

    let sql = `SELECT b.*, t.title AS task_title, t.project_id, t.user_name AS task_owner
               FROM blockers b
               JOIN tasks t ON b.task_id = t.id
               WHERE 1=1`;
    const args = [];

    if (status) {
      sql += " AND b.status = ?";
      args.push(status);
    }
    if (task_id) {
      sql += " AND b.task_id = ?";
      args.push(parseInt(task_id));
    }

    sql += " ORDER BY CASE WHEN b.status = 'active' THEN 0 ELSE 1 END, b.created_at DESC";

    const result = await db.execute({ sql, args });

    return NextResponse.json({ success: true, blockers: result.rows });
  } catch (error) {
    console.error("GET admin/blockers error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
