import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get("user_id");

    const usersRes = await db.execute({
      sql: `SELECT DISTINCT u.user_id AS id, COALESCE(c.name, u.user_name) AS name
            FROM (SELECT user_id, user_name FROM tasks UNION SELECT owner_id, name FROM v2_projects WHERE owner_id IS NOT NULL) u
            LEFT JOIN contacts c ON u.user_id = c.cid OR u.user_id = c.id ORDER BY name`,
    });

    const users = [];
    for (const user of usersRes.rows) {
      if (filterUserId && user.id !== filterUserId) continue;

      const ts = (await db.execute({ sql: "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'completed')::int AS completed, COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress, COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked, COUNT(*) FILTER (WHERE status = 'carried_over')::int AS carried_over, COUNT(*) FILTER (WHERE status = 'pending')::int AS pending FROM tasks WHERE user_id = ?", args: [user.id] })).rows[0] || { total: 0, completed: 0, in_progress: 0, blocked: 0, carried_over: 0, pending: 0 };

      const bs = (await db.execute({ sql: "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'active')::int AS active FROM blockers WHERE user_id = ?", args: [user.id] })).rows[0] || { total: 0, active: 0 };

      const projCount = (await db.execute({ sql: "SELECT COUNT(DISTINCT p.id)::int AS count FROM v2_projects p WHERE p.owner_id = ? OR p.id IN (SELECT DISTINCT project_id FROM tasks WHERE user_id = ? AND project_id IS NOT NULL)", args: [user.id, user.id] })).rows[0]?.count || 0;

      const indepCount = (await db.execute({ sql: "SELECT COUNT(*)::int AS count FROM tasks WHERE user_id = ? AND project_id IS NULL", args: [user.id] })).rows[0]?.count || 0;

      const wk = getWeekNumber(new Date());
      const yr = new Date().getFullYear();
      const rs = (await db.execute({ sql: "SELECT COUNT(*) FILTER (WHERE report_type = 'standup')::int AS standups, COUNT(*) FILTER (WHERE report_type = 'retro')::int AS retros FROM v2_op_reports WHERE user_id = ? AND week_number >= ? AND year = ? AND status = 'submitted'", args: [user.id, wk - 4, yr] })).rows[0] || { standups: 0, retros: 0 };

      users.push({
        id: user.id, name: user.name || user.id,
        tasks: ts, blockers: bs, projects: projCount, independentTasks: indepCount,
        completionRate: ts.total > 0 ? Math.round((ts.completed / ts.total) * 100) : 0,
        carryoverRate: ts.total > 0 ? Math.round((ts.carried_over / ts.total) * 100) : 0,
        complianceScore: rs.standups + rs.retros,
      });
    }
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}
