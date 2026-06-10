import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/analytics
 *
 * Returns high-level execution analytics for the Super Admin dashboard.
 * Aggregates task, blocker, standup, retro, and project stats.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    // Task stats across ALL users
    const taskStats = await db.execute({
      sql: `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked,
        COUNT(*) FILTER (WHERE status = 'carried_over')::int AS carried_over,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
        FROM tasks`,
    });

    // Blocker stats
    const blockerStats = await db.execute({
      sql: `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved
        FROM blockers`,
    });

    // Standup/Retro compliance — current week
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    const reportStats = await db.execute({
      sql: `SELECT
        COUNT(*) FILTER (WHERE report_type = 'standup')::int AS standups,
        COUNT(*) FILTER (WHERE report_type = 'retro')::int AS retros
        FROM v2_op_reports WHERE week_number = ? AND year = ? AND status = 'submitted'`,
      args: [weekNumber, year],
    });

    // Project stats
    const projectStats = await db.execute({
      sql: "SELECT COUNT(*)::int AS total FROM v2_projects",
    });

    // Unique users with tasks
    const activeUsers = await db.execute({
      sql: "SELECT COUNT(DISTINCT user_id)::int AS count FROM tasks",
    });

    // Carry-over rate
    const carryoverRate =
      taskStats.rows[0]?.total > 0
        ? Math.round(
            (taskStats.rows[0].carried_over / taskStats.rows[0].total) * 100,
          )
        : 0;

    return NextResponse.json({
      success: true,
      analytics: {
        tasks: taskStats.rows[0] || {
          total: 0,
          completed: 0,
          in_progress: 0,
          blocked: 0,
          carried_over: 0,
          pending: 0,
        },
        blockers: blockerStats.rows[0] || { total: 0, active: 0, resolved: 0 },
        reports: reportStats.rows[0] || { standups: 0, retros: 0 },
        projects: projectStats.rows[0]?.total || 0,
        activeUsers: activeUsers.rows[0]?.count || 0,
        completionRate:
          taskStats.rows[0]?.total > 0
            ? Math.round(
                (taskStats.rows[0].completed / taskStats.rows[0].total) * 100,
              )
            : 0,
        carryoverRate,
      },
    });
  } catch (error) {
    console.error("GET admin/analytics error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}
