import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { requireAuth } from "@/server/auth/guards";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { isInternalStaffFamilyRole } from "@/lib/identity";
import { resolveInvestorContext } from "@/services/investor/activity";
import {
  acceptSlotAndConfirm,
  canActOnWorkspace,
  cancelMeeting,
  listMeetingWorkspacesForCaller,
  proposeSlots,
  recordMeetingOutcome,
  rescheduleMeeting,
  submitInvestorMeetingFeedback,
} from "@/services/investor/scheduling";

const forbidden = () =>
  NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 });
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function meetingWorkspaceDto(workspace) {
  return {
    id: workspace.id,
    venture_name: workspace.venture_name ?? null,
    slots: (workspace.slots || []).map((slot) => ({
      id: slot.id,
      start_at: slot.start_at,
      duration_minutes: slot.duration_minutes,
      proposer_timezone: slot.proposer_timezone,
      proposed_by_type: slot.proposed_by_type,
      status: slot.status,
    })),
    meetings: (workspace.meetings || []).map((meeting) => ({
      id: meeting.id,
      start_at: meeting.start_at,
      scheduled_date: meeting.scheduled_date,
      scheduled_time: meeting.scheduled_time,
      duration_minutes: meeting.duration_minutes,
      video_link: meeting.video_link,
      status: meeting.status,
      my_feedback: meeting.my_feedback ?? null,
    })),
  };
}

/**
 * GET /api/investor/meetings/slots
 *   The caller's workspaces (investor owner, founder, or studio), each with its
 *   proposed slots and meetings. Used by the founder meeting surface.
 */
export async function GET() {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuth();
    if (authError) return authError;

    const result = await listMeetingWorkspacesForCaller({ session: await getSession() });
    return NextResponse.json({
      success: true,
      workspaces: result.workspaces.map(meetingWorkspaceDto),
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/investor/meetings/slots  { workspace_id, slots[], timezone }
 *   Either side proposes up to 3 slots. The caller must be the investor owner,
 *   a founder of the venture, or studio.
 */
export async function POST(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const { workspace_id, slots, timezone } = await req.json();
    if (!workspace_id) {
      return NextResponse.json({ success: false, error: "workspace_id required" }, { status: 400 });
    }

    const allowed = await canActOnWorkspace({ session, workspaceId: workspace_id });
    if (!allowed) return forbidden();

    const ctx = await resolveInvestorContext(session);
    const result = await proposeSlots({
      workspaceId: workspace_id,
      slots,
      proposerId: ctx.userId || session?.cid || null,
      timezone,
      session,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, slots: result.slots });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT — { action, ... }
 *   accept      { slot_id, video_link? }                     (either side)
 *   reschedule  { meeting_id, start_at, ... }                (either side)
 *   cancel      { meeting_id, reason? }                      (either side)
 *   feedback    { meeting_id, interest, note? }              (investor)
 *   outcome     { meeting_id, status, outcome_code, note? }  (studio)
 */
export async function PUT(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const action = body?.action;
    const session = await getSession();

    if (action === "accept") {
      const allowed = await canActOnWorkspace({ session, workspaceId: body.workspace_id });
      if (!allowed) return forbidden();

      const result = await acceptSlotAndConfirm({
        slotId: body.slot_id,
        expectedWorkspaceId: body.workspace_id,
        videoLink: body.video_link ?? null,
        session,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, meeting: result.meeting });
    }

    if (action === "reschedule") {
      const result = await rescheduleMeeting({
        meetingId: body.meeting_id,
        startAt: body.start_at,
        durationMinutes: body.duration_minutes ?? null,
        timezone: body.timezone ?? null,
        session,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, meeting: result.meeting, email_sent: result.emailSent });
    }

    if (action === "cancel") {
      const result = await cancelMeeting({ meetingId: body.meeting_id, reason: body.reason ?? null, session });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, meeting: result.meeting, email_sent: result.emailSent });
    }

    if (action === "feedback") {
      const result = await submitInvestorMeetingFeedback({
        meetingId: body.meeting_id,
        interest: body.interest,
        note: body.note ?? null,
        session,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, feedback: result.feedback });
    }

    if (action === "outcome") {
      if (!isInternalStaffFamilyRole(session?.role)) return forbidden();
      const result = await recordMeetingOutcome({
        meetingId: body.meeting_id,
        status: body.status,
        outcomeCode: body.outcome_code ?? null,
        note: body.note ?? null,
        actionItems: body.action_items ?? null,
        session,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, meeting: result.meeting });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
