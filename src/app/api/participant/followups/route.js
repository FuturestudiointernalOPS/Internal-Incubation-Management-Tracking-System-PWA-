import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getFollowupEventsByParticipant,
  getFollowupTableRowsByParticipant,
} from "@/models/participantPortal";

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
  const result = await getFollowupEventsByParticipant(cid);

  // Also check v2_followups table for any follow-ups
  let followupRows = [];
  try {
    const fuRes = await getFollowupTableRowsByParticipant(cid);
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
