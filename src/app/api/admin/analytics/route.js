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

    // Blocker rate: % of all blockers that are still active
    const blockerRate =
      blockerStats.rows[0]?.total > 0
        ? Math.round(
            (blockerStats.rows[0].active / blockerStats.rows[0].total) * 100,
          )
        : 0;

    // Average blocker resolution time (hours)
    const resolutionTimeRes = await db.execute({
      sql: "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))::int AS avg_seconds FROM blockers WHERE status = 'resolved' AND resolved_at IS NOT NULL AND created_at IS NOT NULL",
    });
    const avgResolutionHours = resolutionTimeRes.rows[0]?.avg_seconds
      ? Math.round(resolutionTimeRes.rows[0].avg_seconds / 3600)
      : 0;

    // Weekly productivity: tasks completed per week (by completion date), last 8 weeks
    const weeklyProductivity = await db.execute({
      sql: `SELECT
              EXTRACT(week FROM completed_at)::int AS week,
              EXTRACT(isoyear FROM completed_at)::int AS year,
              COUNT(*)::int AS completed
            FROM tasks
            WHERE status = 'completed' AND completed_at IS NOT NULL
            GROUP BY EXTRACT(isoyear FROM completed_at), EXTRACT(week FROM completed_at)
            ORDER BY year DESC, week DESC
            LIMIT 8`,
    });

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
        blockerRate,
        avgResolutionHours,
        weeklyProductivity: weeklyProductivity.rows || [],
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
