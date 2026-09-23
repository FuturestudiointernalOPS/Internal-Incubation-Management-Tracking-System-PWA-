import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  getVentureDbIdForCalendar,
  listVentureActionPlansWithDeadlines,
  listVentureCoachingFollowUpDates,
  listVentureCoachingSessionsForCalendar,
  listVentureMilestonesWithTargetDates,
  listVentureTasksWithDueDates,
} from "@/models/ventureWorkspace";

async function resolveVentureDbId(ventureId) {
  const ventureResult = await getVentureDbIdForCalendar(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}


export async function GET(req, { params }) {
  try { await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
    const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

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

    // Canonical sessions (venture_sessions) — ONLY rows staff explicitly marked
    // Venture-facing. Internal sessions never surface on the founder calendar.
    // venture_sessions keys on the VNT code; match both id forms defensively.
    const sessions = await db.execute({ sql: `SELECT id, title, session_type, coach_name, location, meeting_link, status,
        preparation_notes, milestone_ref, journey_stage_id,
        to_char(start_time, 'YYYY-MM-DD') as date, to_char(start_time, 'HH24:MI') as start_time
        FROM venture_sessions WHERE venture_facing = TRUE AND start_time IS NOT NULL AND (venture_id = ? OR venture_id = ?)
        ORDER BY start_time`, args: [id, dbId] }).catch(() => ({ rows: [] }));

    const events = [
      ...(tasks.rows||[]).map(task => ({ type: "task", id: task.id, title: task.title, date: task.date, status: task.status, priority: task.priority })),
      ...(milestones.rows||[]).map(milestone => ({ type: "milestone", id: milestone.id, title: milestone.title, date: milestone.date, status: milestone.status })),
      ...(actions.rows||[]).map(action => ({ type: "action", id: action.id, title: action.title, date: action.date, status: action.status, priority: action.priority })),
      ...(coachings.rows||[]).map(coaching => ({ type: "coaching", id: coaching.id, title: coaching.title, date: coaching.date, status: "scheduled", advisor: coaching.advisor_name, location: coaching.location, meeting_link: coaching.meeting_link, start_time: coaching.start_time })),
      ...(followups.rows||[]).map(followup => ({ type: "followup", id: followup.id, title: followup.title, date: followup.date, status: "scheduled" })),
      ...(sessions.rows||[]).map(sessionRow => ({ type: "session", id: sessionRow.id, title: sessionRow.title, date: sessionRow.date, status: sessionRow.status || "scheduled", start_time: sessionRow.start_time, advisor: sessionRow.coach_name, location: sessionRow.location, meeting_link: sessionRow.meeting_link, preparation: sessionRow.preparation_notes, milestone_ref: sessionRow.milestone_ref, journey_stage_id: sessionRow.journey_stage_id })),
    ];

    return NextResponse.json({ success: true, events });
  } catch(error) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}
