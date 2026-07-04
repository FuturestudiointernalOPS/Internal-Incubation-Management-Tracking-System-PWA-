import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");
  const week_number = searchParams.get("week");
  const year = searchParams.get("year");

  let sql =
    "SELECT * FROM tasks WHERE status IN ('carried_over', 'in_progress', 'blocked')";
  const args = [];
  if (user_id) {
    sql += " AND user_id = ?";
    args.push(user_id);
  }
  if (week_number) {
    sql += " AND created_week <= ?";
    args.push(parseInt(week_number));
  }
  if (year) {
    sql += " AND created_year = ?";
    args.push(parseInt(year));
  }
  sql += " ORDER BY created_at DESC";

  const result = await db.execute({ sql, args });
  const tasksWithBlockers = await Promise.all(
    result.rows.map(async (task) => {
      const blockerRes = await db.execute({
        sql: "SELECT id, title, status, severity FROM blockers WHERE task_id = ? ORDER BY created_at DESC",
        args: [task.id],
      });
      return { ...task, blockers: blockerRes.rows || [] };
    }),
  );
  return NextResponse.json({ success: true, tasks: tasksWithBlockers });
});
