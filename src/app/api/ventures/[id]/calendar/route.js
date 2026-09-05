import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  getVentureDbIdForCalendar,
  listVentureActionPlansWithDeadlines,
  listVentureCoachingFollowUpDates,
  listVentureCoachingSessionsForCalendar,
  listVentureMilestonesWithTargetDates,
  listVentureTasksWithDueDates,
} from "@/models/ventureWorkspace";

async function resolveVentureDbId(ventureId) {
  const r = await getVentureDbIdForCalendar(ventureId);
  return r.rows?.[0]?.id || null;
}

const ROLES = ["participant","founder","staff","program_manager","super_admin","teacher","developer"];

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    // Venture tasks with due_date
    const tasks = await listVentureTasksWithDueDates(dbId);

    // Milestones with target_date
    const milestones = await listVentureMilestonesWithTargetDates(dbId);

    // Action plans with deadline
    const actions = await listVentureActionPlansWithDeadlines(dbId);

    // Coaching sessions with session_date (used as follow-up meetings)
    const coachings = await listVentureCoachingSessionsForCalendar(dbId);

    // Follow-up dates as separate events
    const followups = await listVentureCoachingFollowUpDates(dbId);

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
