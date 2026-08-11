import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/retros/current?user_id=X&week=12&year=2026&context_type=staff&context_id=X
 *
 * Returns the current week's retro report and active tasks.
 * SECURITY (Phase 0): Non-SA users can only view their own retro.
 * Unified (Phase 6): Supports context filtering.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    const week_number = searchParams.get("week");
    const year = searchParams.get("year");
    const context_type = searchParams.get("context_type") || "staff";
    const context_id = searchParams.get("context_id") || null;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 },
      );
    }

    // SECURITY (Phase 0): Non-SA users can only view their own retro.
    if (session.role !== "super_admin" && String(user_id) !== String(session.cid)) {
      return NextResponse.json(
        { success: false, error: "You can only view your own retro." },
        { status: 403 },
      );
    }

    const w = week_number ? parseInt(week_number) : null;
    const y = year ? parseInt(year) : null;

    let report = null;
    if (w && y) {
      let sql = "SELECT * FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'retro'";
      const args = [user_id, w, y];
      if (context_id) {
        sql += " AND context_id = ?";
        args.push(context_id);
      } else {
        sql += " AND context_type = ?";
        args.push(context_type);
      }
      sql += " LIMIT 1";
      const reportRes = await db.execute({ sql, args });
      if (reportRes.rows.length > 0) report = reportRes.rows[0];
    }

    const taskRes = await db.execute({
      sql: "SELECT * FROM tasks WHERE (user_id = ? OR assigned_to = ?) AND status IN ('pending', 'in_progress', 'blocked', 'carried_over') ORDER BY created_at DESC",
      args: [user_id, user_id],
    });

    // Batch fetch blockers (2 queries instead of N+1)
    const taskIds = taskRes.rows.map((t) => t.id);
    let blockersByTask = {};
    if (taskIds.length > 0) {
      const blockerRes = await db.execute({
        sql: `SELECT id, title, status, severity, task_id FROM blockers WHERE task_id IN (${taskIds.map(() => "?").join(",")}) ORDER BY created_at DESC`,
        args: taskIds,
      });
      for (const b of blockerRes.rows || []) {
        if (!blockersByTask[b.task_id]) blockersByTask[b.task_id] = [];
        blockersByTask[b.task_id].push({ id: b.id, title: b.title, status: b.status, severity: b.severity });
      }
    }

    const tasks = taskRes.rows.map((task) => ({
      ...task,
      blockers: blockersByTask[task.id] || [],
    }));

    return NextResponse.json({ success: true, report, tasks });
  } catch (error) {
    console.error("GET retros/current error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
