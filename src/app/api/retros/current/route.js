import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/retros/current?user_id=X&week=12&year=2026
 *
 * Returns the current week's retro data:
 * - Existing retro report (if submitted)
 * - This week's standup tasks for reconciliation
 * - All tasks in carried_over/in_progress/blocked/pending status
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

    // Fetch existing retro report
    let report = null;
    if (w && y) {
      const reportRes = await db.execute({
        sql: "SELECT * FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'retro' LIMIT 1",
        args: [user_id, w, y],
      });
      if (reportRes.rows.length > 0) report = reportRes.rows[0];
    }

    // Fetch tasks needing reconciliation (all non-completed tasks)
    const taskRes = await db.execute({
      sql: "SELECT * FROM tasks WHERE user_id = ? AND status IN ('pending', 'in_progress', 'blocked', 'carried_over') ORDER BY created_at DESC",
      args: [user_id],
    });

    // Attach blockers
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
    console.error("GET retros/current error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
