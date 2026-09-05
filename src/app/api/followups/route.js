import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession, requireAssignmentAccess, getFacilitatorTeamScope, hasProgramManagementAccess } from "@/lib/auth";
import {
  ensureFollowupsCreatedByColumn,
  getFollowupById,
  insertFollowup,
  insertFollowupCalendarEvent,
  isContactInFacilitatorTeams,
  isContactInFacilitatorTeamsForUpdate,
  listFollowups,
  markSubmissionPendingFollowup,
  updateFollowup,
} from "@/models/communications";

async function ensureFollowupSchema() {
  try {
    await ensureFollowupsCreatedByColumn();
  } catch (_) {}
}

/**
 * For facilitators, resolve program assignment + team scope and return a guard.
 * Returns null for non-facilitators (no restriction).
 */
async function getFacilitatorScopeGuard(req, programId) {
  const session = await getSession();
  if (session && hasProgramManagementAccess(session.role)) return null;
  if (!programId) {
    return {
      deny: true,
      response: NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      ),
    };
  }
  const guardError = await requireAssignmentAccess({
    resource: "program",
    contextId: programId,
  });
  if (guardError) return { deny: true, response: guardError };
  const scope = await getFacilitatorTeamScope(programId, session.cid);
  return { scope };
}

/**
 * FOLLOW-UPS API — TRACK 3 ENHANCED
 *
 * Supports creating and listing follow-up meetings.
 * Follow-ups are linked to submissions, participants, and programs.
 * Creating a follow-up also creates a calendar event in v2_events.
 */

export const GET = createHandler(
  { roles: ["staff", "super_admin", "teacher", "program_manager", "facilitator", "participant"] },
  async (req) => {
    await ensureFollowupSchema();
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const participantId = searchParams.get("participant_id");
    const submissionId = searchParams.get("submission_id");
    const status = searchParams.get("status");

    // Follow-up SQL (filters + visibility scoping) assembled in
    // src/models/communications.js (listFollowups)
    const result = await listFollowups({
      programId,
      participantId,
      submissionId,
      status,
      session,
    });
    return NextResponse.json({ success: true, followups: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin", "teacher", "program_manager", "facilitator"] },
  async (req) => {
    await ensureFollowupSchema();
    const session = await getSession();
    const body = await req.json();
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
    } = body;

    if (!program_id || !scheduled_at) {
      return NextResponse.json(
        { success: false, error: "Program ID and scheduled date are required" },
        { status: 400 },
      );
    }

    // Facilitators may only create follow-ups for participants in their teams.
    const scopeGuard = await getFacilitatorScopeGuard(req, program_id);
    if (scopeGuard?.deny) return scopeGuard.response;
    if (scopeGuard && scopeGuard.scope.scope !== "all") {
      if (!participant_id || scopeGuard.scope.teamIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const inScope = await isContactInFacilitatorTeams(
        participant_id,
        scopeGuard.scope.teamIds,
      );
      if (inScope.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
    }

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

    return NextResponse.json({ success: true, followup: result.rows[0] });
  },
);

export const PATCH = createHandler(
  { roles: ["staff", "super_admin", "teacher", "program_manager", "facilitator"] },
  async (req) => {
    const { id, status, notes, meeting_link, scheduled_at } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Follow-up ID required" },
        { status: 400 },
      );
    }

    // Facilitators may only update follow-ups for participants in their teams.
    const followupRes = await getFollowupById(id);
    const followup = followupRes.rows[0];
    if (followup) {
      const scopeGuard = await getFacilitatorScopeGuard(req, followup.program_id);
      if (scopeGuard?.deny) return scopeGuard.response;
      if (scopeGuard && scopeGuard.scope.scope !== "all") {
        if (!followup.participant_id || scopeGuard.scope.teamIds.length === 0) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
        const inScope = await isContactInFacilitatorTeamsForUpdate(
          followup.participant_id,
          scopeGuard.scope.teamIds,
        );
        if (inScope.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
      }
    }

    await updateFollowup({
      id,
      status,
      notes,
      meetingLink: meeting_link,
      scheduledAt: scheduled_at,
    });

    return NextResponse.json({ success: true });
  },
);

// Also serve participant-facing follow-up list
export { GET as participantGET };
