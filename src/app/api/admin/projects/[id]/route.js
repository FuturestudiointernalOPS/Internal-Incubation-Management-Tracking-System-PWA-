import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/projects/[id]
 *
 * Returns a single project with:
 *   - Project details + owner + program name
 *   - Task stats + full task list
 *   - Blocker list
 *   - Team members
 *   - Activity timeline
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    // 1. Project details with owner and program
    const projectRes = await db.execute({
      sql: `SELECT p.*, pr.name AS program_name, c.name AS owner_name
            FROM v2_projects p
            LEFT JOIN v2_programs pr ON p.program_id = pr.id
            LEFT JOIN contacts c ON p.owner_id = c.cid OR p.owner_id = c.id
            WHERE p.id::text = ?`,
      args: [id],
    });

    if (projectRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 },
      );
    }

    const project = projectRes.rows[0];
    // Parse meta JSON if it exists
    if (project.meta && typeof project.meta === "string") {
      try {
        project.meta = JSON.parse(project.meta);
      } catch (e) {
        project.meta = {};
      }
    }

    // 2. Task stats
    const taskStats = await db.execute({
      sql: `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN status = 'carried_over' THEN 1 ELSE 0 END) AS carried_over,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
        FROM tasks WHERE project_id::text = ?`,
      args: [id],
    });

    // 3. All tasks for this project with assignee info
    const tasksRes = await db.execute({
      sql: `SELECT t.*, c.name AS assignee_name
            FROM tasks t
            LEFT JOIN contacts c ON t.assigned_to = c.cid OR t.assigned_to = c.id
            WHERE t.project_id::text = ?
            ORDER BY t.created_at DESC`,
      args: [id],
    });

    // Attach blockers to each task
    const tasksWithBlockers = await Promise.all(
      (tasksRes.rows || []).map(async (task) => {
        const blockerRes = await db.execute({
          sql: "SELECT id, title, status, severity, created_at, resolved_at FROM blockers WHERE task_id = ? ORDER BY created_at DESC",
          args: [task.id],
        });
        return { ...task, blockers: blockerRes.rows || [] };
      }),
    );

    // 4. All blockers for this project
    const blockersRes = await db.execute({
      sql: `SELECT b.*, t.title AS task_title, c.name AS user_name
            FROM blockers b
            JOIN tasks t ON b.task_id = t.id
            LEFT JOIN contacts c ON b.user_id = c.cid OR b.user_id = c.id
            WHERE t.project_id::text = ?
            ORDER BY b.created_at DESC`,
      args: [id],
    });

    // 5. Team members (from project_members + v2_project_staff + unique task assignees)
    const membersRes = await db.execute({
      sql: `SELECT DISTINCT ON (user_cid, staff_id, assignee_id)
              COALESCE(pm.user_cid, ps.staff_id, ta.assignee_id) AS member_id,
              c.name, c.role, c.email,
              CASE
                WHEN pm.role IS NOT NULL THEN pm.role
                WHEN ps.role IS NOT NULL THEN ps.role
                ELSE 'member'
              END AS member_role
            FROM (
              SELECT user_cid, role FROM project_members WHERE project_id::text = ?
            ) pm
            FULL JOIN (
              SELECT staff_id, role FROM v2_project_staff WHERE project_id::text = ?
            ) ps ON 1=0
            FULL JOIN (
              SELECT assigned_to AS assignee_id FROM tasks WHERE project_id::text = ? AND assigned_to IS NOT NULL
            ) ta ON 1=0
            LEFT JOIN contacts c ON COALESCE(pm.user_cid, ps.staff_id, ta.assignee_id) = c.cid OR COALESCE(pm.user_cid, ps.staff_id, ta.assignee_id) = c.id`,
      args: [id, id, id],
    });

    // 6. Activity timeline
    const timelineRes = await db.execute({
      sql: `SELECT tal.*, t.title AS task_title, c.name AS actor_name
            FROM task_assignment_log tal
            LEFT JOIN tasks t ON tal.task_id = t.id
            LEFT JOIN contacts c ON tal.actor_id = c.cid OR tal.actor_id = c.id
            WHERE tal.project_id::text = ?
            ORDER BY tal.created_at DESC
            LIMIT 50`,
      args: [id],
    });

    // 7. Count dated tasks for timeline health
    let datedCount = 0;
    try {
      const datedTasks = await db.execute({
        sql: "SELECT COUNT(*) AS count FROM tasks WHERE project_id::text = ? AND start_date IS NOT NULL AND end_date IS NOT NULL",
        args: [id],
      });
      datedCount = datedTasks.rows[0]?.count || 0;
    } catch (_) {
      datedCount = 0;
    }

    const taskStatsRow = taskStats.rows[0] || {
      total: 0, completed: 0, in_progress: 0, blocked: 0, carried_over: 0, pending: 0,
    };
    const total = taskStatsRow.total || 0;
    const completed = taskStatsRow.completed || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const timelineHealth = total > 0 ? Math.round((datedCount / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        taskStats: taskStatsRow,
        tasks: tasksWithBlockers,
        blockers: blockersRes.rows || [],
        members: membersRes.rows || [],
        timeline: timelineRes.rows || [],
        completionRate,
        timelineHealth,
      },
    });
  } catch (error) {
    console.error("GET admin/projects/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
