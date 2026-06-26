import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/standups/current?user_id=X&week=12&year=2026
 *
 * Returns the current week's standup data:
 * - Existing standup report (if submitted)
 * - Weekly tasks (pending, in_progress, blocked, carried_over) with blockers
 * - Tasks are scoped to the given week/year
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    const week_number = searchParams.get("week");
    const year = searchParams.get("year");

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 },
      );
    }

    const w = week_number ? parseInt(week_number) : null;
    const y = year ? parseInt(year) : null;

    // Fetch existing standup report
    let report = null;
    if (w && y) {
      const reportRes = await db.execute({
        sql: "SELECT * FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'standup' LIMIT 1",
        args: [user_id, w, y],
      });
      if (reportRes.rows.length > 0) report = reportRes.rows[0];
    }

    // Fetch weekly tasks: pending, in_progress, blocked, carried_over
    // Scoped to the given week/year so the standup shows "What am I working on this week?"
    let taskSql = "SELECT * FROM tasks WHERE user_id = ?";
    const taskArgs = [user_id];

    if (w && y) {
      taskSql += " AND created_week = ? AND created_year = ?";
      taskArgs.push(w, y);
    }

    taskSql += " AND status NOT IN ('completed', 'archived')";
    taskSql +=
      " ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, created_at ASC";

    const taskRes = await db.execute({ sql: taskSql, args: taskArgs });

    // Attach blockers to tasks
    const tasks = await Promise.all(
      taskRes.rows.map(async (task) => {
        const blockerRes = await db.execute({
          sql: "SELECT id, title, status, severity FROM blockers WHERE task_id = ? ORDER BY created_at DESC",
          args: [task.id],
        });
        return { ...task, blockers: blockerRes.rows || [] };
      }),
    );

    return NextResponse.json({ success: true, report, tasks });
  } catch (error) {
    console.error("GET standups/current error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
