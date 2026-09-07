import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  getAvgBlockerResolutionSeconds,
  getBlockerStatusStats,
  getDistinctTaskUserCount,
  getSubmittedReportCountsByWeek,
  getTaskStatusStats,
  getV2ProjectCount,
  getWeeklyProductivityStats,
} from "@/models/adminOps";

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
    const taskStats = await getTaskStatusStats();

    // Blocker stats
    const blockerStats = await getBlockerStatusStats();

    // Standup/Retro compliance — current week
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    const reportStats = await getSubmittedReportCountsByWeek(weekNumber, year);

    // Project stats
    const projectStats = await getV2ProjectCount();

    // Unique users with tasks
    const activeUsers = await getDistinctTaskUserCount();

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
    const resolutionTimeRes = await getAvgBlockerResolutionSeconds();
    const avgResolutionHours = resolutionTimeRes.rows[0]?.avg_seconds
      ? Math.round(resolutionTimeRes.rows[0].avg_seconds / 3600)
      : 0;

    // Weekly productivity: tasks completed per week (by completion date), last 8 weeks
    const weeklyProductivity = await getWeeklyProductivityStats();

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
