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

    const projectRes = await getAdminProjects(include_archived, program_id);
    const projects = projectRes.rows;

    // Batched aggregation — 3 grouped queries over ALL project ids instead of
    // 3 queries PER project. Produces identical per-project numbers.
    const projectIds = projects.map((p) => String(p.id));

    const taskStatsRes =
      projectIds.length === 0
        ? { rows: [] }
        : await getAdminTaskStatsByProjectIds(projectIds);

    // Timeline-health dated count: kept in its OWN batched query (with its own
    // resilience) so a missing start_date/end_date column never affects the
    // task/blocker stats — exactly matching the original per-project behavior
    // where only the dated-count query was wrapped in its own try/catch.
    let datedRes = { rows: [] };
    if (projectIds.length > 0) {
      try {
        datedRes = await countDatedTasksByProjectIds(projectIds);
      } catch (_) {
        datedRes = { rows: [] }; // columns missing / error → 0, same as before
      }
    }

    const blockerStatsRes =
      projectIds.length === 0
        ? { rows: [] }
        : await getAdminBlockerStatsByProjectIds(projectIds);

    // Index by project id for O(1) lookups.
    const taskMap = new Map();
    for (const r of taskStatsRes.rows || []) taskMap.set(r.pid, r);
    const blockerMap = new Map();
    for (const r of blockerStatsRes.rows || []) blockerMap.set(r.pid, r);

    const enriched = projects.map((project) => {
      const pid = String(project.id);
      const ts = taskMap.get(pid) || {};
      const bs = blockerMap.get(pid) || {};

      const tasks = {
        total: ts.total || 0,
        completed: ts.completed || 0,
        in_progress: ts.in_progress || 0,
        blocked: ts.blocked || 0,
        carried_over: ts.carried_over || 0,
        pending: ts.pending || 0,
      };
      const blockers = {
        total: bs.total || 0,
        active: bs.active || 0,
      };

      // Timeline health — when the start_date/end_date columns are missing
      // the query errors and produces 0; the GROUP BY query reproduces that
      // safely because a missing column fails the whole statement (caught
      // below and replaced with empty maps → 0).
      const datedCount = ts.dated || 0;
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
      (acc, p) => {
        acc.totalTasks += p.taskStats.total;
        acc.completedTasks += p.taskStats.completed;
        acc.totalBlockers += p.blockerStats.total;
        acc.activeBlockers += p.blockerStats.active;
        return acc;
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
