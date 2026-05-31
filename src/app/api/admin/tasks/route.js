import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/tasks
 *
 * Super Admin view: all tasks across all users, with project context.
 * Supports filtering by status, project_id, user_id.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const project_id = searchParams.get("project_id");
    const user_id = searchParams.get("user_id");

    let sql = `SELECT t.*, c.name AS user_display_name
               FROM tasks t
               LEFT JOIN contacts c ON t.user_id = c.cid OR t.user_id = c.id
               WHERE 1=1`;
    const args = [];

    if (status) {
      sql += " AND t.status = ?";
      args.push(status);
    }
    if (project_id) {
      sql += " AND t.project_id = ?";
      args.push(project_id);
    }
    if (user_id) {
      sql += " AND t.user_id = ?";
      args.push(user_id);
    }

    sql += " ORDER BY t.created_at DESC LIMIT 200";

    const result = await db.execute({ sql, args });

    // Attach blockers to each task
    const tasks = await Promise.all(
      result.rows.map(async (task) => {
        const blockerRes = await db.execute({
          sql: "SELECT id, title, status, severity, created_at FROM blockers WHERE task_id = ? ORDER BY created_at DESC",
          args: [task.id],
        });
        return { ...task, blockers: blockerRes.rows || [] };
      })
    );

    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    console.error("GET admin/tasks error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
