import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

const ROLES = ["participant","founder","staff","program_manager","super_admin","teacher","developer"];

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    // Venture tasks with due_date
    const tasks = await db.execute({ sql: "SELECT id, title, due_date as date, status, priority FROM venture_tasks WHERE venture_id = ? AND due_date IS NOT NULL ORDER BY due_date", args: [dbId] });

    // Milestones with target_date
    const milestones = await db.execute({ sql: "SELECT id, title, target_date as date, status FROM venture_milestones WHERE venture_id = ? AND target_date IS NOT NULL ORDER BY target_date", args: [dbId] });

    // Action plans with deadline
    const actions = await db.execute({ sql: "SELECT id, title, deadline as date, status, priority FROM venture_action_plans WHERE venture_id = ? AND deadline IS NOT NULL ORDER BY deadline", args: [dbId] });

    // Coaching sessions with session_date (used as follow-up meetings)
    const coachings = await db.execute({ sql: "SELECT vcs.id, CONCAT(c.name, ' Coaching') as title, vcs.session_date as date, c.name as advisor_name, vcs.location, vcs.meeting_link, vcs.start_time FROM venture_coaching_sessions vcs LEFT JOIN contacts c ON vcs.advisor_contact_id = c.cid WHERE vcs.venture_id = ? AND vcs.session_date IS NOT NULL ORDER BY vcs.session_date", args: [dbId] });

    // Follow-up dates as separate events
    const followups = await db.execute({ sql: "SELECT vcs.id, CONCAT('Follow-up: ', c.name) as title, vcs.follow_up_date as date, c.name as advisor_name FROM venture_coaching_sessions vcs LEFT JOIN contacts c ON vcs.advisor_contact_id = c.cid WHERE vcs.venture_id = ? AND vcs.follow_up_date IS NOT NULL ORDER BY vcs.follow_up_date", args: [dbId] });

    const events = [
      ...(tasks.rows||[]).map(t => ({ type: "task", id: t.id, title: t.title, date: t.date, status: t.status, priority: t.priority })),
      ...(milestones.rows||[]).map(m => ({ type: "milestone", id: m.id, title: m.title, date: m.date, status: m.status })),
      ...(actions.rows||[]).map(a => ({ type: "action", id: a.id, title: a.title, date: a.date, status: a.status, priority: a.priority })),
      ...(coachings.rows||[]).map(c => ({ type: "coaching", id: c.id, title: c.title, date: c.date, status: "scheduled", advisor: c.advisor_name, location: c.location, meeting_link: c.meeting_link, start_time: c.start_time })),
      ...(followups.rows||[]).map(f => ({ type: "followup", id: f.id, title: f.title, date: f.date, status: "scheduled" })),
    ];

    return NextResponse.json({ success: true, events });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
