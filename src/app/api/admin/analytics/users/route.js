import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get("user_id");

    const usersRes = await db.execute({
      sql: `SELECT DISTINCT u.user_id AS id, COALESCE(c.name, u.user_name) AS name
            FROM (SELECT user_id, user_name FROM tasks UNION SELECT owner_id, name FROM v2_projects WHERE owner_id IS NOT NULL) u
            LEFT JOIN contacts c ON u.user_id = c.cid OR u.user_id = c.id ORDER BY name`,
    });

    let userRows = usersRes.rows;
    if (filterUserId) userRows = userRows.filter((u) => u.id === filterUserId);
    const ids = userRows.map((u) => u.id);

    // Batch all five per-user aggregations into grouped queries over ALL ids
    // instead of 5 DB round-trips PER user. Produces identical per-user values.
    const taskMap = {};
    const blockerMap = {};
    const projMap = {};
    const indepMap = {};
    const reportMap = {};

    if (ids.length > 0) {
      const idsPh = ids.map(() => "?").join(",");

      const [tasksRes, blockersRes, projRes, indepRes, reportsRes] = await Promise.all([
        db.execute({
          sql: `SELECT user_id::text AS uid,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
                COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked,
                COUNT(*) FILTER (WHERE status = 'carried_over')::int AS carried_over,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
                FROM tasks WHERE user_id::text IN (${idsPh})
                GROUP BY user_id::text`,
          args: ids,
        }),
        db.execute({
          sql: `SELECT user_id::text AS uid,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active
                FROM blockers WHERE user_id::text IN (${idsPh})
                GROUP BY user_id::text`,
          args: ids,
        }),
        db.execute({
          sql: `SELECT u.uid, COUNT(DISTINCT u.pid)::int AS count
                FROM (
                  SELECT user_id::text AS uid, NULL::text AS pid FROM tasks
                    WHERE user_id::text IN (${idsPh}) AND project_id IS NOT NULL
                  UNION ALL
                  SELECT id::text AS uid, id::text AS pid FROM v2_projects
                    WHERE owner_id::text IN (${idsPh})
                ) u
                GROUP BY u.uid`,
          args: [...ids, ...ids],
        }),
        db.execute({
          sql: `SELECT user_id::text AS uid, COUNT(*)::int AS count
                FROM tasks WHERE user_id::text IN (${idsPh}) AND project_id IS NULL
                GROUP BY user_id::text`,
          args: ids,
        }),
        db.execute({
          sql: `SELECT user_id::text AS uid,
                COUNT(*) FILTER (WHERE report_type = 'standup')::int AS standups,
                COUNT(*) FILTER (WHERE report_type = 'retro')::int AS retros
                FROM v2_op_reports WHERE user_id::text IN (${idsPh})
                  AND week_number >= ? AND year = ? AND status = 'submitted'
                GROUP BY user_id::text`,
          args: [...ids, wk - 4, yr],
        }),
      ]);

      for (const r of tasksRes.rows || []) taskMap[r.uid] = r;
      for (const r of blockersRes.rows || []) blockerMap[r.uid] = r;
      for (const r of projRes.rows || []) projMap[r.uid] = r;
      for (const r of indepRes.rows || []) indepMap[r.uid] = r;
      for (const r of reportsRes.rows || []) reportMap[r.uid] = r;
    }

    const wk = getWeekNumber(new Date());
    const yr = new Date().getFullYear();

    const users = userRows.map((user) => {
      const idKey = String(user.id);
      const ts = taskMap[idKey] || {
        total: 0,
        completed: 0,
        in_progress: 0,
        blocked: 0,
        carried_over: 0,
        pending: 0,
      };
      const bs = blockerMap[idKey] || { total: 0, active: 0 };
      const projCount = projMap[idKey]?.count || 0;
      const indepCount = indepMap[idKey]?.count || 0;
      const rs = reportMap[idKey] || { standups: 0, retros: 0 };

      return {
        id: user.id,
        name: user.name || user.id,
        tasks: ts,
        blockers: bs,
        projects: projCount,
        independentTasks: indepCount,
        completionRate:
          ts.total > 0 ? Math.round((ts.completed / ts.total) * 100) : 0,
        carryoverRate:
          ts.total > 0 ? Math.round((ts.carried_over / ts.total) * 100) : 0,
        complianceScore: rs.standups + rs.retros,
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

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}
