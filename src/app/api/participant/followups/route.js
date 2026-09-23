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
export const GET = createHandler(async (_req) => {
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
    const followupTableResult = await getFollowupTableRowsByParticipant(cid);
    followupRows = followupTableResult.rows || [];
  } catch (_) {}

  // Merge: events + followups
  const events = (result.rows || []).map(event => ({
    id: `evt-${event.id}`,
    program_name: event.program_name,
    title: event.title,
    description: event.description,
    scheduled_at: event.start_time,
    duration_minutes: event.end_time ? Math.round((new Date(event.end_time) - new Date(event.start_time)) / 60000) : 30,
    meeting_link: event.meeting_link,
    status: 'scheduled',
  }));

  const followups = followupRows.map(followup => ({
    id: `fu-${followup.fu_id}`,
    program_name: followup.program_name,
    title: followup.comment || 'Follow-up meeting',
    description: followup.notes,
    scheduled_at: followup.scheduled_at,
    duration_minutes: followup.duration_minutes || 30,
    meeting_link: followup.meeting_link,
    status: followup.fu_status || 'scheduled',
  }));

  const all = [...events, ...followups];
  // Sort by scheduled_at descending
  all.sort((first, second) => new Date(second.scheduled_at || 0) - new Date(first.scheduled_at || 0));

  return NextResponse.json({ success: true, followups: all });
});
