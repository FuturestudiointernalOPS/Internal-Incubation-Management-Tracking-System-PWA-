import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { ventureOwned, ventureNotFound, resolveVentureDbId } from "@/lib/ventureOwnership";
import { listSessions, getSession, createSession, updateSession, cancelSession, rescheduleSession, deleteSession, addSessionNote, recordAttendance, createActionItem, updateActionItem } from "@/services/ventures/sessions";
import { isStaffActorForVenture } from "@/lib/ventureAuth";
import { signSessionMaterials } from "@/lib/ventureEvidence";
import { checkSessionBooking } from "@/services/ventures/sessionBooking";
import { resolveSessionBookingTargets } from "@/services/ventures/sessionBookingTargets";
import { checkSessionManagement } from "@/services/ventures/sessionAuthority";
import {
  notifySessionScheduled,
  notifySessionUpdated,
  notifySessionCancelled,
  notifySessionRescheduled,
} from "@/services/ventures/sessionNotices";


export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const searchParams = new URL(req.url).searchParams;
  const sessions = await listSessions(id, {
    startDate: searchParams.get("start_date"), endDate: searchParams.get("end_date"),
    status: searchParams.get("status"), coachId: searchParams.get("coach_id"), limit: searchParams.get("limit"),
  });
  // Session materials are private: the row stores storage paths and a viewer who
  // already passed this gate gets short-lived signed URLs — the same rule as
  // deliverable evidence, so an attachment is never world-readable.
  const signed = await Promise.all(
    (sessions || []).map(async (session) => ({
      ...session,
      materials: await signSessionMaterials(session.materials),
    })),
  );
  return NextResponse.json({ success: true, sessions: signed });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const body = await req.json();
  const { action } = body;
  const actor = access.session || req.session;

  // Object-level authorization: any action that targets an EXISTING session must
  // name a session OF THIS venture. Called from each such branch — placed AFTER
  // the management gate so a denied manager still gets its own 403 — so a
  // session id from another venture can never be updated, cancelled, deleted,
  // annotated or used as an attendance/action-item anchor.
  const sessionBelongsToVenture = async (sessionId) => {
    const dbId = await resolveVentureDbId(id);
    const targetSession = await getSession(parseInt(sessionId));
    return ventureOwned(targetSession, id, dbId);
  };

  // WHO MAY DEFINE THE CALENDAR (calendar.schedule for delegated staff):
  // services/ventures/sessionAuthority. Returns a 403 to send, or null.
  const sessionManagementDenial = async (staffActor) => {
    const refusal = await checkSessionManagement({ ventureParam: id, access, actor, staffActor });
    return refusal ? NextResponse.json(refusal, { status: 403 }) : null;
  };

  /** The same check for the bare management actions below. */
  const deniedSessionManagement = async () =>
    sessionManagementDenial(await isStaffActorForVenture(id, actor));

  if (action === "create_session") {
    try {
      // The booking rules (memo, milestone, date + lead time, materials) are a
      // service decision; the refusal is sent here, unchanged (400).
      const booking = checkSessionBooking(body);
      if (!booking.ok) {
        return NextResponse.json({ success: false, error: booking.error }, { status: 400 });
      }
      const { sessionNote, milestoneRef, materials } = booking;
      // WHO is booking decides which milestone may carry the session. The
      // Venture books only against the one milestone the chain has released;
      // Future Studio staff plan ahead and may book against any milestone. The
      // refusal carries the reason (locked / already completed / a different
      // milestone is current), so the founder is never left guessing.
      const staffActor = await isStaffActorForVenture(id, actor);
      const denied = await sessionManagementDenial(staffActor);
      if (denied) return denied;

      // Founder bookable-milestone check, the optional deliverable, the coach
      // identity: services/ventures/sessionBookingTargets.
      const targets = await resolveSessionBookingTargets({ ventureParam: id, staffActor, milestoneRef, body });
      if (targets.error) {
        return NextResponse.json({ success: false, error: targets.error }, { status: targets.status });
      }
      const { deliverableId, coachContactId, resolvedCoach } = targets;
      const createdSession = await createSession({
        ventureId: id, title: body.title, description: sessionNote,
        sessionType: body.session_type, coachId: body.coach_id, coachName: body.coach_name || resolvedCoach?.name || null,
        founderCid: body.founder_cid, founderName: body.founder_name,
        startTime: body.start_time, endTime: body.end_time, timezone: body.timezone,
        location: body.location, meetingLink: body.meeting_link, agenda: body.agenda,
        ventureFacing: body.venture_facing === true,
        preparationNotes: body.preparation_notes || null,
        // Operational context: which Journey stage / milestone / task this
        // session supports (soft refs; no FK constraints).
        journeyStageId: body.journey_stage_id || null,
        milestoneRef,
        deliverableId,
        materials,
        taskId: body.task_id ? parseInt(body.task_id) : null,
        coachContactId,
        createdBy: req.session?.cid,
      });
      // Who is told, and with which words: services/ventures/sessionNotices.
      await notifySessionScheduled({
        ventureParam: id, body, sessionNote, createdSession, coachContactId,
        actorCid: req.session?.cid,
      });
      return NextResponse.json({ success: true, session_id: createdSession.id });
    } catch (error) { return NextResponse.json({ success: false, error: error.message }, { status: 400 }); }
  }

  if (action === "update_session") {
    const denied = await deniedSessionManagement();
    if (denied) return denied;
    if (!(await sessionBelongsToVenture(body.session_id))) return ventureNotFound();
    try {
      const before = await getSession(parseInt(body.session_id));
      await updateSession(parseInt(body.session_id), body.updates);
      const session = await getSession(parseInt(body.session_id));
      if (before && session) {
        const changed = (["start_time", "end_time", "meeting_link", "location"]).some((field) => body.updates && body.updates[field] !== undefined && String(body.updates[field]) !== String(before[field]));
        if (changed) {
          await notifySessionUpdated({ ventureParam: id, session });
        }
      }
      return NextResponse.json({ success: true, session });
    } catch (error) { return NextResponse.json({ success: false, error: error.message }, { status: 400 }); }
  }

  // ── The memo, edited in place ────────────────────────────────────────────
  // A session has exactly ONE memo: the brief the Venture was told about. It
  // lives on the session row and nowhere else, and editing it REPLACES the text
  // (there is deliberately no "add another memo" — a session does not
  // accumulate briefs). The milestone record is separate and stays the
  // manager's own writing.
  if (action === "update_session_note") {
    const sessionId = parseInt(body.session_id);
    const note = String(body.note || "").trim();
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "session_id is required." }, { status: 400 });
    }
    if (!note) {
      return NextResponse.json({ success: false, error: "A memo is required." }, { status: 400 });
    }
    const session = await getSession(sessionId);
    // Object-level authorization: the memo is written only on a session OF THIS
    // venture (this also covers a session that does not exist).
    const dbId = await resolveVentureDbId(id);
    if (!ventureOwned(session, id, dbId)) return ventureNotFound();
    await updateSession(sessionId, { description: note });
    return NextResponse.json({ success: true });
  }

  if (action === "cancel_session") {
    const denied = await deniedSessionManagement();
    if (denied) return denied;
    if (!(await sessionBelongsToVenture(body.session_id))) return ventureNotFound();
    const session = await getSession(parseInt(body.session_id));
    await cancelSession(parseInt(body.session_id));
    if (session) {
      await notifySessionCancelled({ ventureParam: id, session, actorCid: req.session?.cid });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "reschedule_session") {
    const denied = await deniedSessionManagement();
    if (denied) return denied;
    if (!(await sessionBelongsToVenture(body.session_id))) return ventureNotFound();
    try {
      await rescheduleSession(parseInt(body.session_id), body.start_time, body.end_time);
      const session = await getSession(parseInt(body.session_id));
      if (session) {
        await notifySessionRescheduled({ ventureParam: id, session, actorCid: req.session?.cid });
      }
      return NextResponse.json({ success: true });
    } catch (error) { return NextResponse.json({ success: false, error: error.message }, { status: 400 }); }
  }

  if (action === "delete_session") {
    const denied = await deniedSessionManagement();
    if (denied) return denied;
    if (!(await sessionBelongsToVenture(body.session_id))) return ventureNotFound();
    await deleteSession(parseInt(body.session_id));
    return NextResponse.json({ success: true });
  }

  if (action === "get_session") {
    const session = await getSession(parseInt(body.session_id));
    const dbId = await resolveVentureDbId(id);
    if (!ventureOwned(session, id, dbId)) return ventureNotFound();
    return NextResponse.json({ success: true, session });
  }

  if (action === "add_note") {
    if (!(await sessionBelongsToVenture(body.session_id))) return ventureNotFound();
    const noteResult = await addSessionNote({ sessionId: parseInt(body.session_id), noteType: body.note_type, content: body.content, authorCid: req.session?.cid, authorName: req.session?.name });
    return NextResponse.json({ success: true, note_id: noteResult.id });
  }

  if (action === "record_attendance") {
    if (!(await sessionBelongsToVenture(body.session_id))) return ventureNotFound();
    await recordAttendance({ sessionId: parseInt(body.session_id), participantCid: body.participant_cid, participantName: body.participant_name, participantType: body.participant_type, status: body.status });
    return NextResponse.json({ success: true });
  }

  if (action === "create_action_item") {
    if (!(await sessionBelongsToVenture(body.session_id))) return ventureNotFound();
    const actionItemResult = await createActionItem({ sessionId: parseInt(body.session_id), title: body.title, description: body.description, ownerCid: body.owner_cid, ownerName: body.owner_name, priority: body.priority, dueDate: body.due_date });
    return NextResponse.json({ success: true, action_item_id: actionItemResult.id });
  }

  if (action === "update_action_item") {
    const dbId = await resolveVentureDbId(id);
    await updateActionItem(parseInt(body.action_item_id), body.updates, [id, dbId]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
