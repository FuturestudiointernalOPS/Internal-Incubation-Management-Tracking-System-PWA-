/**
 * Admin analytics — the Super Admin execution analytics (SERVICE layer).
 *
 * The work behind `GET /api/admin/analytics` and
 * `GET /api/admin/analytics/users`: the week/date framing, the derived rates
 * (carry-over, blocker, completion, average blocker resolution) and the per-user
 * aggregation with its batched reads and safe fallbacks.
 *
 * HTTP-free: it reads through `@/models/adminOps` and answers `{ status, body }`.
 * The controller keeps the authentication and the envelope.
 */

import {
  getAvgBlockerResolutionSeconds,
  getBlockerAggregatesForUsers,
  getBlockerStatusStats,
  getDistinctTaskUserCount,
  getSubmittedReportCountsByWeek,
  getTaskAggregatesForUsers,
  getTaskProjectUserOptions,
  getTaskStatusStats,
  getUserIndependentTaskCounts,
  getUserProjectCounts,
  getUserReportCompliance,
  getV2ProjectCount,
  getWeeklyProductivityStats,
} from "@/models/adminOps";
import { getWeekNumber } from "@/services/dashboard/weeks";

const EMPTY_TASK_STATS = {
  total: 0,
  completed: 0,
  in_progress: 0,
  blocked: 0,
  carried_over: 0,
  pending: 0,
};

/** High-level execution analytics (task / blocker / standup / project). */
export async function getExecutionAnalytics() {
  // Task stats across ALL users
  const taskStats = await getTaskStatusStats();
  const blockerStats = await getBlockerStatusStats();

  // Standup/Retro compliance — current week
  const now = new Date();
  const weekNumber = getWeekNumber(now);
  const year = now.getFullYear();

  const reportStats = await getSubmittedReportCountsByWeek(weekNumber, year);
  const projectStats = await getV2ProjectCount();
  const activeUsers = await getDistinctTaskUserCount();

  // Carry-over rate
  const carryoverRate =
    taskStats.rows[0]?.total > 0
      ? Math.round((taskStats.rows[0].carried_over / taskStats.rows[0].total) * 100)
      : 0;

  // Blocker rate: % of all blockers that are still active
  const blockerRate =
    blockerStats.rows[0]?.total > 0
      ? Math.round((blockerStats.rows[0].active / blockerStats.rows[0].total) * 100)
      : 0;

  // Average blocker resolution time (hours)
  const averageResolutionResult = await getAvgBlockerResolutionSeconds();
  const avgResolutionHours = averageResolutionResult.rows[0]?.avg_seconds
    ? Math.round(averageResolutionResult.rows[0].avg_seconds / 3600)
    : 0;

  // Weekly productivity: tasks completed per week (by completion date), last 8 weeks
  const weeklyProductivity = await getWeeklyProductivityStats();

  return {
    status: 200,
    body: {
      success: true,
      analytics: {
        tasks: taskStats.rows[0] || { ...EMPTY_TASK_STATS },
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
    },
  };
}

/** Per-user execution analytics, optionally narrowed to one user id. */
export async function listUserAnalytics(filterUserId) {
  const userOptionsResult = await getTaskProjectUserOptions();

  let userRows = userOptionsResult.rows;
  if (filterUserId) userRows = userRows.filter((user) => user.id === filterUserId);
  const ids = userRows.map((user) => user.id);

  // Batch all five per-user aggregations into grouped queries over ALL ids
  // instead of 5 DB round-trips PER user. Produces identical per-user values.
  const taskMap = {};
  const blockerMap = {};
  const projectMap = {};
  const independentTaskMap = {};
  const reportMap = {};
  const weekNumber = getWeekNumber(new Date());
  const year = new Date().getFullYear();

  if (ids.length > 0) {
    const [
      taskAggregateResult,
      blockerAggregateResult,
      projectCountResult,
      independentTaskCountResult,
      reportComplianceResult,
    ] = await Promise.all([
      getTaskAggregatesForUsers(ids),
      getBlockerAggregatesForUsers(ids),
      getUserProjectCounts(ids),
      getUserIndependentTaskCounts(ids),
      getUserReportCompliance(ids, weekNumber - 4, year),
    ]);

    for (const row of taskAggregateResult.rows || []) taskMap[row.uid] = row;
    for (const row of blockerAggregateResult.rows || []) blockerMap[row.uid] = row;
    for (const row of projectCountResult.rows || []) projectMap[row.uid] = row;
    for (const row of independentTaskCountResult.rows || [])
      independentTaskMap[row.uid] = row;
    for (const row of reportComplianceResult.rows || []) reportMap[row.uid] = row;
  }

  const users = userRows.map((user) => {
    const idKey = String(user.id);
    const taskStats = taskMap[idKey] || { ...EMPTY_TASK_STATS };
    const blockerStats = blockerMap[idKey] || { total: 0, active: 0 };
    const projectCount = projectMap[idKey]?.count || 0;
    const independentTaskCount = independentTaskMap[idKey]?.count || 0;
    const reportStats = reportMap[idKey] || { standups: 0, retros: 0 };

    return {
      id: user.id,
      name: user.name || user.id,
      tasks: taskStats,
      blockers: blockerStats,
      projects: projectCount,
      independentTasks: independentTaskCount,
      completionRate:
        taskStats.total > 0
          ? Math.round((taskStats.completed / taskStats.total) * 100)
          : 0,
      carryoverRate:
        taskStats.total > 0
          ? Math.round((taskStats.carried_over / taskStats.total) * 100)
          : 0,
      complianceScore: reportStats.standups + reportStats.retros,
    };
  });

  return { status: 200, body: { success: true, users } };
}
