import db from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";
import { NextResponse } from "next/server";

export const GET = createHandler({ roles: ["super_admin"] }, async (req) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const project_id = searchParams.get("project_id");
  const user_id = searchParams.get("user_id");

  let sql = `SELECT t.*, c.name AS user_display_name FROM tasks t LEFT JOIN contacts c ON t.user_id = c.cid OR t.user_id = c.id WHERE 1=1`;
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
  const tasks = result.rows;

  // Batch the per-task blocker query into one IN query instead of 1 DB
  // round-trip PER task (up to 200). Produces identical per-task `blockers`
  // arrays ordered created_at DESC.
  const taskIds = tasks.map((t) => t.id);
  let blockersByTask = {};
  if (taskIds.length > 0) {
    const idsPh = taskIds.map(() => "?").join(",");
    const blockerRes = await db.execute({
      sql: `SELECT id, title, status, severity, created_at, task_id
            FROM blockers WHERE task_id IN (${idsPh}) ORDER BY created_at DESC`,
      args: taskIds,
    });
    for (const r of blockerRes.rows || []) {
      const id = String(r.task_id);
      if (!blockersByTask[id]) blockersByTask[id] = [];
      const { task_id, ...rest } = r;
      blockersByTask[id].push(rest);
    }
  }

  const enriched = tasks.map((task) => ({
    ...task,
    blockers: blockersByTask[String(task.id)] || [],
  }));
  return NextResponse.json({ success: true, tasks: enriched });
});
