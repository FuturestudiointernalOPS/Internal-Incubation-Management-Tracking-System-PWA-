import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveCoachContact } from "@/lib/ventureCoach";
import {
  listSessions, getSession, createSession, updateSession, cancelSession,
  rescheduleSession, deleteSession, addSessionNote, recordAttendance,
  createActionItem, updateActionItem,
} from "@/lib/ventures";
import { notifyVentureCoach } from "@/lib/ventureNotify";

// Venture-facing session changes notify founders (in-app + email). Sessions
// created before the venture_facing flag existed (NULL) are treated as
// internal and never email founders.
async function emailVentureAboutSession(ventureParam, sess, { inAppTitle, inAppMsg, subject, lines, templateKey = null, params = null, dedupeKey = null }) {
  try {
    if (!sess || sess.venture_facing !== true) return;
    const { notifyAndEmailVentureFounders } = await import("@/lib/ventureNotify");
    const dbIdRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureParam] });
    const dbId = dbIdRes.rows?.[0]?.id;
    if (!dbId) return;
    await notifyAndEmailVentureFounders(db, {
      dbId, title: inAppTitle, message: inAppMsg, emailSubject: subject, emailLines: lines,
      context: {
        journey_stage_id: sess.journey_stage_id || null,
        milestone_id: sess.milestone_ref || null,
        session_id: sess.id || null,
      },
      templateKey, params, dedupeKey,
    });
    // Coach delivery (Phase 1): the platform user attached as coach gets the
    // same event in-app + by email (Future Studio staff or invited external).
    if (sess.coach_contact_id) {
      await notifyVentureCoach(db, {
        dbId, coachContactId: sess.coach_contact_id,
        title: inAppTitle, message: inAppMsg, emailSubject: subject, emailLines: lines,
        context: {
          journey_stage_id: sess.journey_stage_id || null,
          milestone_id: sess.milestone_ref || null,
          session_id: sess.id || null,
        },
        templateKey, params, dedupeKey: dedupeKey ? `${dedupeKey}:coach` : null,
      });
    }
  } catch (_) {}
}

