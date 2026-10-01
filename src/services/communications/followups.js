/**
 * FOLLOW-UPS — the create / update use-cases.
 *
 * Creating a follow-up also writes a calendar event (end = start + duration) and,
 * when linked to a submission, moves that submission to `pending_followup`. Both
 * side effects are non-blocking. The facilitator team guard stays on the route
 * (it answers HTTP).
 *
 * Reads and writes go through `@/models/communications`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  ensureFollowupsCreatedByColumn,
  insertFollowup,
  insertFollowupCalendarEvent,
  markSubmissionPendingFollowup,
  updateFollowup,
} from "@/models/communications";

/** Ensure the created_by column exists (safe migration). */
export async function ensureFollowupSchema() {
  try {
    await ensureFollowupsCreatedByColumn();
  } catch (_) {}
}

/** Create a follow-up, its calendar event, and move the linked submission. */
export async function createFollowup({ session, payload }) {
  const {
    program_id,
    participant_id,
    submission_id,
    week_number,
    comment,
    scheduled_at,
    duration_minutes,
    meeting_link,
    notes,
  } = payload || {};

  // Create follow-up record
  const result = await insertFollowup({
    programId: program_id,
    participantId: participant_id,
    submissionId: submission_id,
    weekNumber: week_number,
    comment,
    scheduledAt: scheduled_at,
    durationMinutes: duration_minutes,
    meetingLink: meeting_link,
    notes,
    createdBy: session.cid,
  });

  // Create calendar event in v2_events
  try {
    const scheduledDate = new Date(scheduled_at);
    const endDate = new Date(scheduledDate.getTime() + (duration_minutes || 30) * 60000);

    await insertFollowupCalendarEvent({
      programId: program_id,
      title: comment ? `Follow-up: ${comment.substring(0, 50)}` : "Follow-up Meeting",
      description: notes || comment || null,
      startTime: scheduledDate.toISOString(),
      endTime: endDate.toISOString(),
      participantId: participant_id,
      createdBy: session.cid,
    });
  } catch (_) {
    // Calendar event creation is non-blocking
  }

  // If linked to a submission, update submission status to pending_followup
  if (submission_id) {
    try {
      await markSubmissionPendingFollowup(submission_id);
    } catch (_) {}
  }

  return result.rows[0];
}

/** Apply an update to a follow-up record. */
export async function updateFollowupRecord({ id, status, notes, meetingLink, scheduledAt }) {
  await updateFollowup({
    id,
    status,
    notes,
    meetingLink,
    scheduledAt,
  });
}
