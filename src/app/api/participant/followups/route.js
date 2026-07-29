import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

/**
 * PARTICIPANT FOLLOW-UPS API
 * Returns follow-up meetings for the authenticated participant.
 * Reads from v2_events where participant_id matches the session CID.
 */
export const GET = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const cid = session.cid;

  // Query v2_events for followup events matching this participant
  const result = await db.execute({
    sql: `SELECT e.id, e.title, e.description, e.start_time, e.end_time,
                 e.event_type, e.location as meeting_link, e.created_by, e.program_id,
                 p.name as program_name
          FROM v2_events e
          LEFT JOIN v2_programs p ON e.program_id::text = p.id::text
          WHERE e.event_type = 'followup'
            AND e.participant_id = ?
          ORDER BY e.start_time DESC`,
    args: [cid],
  });

  // Also check v2_followups table for any follow-ups
  let followupRows = [];
  try {
    const fuRes = await db.execute({
      sql: `SELECT f.id as fu_id, f.comment, f.scheduled_at, f.duration_minutes, 
                   f.meeting_link, f.notes, f.status as fu_status,
                   p.name as program_name
            FROM v2_followups f
            LEFT JOIN v2_programs p ON f.program_id::text = p.id::text
            LEFT JOIN v2_submissions s ON f.submission_id::text = s.id::text
            WHERE s.participant_id = ?
            ORDER BY f.scheduled_at DESC`,
      args: [cid],
    });
    followupRows = fuRes.rows || [];
  } catch (_) {}

  // Merge: events + followups
  const events = (result.rows || []).map(e => ({
    id: `evt-${e.id}`,
    program_name: e.program_name,
    title: e.title,
    description: e.description,
    scheduled_at: e.start_time,
    duration_minutes: e.end_time ? Math.round((new Date(e.end_time) - new Date(e.start_time)) / 60000) : 30,
    meeting_link: e.meeting_link,
    status: 'scheduled',
  }));

  const fups = followupRows.map(f => ({
    id: `fu-${f.fu_id}`,
    program_name: f.program_name,
    title: f.comment || 'Follow-up meeting',
    description: f.notes,
    scheduled_at: f.scheduled_at,
    duration_minutes: f.duration_minutes || 30,
    meeting_link: f.meeting_link,
    status: f.fu_status || 'scheduled',
  }));

  const all = [...events, ...fups];
  // Sort by scheduled_at descending
  all.sort((a, b) => new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0));

  return NextResponse.json({ success: true, followups: all });
});