function fmtWhen(t) {
  return t ? new Date(t).toLocaleString() : "";
}

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const s = new URL(req.url).searchParams;
  const sessions = await listSessions(id, {
    startDate: s.get("start_date"), endDate: s.get("end_date"),
    status: s.get("status"), coachId: s.get("coach_id"), limit: s.get("limit"),
  });
  return NextResponse.json({ success: true, sessions });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const body = await req.json();
  const { action } = body;

  if (action === "create_session") {
    try {
      // Coach identity (Phase 1): explicit coach_contact_id wins; otherwise
      // resolve the legacy catalog coach by email to a platform contact.
      let coachContactId = body.coach_contact_id ? String(body.coach_contact_id) : null;
      let resolvedCoach = null;
      if (!coachContactId && body.coach_id) {
        resolvedCoach = await resolveCoachContact(db, { coachId: parseInt(body.coach_id) });
        if (resolvedCoach) coachContactId = resolvedCoach.cid;
      }
      const r = await createSession({
        ventureId: id, title: body.title, description: body.description,
        sessionType: body.session_type, coachId: body.coach_id, coachName: body.coach_name || resolvedCoach?.name || null,
        founderCid: body.founder_cid, founderName: body.founder_name,
        startTime: body.start_time, endTime: body.end_time, timezone: body.timezone,
        location: body.location, meetingLink: body.meeting_link, agenda: body.agenda,
        ventureFacing: body.venture_facing === true,
        preparationNotes: body.preparation_notes || null,
        // Operational context: which Journey stage / milestone / task this
        // session supports (soft refs; no FK constraints).
        journeyStageId: body.journey_stage_id || null,
        milestoneRef: body.milestone_ref ? String(body.milestone_ref) : null,
        taskId: body.task_id ? parseInt(body.task_id) : null,
        coachContactId,
        createdBy: req.session?.cid,
      });
      // Coach delivery (Phase 1): the coach is added to the session — the
      // platform tells them (in-app + email), regardless of venture_facing.
      if (coachContactId) {
        try {
          const dbIdRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] });
          const dbId = dbIdRes.rows?.[0]?.id;
          if (dbId) {
            const when = body.start_time ? new Date(body.start_time).toLocaleString() : "";
            await notifyVentureCoach(db, {
              dbId, coachContactId,
              title: "Session scheduled",
              message: `You have been added to the Venture session "${body.title}"${when ? ` for ${when}` : ""}.`,
              emailSubject: "You have been added to a Venture session",
              emailLines: [
                `Session "${body.title}" has been scheduled${when ? ` for ${when}` : ""}.`,
                body.preparation_notes ? `Preparation: ${body.preparation_notes}` : "",
                body.meeting_link ? `Meeting link: ${body.meeting_link}` : "",
                "Log in to ImpactOS to see the details in your calendar.",
              ].filter(Boolean),
              context: {
                journey_stage_id: body.journey_stage_id || null,
                milestone_id: body.milestone_ref ? String(body.milestone_ref) : null,
                session_id: r.id || null,
              },
              templateKey: "venture.notif.sessionScheduled",
              params: { title: body.title, when: when ? ` for ${when}` : "" },
              dedupeKey: `session-scheduled:${r.id || ""}:coach`,
            });
          }
        } catch (_) {}
      }
      // Venture-facing sessions notify founders (in-app + email).
      if (body.venture_facing === true) {
        try {
          const { notifyAndEmailVentureFounders } = await import("@/lib/ventureNotify");
          const dbIdRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
          const dbId = dbIdRes.rows?.[0]?.id;
          if (dbId) {
            const when = body.start_time ? new Date(body.start_time).toLocaleString() : "";
            await notifyAndEmailVentureFounders(db, {
              dbId,
              title: "Session scheduled",
              message: `A session "${body.title}" has been scheduled${when ? ` for ${when}` : ""}.`,
              emailSubject: "A session has been scheduled for your Venture",
              emailLines: [
                `A session "${body.title}" has been scheduled${when ? ` for ${when}` : ""}.`,
                body.coach_name ? `With: ${body.coach_name}` : "",
                body.preparation_notes ? `Preparation: ${body.preparation_notes}` : "",
                "Log in to ImpactOS to see the details in your calendar.",
              ].filter(Boolean),
              context: {
                journey_stage_id: body.journey_stage_id || null,
                milestone_id: body.milestone_ref ? String(body.milestone_ref) : null,
                session_id: r.id || null,
              },
              templateKey: "venture.notif.sessionScheduled",
              params: { title: body.title, when: when ? ` for ${when}` : "" },
              dedupeKey: `session-scheduled:${r.id || ""}`,
            });
          }
        } catch (_) {}
      }
      return NextResponse.json({ success: true, session_id: r.id });
    } catch (e) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
  }

  if (action === "update_session") {
    try {
      const before = await getSession(parseInt(body.session_id));
      await updateSession(parseInt(body.session_id), body.updates);
      const sess = await getSession(parseInt(body.session_id));
      if (before && sess) {
        const changed = (["start_time", "end_time", "meeting_link", "location"]).some((k) => body.updates && body.updates[k] !== undefined && String(body.updates[k]) !== String(before[k]));
        if (changed) {
          await emailVentureAboutSession(id, sess, {
            inAppTitle: "Session updated",
            inAppMsg: `Session "${sess.title}" has been updated.`,
            subject: "Your Venture session was updated",
            lines: [
              `Session "${sess.title}" has been updated.`,
              sess.start_time ? `New time: ${fmtWhen(sess.start_time)}` : "",
              sess.meeting_link ? `Meeting link: ${sess.meeting_link}` : "",
              "Log in to ImpactOS to see the details.",
            ].filter(Boolean),
            templateKey: "venture.notif.sessionUpdated",
            params: { title: sess.title },
            dedupeKey: `session-updated:${sess.id}`,
          });
        }
      }
      return NextResponse.json({ success: true, session: sess });
    } catch (e) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
  }

  if (action === "cancel_session") {
    const sess = await getSession(parseInt(body.session_id));
    await cancelSession(parseInt(body.session_id));
    if (sess) {
      await emailVentureAboutSession(id, sess, {
        inAppTitle: "Session cancelled",
        inAppMsg: `Session "${sess.title}" has been cancelled.`,
        subject: "Your Venture session was cancelled",
        lines: [
          `Session "${sess.title}" has been cancelled.`,
          sess.start_time ? `Was scheduled for: ${fmtWhen(sess.start_time)}` : "",
          "Log in to ImpactOS to see your updated calendar.",
        ].filter(Boolean),
        templateKey: "venture.notif.sessionCancelled",
        params: { title: sess.title },
        dedupeKey: `session-cancelled:${sess.id}`,
      });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "reschedule_session") {
    try {
      await rescheduleSession(parseInt(body.session_id), body.start_time, body.end_time);
      const sess = await getSession(parseInt(body.session_id));
      if (sess) {
        await emailVentureAboutSession(id, sess, {
          inAppTitle: "Session rescheduled",
          inAppMsg: `Session "${sess.title}" has been rescheduled${sess.start_time ? ` to ${fmtWhen(sess.start_time)}` : ""}.`,
          subject: "Your Venture session was rescheduled",
          lines: [
            `Session "${sess.title}" has been rescheduled.`,
            sess.start_time ? `New time: ${fmtWhen(sess.start_time)}` : "",
            sess.meeting_link ? `Meeting link: ${sess.meeting_link}` : "",
            "Log in to ImpactOS to see the details.",
          ].filter(Boolean),
          templateKey: "venture.notif.sessionRescheduled",
          params: { title: sess.title },
          dedupeKey: `session-rescheduled:${sess.id}`,
        });
      }
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
