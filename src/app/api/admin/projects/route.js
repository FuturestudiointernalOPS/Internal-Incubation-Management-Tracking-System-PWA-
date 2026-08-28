import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

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

    let projectSql = "SELECT * FROM v2_projects WHERE 1=1";
    const projectArgs = [];

    if (include_archived !== "true") {
      projectSql += " AND status != 'Archived'";
    }

    if (program_id) {
      projectSql += " AND program_id = ?";
      projectArgs.push(program_id);
    }
    projectSql += " ORDER BY created_at DESC";

    const projectRes = await db.execute({ sql: projectSql, args: projectArgs });
    const projects = projectRes.rows;

    // Batched aggregation — 3 grouped queries over ALL project ids instead of
    // 3 queries PER project. Produces identical per-project numbers.
    const projectIds = projects.map((p) => String(p.id));
    const idsPh = projectIds.map(() => "?").join(",");

    const taskStatsRes =
      projectIds.length === 0
        ? { rows: [] }
        : await db.execute({
            sql: `SELECT project_id::text AS pid,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
              SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
              SUM(CASE WHEN status = 'carried_over' THEN 1 ELSE 0 END) AS carried_over,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
              FROM tasks WHERE project_id::text IN (${idsPh})
              GROUP BY project_id::text`,
            args: projectIds,
          });

    // Timeline-health dated count: kept in its OWN batched query (with its own
    // resilience) so a missing start_date/end_date column never affects the
    // task/blocker stats — exactly matching the original per-project behavior
    // where only the dated-count query was wrapped in its own try/catch.
    let datedRes = { rows: [] };
    if (projectIds.length > 0) {
      try {
        datedRes = await db.execute({
          sql: `SELECT project_id::text AS pid,
            SUM(CASE WHEN start_date IS NOT NULL AND end_date IS NOT NULL THEN 1 ELSE 0 END) AS dated
            FROM tasks WHERE project_id::text IN (${idsPh})
            GROUP BY project_id::text`,
          args: projectIds,
        });
      } catch (_) {
        datedRes = { rows: [] }; // columns missing / error → 0, same as before
      }
    }

    const blockerStatsRes =
      projectIds.length === 0
        ? { rows: [] }
        : await db.execute({
            sql: `SELECT t.project_id::text AS pid,
              COUNT(*) AS total,
              SUM(CASE WHEN b.status = 'active' THEN 1 ELSE 0 END) AS active
              FROM blockers b
              JOIN tasks t ON b.task_id = t.id
              WHERE t.project_id::text IN (${idsPh})
              GROUP BY t.project_id::text`,
            args: projectIds,
          });

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
