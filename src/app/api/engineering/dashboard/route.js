import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/engineering/dashboard
 *
 * Returns operational data for the Head of Development dashboard.
 * Shows: active devs, assignments, overdue tasks, unresolved bugs, blockers.
 */
export async function GET(request) {
  try {
    const authError = await requireAuth(["super_admin", "developer"]);
    if (authError) return authError;

    await initDb();

    // 1. Active Developers & Interns
    const devsRes = await db.execute({
      sql: `SELECT cid, name, email, role, status, group_name, created_at
            FROM contacts
            WHERE role IN ('developer', 'intern')
            ORDER BY role, name`,
    });

    // 2. Active tasks assigned to developers (not completed)
    const tasksRes = await db.execute({
      sql: `SELECT t.*, c.name as assignee_name
            FROM tasks t
            LEFT JOIN contacts c ON t.assigned_to = c.cid
            WHERE t.assigned_to IS NOT NULL
              AND t.status NOT IN ('completed', 'archived')
            ORDER BY
              CASE t.priority
                WHEN 'critical' THEN 0
                WHEN 'high' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'low' THEN 3
                ELSE 4
              END,
              t.end_date ASC NULLS LAST`,
    });

    // 3. Unresolved error logs
    const errorsRes = await db.execute({
      sql: `SELECT e.*, c.name as user_name
            FROM error_logs e
            LEFT JOIN contacts c ON e.user_id = c.cid
            WHERE (e.resolved IS NULL OR e.resolved = false)
            ORDER BY e.created_at DESC
            LIMIT 50`,
    });

    // 4. Overdue tasks
    const today = new Date().toISOString().split("T")[0];
    const overdueRes = await db.execute({
      sql: `SELECT t.*, c.name as assignee_name
            FROM tasks t
            LEFT JOIN contacts c ON t.assigned_to = c.cid
            WHERE t.assigned_to IS NOT NULL
              AND t.end_date < ?
              AND t.status NOT IN ('completed', 'archived')
            ORDER BY t.end_date ASC`,
      args: [today],
    });

    // 5. Active blockers
    const blockerRes = await db.execute({
      sql: `SELECT b.*, t.title as task_title, c.name as reported_by_name
            FROM blockers b
            JOIN tasks t ON b.task_id = t.id
            LEFT JOIN contacts c ON b.user_id = c.cid
            WHERE b.status = 'active'
            ORDER BY b.created_at DESC`,
    });

    // 6. Weekly completion stats for each developer
    const weekNumber = getWeekNumber(new Date());
    const year = new Date().getFullYear();

    const weeklyRes = await db.execute({
      sql: `SELECT assigned_to, c.name as assignee_name,
                   COUNT(*) as total_tasks,
                   SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
            FROM tasks t
            LEFT JOIN contacts c ON t.assigned_to = c.cid
            WHERE t.created_week = ? AND t.created_year = ?
              AND t.assigned_to IS NOT NULL
            GROUP BY t.assigned_to, c.name`,
      args: [weekNumber, year],
    });

    return NextResponse.json({
      success: true,
      developers: devsRes.rows,
      activeTasks: tasksRes.rows,
      unresolvedErrors: errorsRes.rows,
      overdueTasks: overdueRes.rows,
      activeBlockers: blockerRes.rows,
      weeklyStats: weeklyRes.rows,
      weekNumber,
      year,
    });
  } catch (err) {
    console.error("[API engineering] GET dashboard failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}
