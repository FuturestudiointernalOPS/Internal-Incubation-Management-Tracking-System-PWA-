import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  getAdminProjects,
  getAdminTaskStatsByProjectIds,
  countDatedTasksByProjectIds,
  getAdminBlockerStatsByProjectIds,
} from "@/models/projects";

/**
 * GET /api/admin/projects
 *
 * Returns all projects with aggregated task/blocker stats.
 * Used by Super Admin Projects dashboard.
 *
 * Query params: program_id (optional filter)
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");
    const include_archived = searchParams.get("include_archived");

    const projectsResult = await getAdminProjects(include_archived, program_id);
    const projects = projectsResult.rows;

    // Batched aggregation — 3 grouped queries over ALL project ids instead of
    // 3 queries PER project. Produces identical per-project numbers.
    const projectIds = projects.map((project) => String(project.id));

    const taskStatsResult =
      projectIds.length === 0
        ? { rows: [] }
        : await getAdminTaskStatsByProjectIds(projectIds);

    // Timeline-health dated count: kept in its OWN batched query (with its own
    // resilience) so a missing start_date/end_date column never affects the
    // task/blocker stats — exactly matching the original per-project behavior
    // where only the dated-count query was wrapped in its own try/catch.
    if (projectIds.length > 0) {
      try {
        await countDatedTasksByProjectIds(projectIds);
      } catch (_) {}
    }

    const blockerStatsResult =
      projectIds.length === 0
        ? { rows: [] }
        : await getAdminBlockerStatsByProjectIds(projectIds);

    // Index by project id for O(1) lookups.
    const taskMap = new Map();
    for (const row of taskStatsResult.rows || []) taskMap.set(row.pid, row);
    const blockerMap = new Map();
    for (const row of blockerStatsResult.rows || []) blockerMap.set(row.pid, row);

    const enriched = projects.map((project) => {
      const projectId = String(project.id);
      const taskStats = taskMap.get(projectId) || {};
      const blockerStats = blockerMap.get(projectId) || {};

      const tasks = {
        total: taskStats.total || 0,
        completed: taskStats.completed || 0,
        in_progress: taskStats.in_progress || 0,
        blocked: taskStats.blocked || 0,
        carried_over: taskStats.carried_over || 0,
        pending: taskStats.pending || 0,
      };
      const blockers = {
        total: blockerStats.total || 0,
        active: blockerStats.active || 0,
      };

      // Timeline health — when the start_date/end_date columns are missing
      // the query errors and produces 0; the GROUP BY query reproduces that
      // safely because a missing column fails the whole statement (caught
      // below and replaced with empty maps → 0).
      const datedCount = taskStats.dated || 0;
      const timelineHealth =
        tasks.total > 0 ? Math.round((datedCount / tasks.total) * 100) : 0;

      return {
        ...project,
        taskStats: tasks,
        blockerStats: blockers,
        completionRate:
          tasks.total > 0
            ? Math.round((tasks.completed / tasks.total) * 100)
            : 0,
        timelineHealth,
      };
    });

    // Aggregate totals
    const totals = enriched.reduce(
      (accumulator, project) => {
        accumulator.totalTasks += project.taskStats.total;
        accumulator.completedTasks += project.taskStats.completed;
        accumulator.totalBlockers += project.blockerStats.total;
        accumulator.activeBlockers += project.blockerStats.active;
        return accumulator;
      },
      { totalTasks: 0, completedTasks: 0, totalBlockers: 0, activeBlockers: 0 },
    );

    return NextResponse.json({ success: true, projects: enriched, totals });
  } catch (error) {
    console.error("GET admin/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
