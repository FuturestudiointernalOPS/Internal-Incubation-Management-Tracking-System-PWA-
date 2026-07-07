import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
    if (authError) return authError;
    const { id } = await params;

    const now = new Date();
    const w = getWeekNumber(now);
    const y = now.getFullYear();

    const taskStats = await db.execute({
      sql: `SELECT COUNT(*) AS t, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS c,
            SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS ip,
            SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) AS b,
            SUM(CASE WHEN status='carried_over' THEN 1 ELSE 0 END) AS co
            FROM tasks WHERE project_id::text = \$1`, args: [id] });
    const ts = taskStats.rows[0] || {};
    const total = parseInt(ts.t) || 0;
    const completed = parseInt(ts.c) || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const activeBlockers = parseInt(ts.b) || 0;

    const recent = await db.execute({
      sql: "SELECT title, status FROM tasks WHERE project_id::text = \$1 ORDER BY updated_at DESC LIMIT 10", args: [id] });

    const summary = `Week ${w}, ${y} — ${progress}% complete (${completed}/${total}) | ${ts.ip || 0} active | ${activeBlockers} blocked | ${ts.co || 0} carry-over`;
    const details = recent.rows.map(t => `• ${t.title} (${t.status})`).join("\n");

    const overall = activeBlockers > 0 ? "blocked" : (ts.co || 0) > (total * 0.3) ? "at_risk" : "on_track";

    const exist = await db.execute({
      sql: "SELECT id FROM v2_project_updates WHERE project_id::text = \$1 AND week_number = \$2 AND year = \$3",
      args: [id, w, y] });

    if (exist.rows.length > 0) {
      await db.execute({
        sql: "UPDATE v2_project_updates SET accomplishments=\$1, current_focus=\$2, overall_status=\$3, notes=\$4, updated_at=NOW() WHERE id=\$5",
        args: [summary, details, overall, "Auto-generated", exist.rows[0].id] });
    } else {
      await db.execute({
        sql: "INSERT INTO v2_project_updates (project_id,user_id,user_name,week_number,year,status,accomplishments,current_focus,overall_status,notes) VALUES (\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10)",
        args: [id, "system", "System", w, y, "submitted", summary, details, overall, "Auto-generated"] });
    }

    return NextResponse.json({ success: true, week: w, year: y, progress, summary });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
