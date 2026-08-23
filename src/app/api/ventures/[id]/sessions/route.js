import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  listSessions, getSession, createSession, updateSession, cancelSession,
  rescheduleSession, deleteSession, addSessionNote, recordAttendance,
  createActionItem, updateActionItem,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const s = new URL(req.url).searchParams;
  const sessions = await listSessions(id, {
    startDate: s.get("start_date"), endDate: s.get("end_date"),
    status: s.get("status"), coachId: s.get("coach_id"), limit: s.get("limit"),
  });
  return NextResponse.json({ success: true, sessions });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const body = await req.json();
  const { action } = body;

  if (action === "create_session") {
    try {
      const r = await createSession({
        ventureId: id, title: body.title, description: body.description,
        sessionType: body.session_type, coachId: body.coach_id, coachName: body.coach_name,
        founderCid: body.founder_cid, founderName: body.founder_name,
        startTime: body.start_time, endTime: body.end_time, timezone: body.timezone,
        location: body.location, meetingLink: body.meeting_link, agenda: body.agenda,
        createdBy: req.session?.cid,
      });
      return NextResponse.json({ success: true, session_id: r.id });
    } catch (e) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
  }

  if (action === "update_session") {
    try {
      await updateSession(parseInt(body.session_id), body.updates);
      const sess = await getSession(parseInt(body.session_id));
      return NextResponse.json({ success: true, session: sess });
    } catch (e) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
  }

  if (action === "cancel_session") {
    await cancelSession(parseInt(body.session_id));
    return NextResponse.json({ success: true });
  }

  if (action === "reschedule_session") {
    try {
      await rescheduleSession(parseInt(body.session_id), body.start_time, body.end_time);
      return NextResponse.json({ success: true });
    } catch (e) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
  }

  if (action === "delete_session") {
    await deleteSession(parseInt(body.session_id));
    return NextResponse.json({ success: true });
  }

  if (action === "get_session") {
    const sess = await getSession(parseInt(body.session_id));
    if (!sess) return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
    return NextResponse.json({ success: true, session: sess });
  }

  if (action === "add_note") {
    const r = await addSessionNote({ sessionId: parseInt(body.session_id), noteType: body.note_type, content: body.content, authorCid: req.session?.cid, authorName: req.session?.name });
    return NextResponse.json({ success: true, note_id: r.id });
  }

  if (action === "record_attendance") {
    await recordAttendance({ sessionId: parseInt(body.session_id), participantCid: body.participant_cid, participantName: body.participant_name, participantType: body.participant_type, status: body.status });
    return NextResponse.json({ success: true });
  }

  if (action === "create_action_item") {
    const r = await createActionItem({ sessionId: parseInt(body.session_id), title: body.title, description: body.description, ownerCid: body.owner_cid, ownerName: body.owner_name, priority: body.priority, dueDate: body.due_date });
    return NextResponse.json({ success: true, action_item_id: r.id });
  }

  if (action === "update_action_item") {
    await updateActionItem(parseInt(body.action_item_id), body.updates);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
