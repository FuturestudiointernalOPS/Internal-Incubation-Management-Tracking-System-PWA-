/**
 * Participant service — the participant's follow-up meetings.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — how a calendar
 * event and a follow-up table row are each shaped, the default duration and
 * status, and the merge order. Every statement lives in
 * `@/models/participantPortal`. No SQL, no HTTP.
 */

import {
  getFollowupEventsByParticipant,
  getFollowupTableRowsByParticipant,
} from "@/models/participantPortal";

const DEFAULT_DURATION_MINUTES = 30;

/** A follow-up calendar event, in the follow-up shape. */
export function mapFollowupEvents(rows = []) {
  return rows.map((event) => ({
    id: `evt-${event.id}`,
    program_name: event.program_name,
    title: event.title,
    description: event.description,
    scheduled_at: event.start_time,
    duration_minutes: event.end_time
      ? Math.round((new Date(event.end_time) - new Date(event.start_time)) / 60000)
      : DEFAULT_DURATION_MINUTES,
    meeting_link: event.meeting_link,
    status: "scheduled",
  }));
}

/** A follow-up table row, in the same shape (defaults applied). */
export function mapFollowupRows(rows = []) {
  return rows.map((followup) => ({
    id: `fu-${followup.fu_id}`,
    program_name: followup.program_name,
    title: followup.comment || "Follow-up meeting",
    description: followup.notes,
    scheduled_at: followup.scheduled_at,
    duration_minutes: followup.duration_minutes || DEFAULT_DURATION_MINUTES,
    meeting_link: followup.meeting_link,
    status: followup.fu_status || "scheduled",
  }));
}

/** Merge both sources, most recent first. */
export function mergeFollowups(events, followups) {
  const all = [...events, ...followups];
  all.sort(
    (first, second) => new Date(second.scheduled_at || 0) - new Date(first.scheduled_at || 0),
  );
  return all;
}

/**
 * The participant's follow-ups: the calendar events plus the follow-up table,
 * merged. The table read is fail-open — a missing table contributes nothing.
 */
export async function buildParticipantFollowups(cid) {
  const result = await getFollowupEventsByParticipant(cid);

  let followupRows = [];
  try {
    const followupTableResult = await getFollowupTableRowsByParticipant(cid);
    followupRows = followupTableResult.rows || [];
  } catch (_) {}

  return mergeFollowups(
    mapFollowupEvents(result.rows || []),
    mapFollowupRows(followupRows),
  );
}
