import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  getBlockerAggregatesForUsers,
  getTaskAggregatesForUsers,
  getTaskProjectUserOptions,
  getUserIndependentTaskCounts,
  getUserProjectCounts,
  getUserReportCompliance,
} from "@/models/adminOps";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get("user_id");

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
      const taskStats = taskMap[idKey] || {
        total: 0,
        completed: 0,
        in_progress: 0,
        blocked: 0,
        carried_over: 0,
        pending: 0,
      };
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
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

function getWeekNumber(inputDate) {
  const date = new Date(
    Date.UTC(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate()),
  );
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}
