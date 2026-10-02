/**
 * FOLLOW-UPS — the create / update use-cases.
 *
 * Creating a follow-up also writes a calendar event (end = start + duration) and,
 * when linked to a submission, moves that submission to `pending_followup`. Both
 * side effects are non-blocking. The facilitator team-membership check lives
 * here, along with assignment and update scope decisions; HTTP responses stay
 * on the route.
 *
 * Reads and writes go through `@/models/communications`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import { getSession } from "@/server/auth/session";
import { hasProgramManagementAccess } from "@/server/authz/capabilities";
import { getFacilitatorTeamScope } from "@/models/authorization/accessQueries";
import { evaluateAssignmentAccess } from "@/services/authorization/resourceGuards";

import {
  getFollowupById,
  ensureFollowupsCreatedByColumn,
  insertFollowup,
  insertFollowupCalendarEvent,
  markSubmissionPendingFollowup,
  updateFollowup,
  isContactInFacilitatorTeams,
  isContactInFacilitatorTeamsForUpdate,
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

/**
 * Is this participant inside the facilitator's team scope? False when there is
 * no participant or the facilitator has no team (nothing to match against);
 * otherwise true only when a team lookup finds the participant. `forUpdate`
 * picks the lookup used by the update path; the two queries are kept distinct.
 * The route turns a false answer into a 403.
 */
export async function isParticipantInFacilitatorScope(
  scope,
  participantId,
  { forUpdate = false } = {},
) {
  if (!participantId || scope.teamIds.length === 0) return false;
  const lookup = forUpdate
    ? isContactInFacilitatorTeamsForUpdate
    : isContactInFacilitatorTeams;
  const inScope = await lookup(participantId, scope.teamIds);
  return inScope.rows.length > 0;
}

/** Assignment and participant scope are decisions; callers serialize refusals. */
export async function evaluateFollowupParticipantAccess({ session, programId, participantId, forUpdate = false }) {
  if (session && hasProgramManagementAccess(session.role)) return { allowed: true };
  if (!programId) return { allowed: false, status: 403, errorKey: "errors.insufficientPermissions" };
  const assignment = await evaluateAssignmentAccess({ resource: "program", contextId: programId });
  if (!assignment.allowed) return assignment;
  const scope = await getFacilitatorTeamScope(programId, session.cid);
  if (scope.scope !== "all" && !(await isParticipantInFacilitatorScope(scope, participantId, { forUpdate }))) {
    return { allowed: false, status: 403, errorKey: "errors.insufficientPermissions" };
  }
  return { allowed: true };
}

/** Preserve the legacy missing-record update and check scope before any write. */
export async function updateScopedFollowup(update) {
  const result = await getFollowupById(update.id);
  const followup = result.rows[0];
  if (followup) {
    const session = await getSession();
    const access = await evaluateFollowupParticipantAccess({ session, programId: followup.program_id, participantId: followup.participant_id, forUpdate: true });
    if (!access.allowed) return access;
  }
  await updateFollowupRecord(update);
  return { allowed: true };
}
