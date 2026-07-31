import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const [tasks, milestones, actions, coaching, followups] = await Promise.all([
      db.execute({ sql: "SELECT id, title, due_date, status FROM venture_tasks WHERE venture_id = ? ORDER BY due_date", args: [dbId] }),
      db.execute({ sql: "SELECT id, title, target_date, status FROM venture_milestones WHERE venture_id = ? AND target_date IS NOT NULL ORDER BY target_date", args: [dbId] }),
      db.execute({ sql: "SELECT id, title, deadline FROM venture_action_plans WHERE venture_id = ? AND deadline IS NOT NULL ORDER BY deadline", args: [dbId] }),
      db.execute({ sql: "SELECT id, session_date, observations, location FROM venture_coaching_sessions WHERE venture_id = ? AND session_date IS NOT NULL ORDER BY session_date", args: [dbId] }),
      db.execute({ sql: "SELECT id, follow_up_date, notes FROM venture_coaching_sessions WHERE venture_id = ? AND follow_up_date IS NOT NULL ORDER BY follow_up_date", args: [dbId] }),
    ]);

    const events = [
      ...(tasks.rows||[]).map(t => ({ type: "task", id: t.id, title: t.title, date: t.due_date || null, status: t.status })),
      ...(milestones.rows||[]).map(m => ({ type: "milestone", id: m.id, title: m.title, date: m.target_date, status: m.status })),
      ...(actions.rows||[]).map(a => ({ type: "action", id: a.id, title: a.title, date: a.deadline, status: null })),
      ...(coaching.rows||[]).map(c => ({ type: "coaching", id: c.id, title: c.observations || "Coaching Session", date: c.session_date, status: null, location: c.location })),
      ...(followups.rows||[]).map(f => ({ type: "followup", id: f.id, title: f.notes || "Follow-up", date: f.follow_up_date, status: null })),
    ].sort((a,b) => (a.date||"") > (b.date||"") ? 1 : -1);

    return NextResponse.json({ success: true, events });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
