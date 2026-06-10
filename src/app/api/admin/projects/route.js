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

    let projectSql = "SELECT * FROM v2_projects WHERE 1=1";
    const projectArgs = [];

    if (program_id) {
      projectSql += " AND program_id = ?";
      projectArgs.push(program_id);
    }
    projectSql += " ORDER BY created_at DESC";

    const projectRes = await db.execute({ sql: projectSql, args: projectArgs });
    const projects = projectRes.rows;

    // For each project, aggregate task + blocker stats
    const enriched = await Promise.all(
      projects.map(async (project) => {
        const pid = project.id;

        // Task stats — using CASE instead of FILTER for broader compatibility
        const taskStats = await db.execute({
          sql: `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
            SUM(CASE WHEN status = 'carried_over' THEN 1 ELSE 0 END) AS carried_over,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
            FROM tasks WHERE project_id::text = ?::text`,
          args: [pid],
        });

        // Blocker stats
        const blockerStats = await db.execute({
          sql: `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN b.status = 'active' THEN 1 ELSE 0 END) AS active
            FROM blockers b
            JOIN tasks t ON b.task_id = t.id
            WHERE t.project_id::text = ?::text`,
          args: [pid],
        });

        const tasks = {
          total: taskStats.rows[0]?.total || 0,
          completed: taskStats.rows[0]?.completed || 0,
          in_progress: taskStats.rows[0]?.in_progress || 0,
          blocked: taskStats.rows[0]?.blocked || 0,
          carried_over: taskStats.rows[0]?.carried_over || 0,
          pending: taskStats.rows[0]?.pending || 0,
        };
        const blockers = {
          total: blockerStats.rows[0]?.total || 0,
          active: blockerStats.rows[0]?.active || 0,
        };

        // Timeline health — check start_date/end_date coverage
        // NOTE: start_date/end_date columns may not exist on all deployments;
        // gracefully fall back to 0 if the columns are missing.
        let datedCount = 0;
        try {
          const datedTasks = await db.execute({
            sql: "SELECT COUNT(*) AS count FROM tasks WHERE project_id::text = ?::text AND start_date IS NOT NULL AND end_date IS NOT NULL",
            args: [pid],
          });
          datedCount = datedTasks.rows[0]?.count || 0;
        } catch (_) {
          datedCount = 0;
        }
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
      }),
    );

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
