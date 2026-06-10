import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/tasks/carryover?user_id=X&week=12&year=2026
 *
 * Returns tasks flagged as carried_over for a specific user.
 * Used by Monday standup to auto-inject carry-over tasks.
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

    // Attach blockers
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
  } catch (error) {
    console.error("GET carryover error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
