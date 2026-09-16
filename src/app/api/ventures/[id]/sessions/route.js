import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveCoachContact } from "@/lib/ventureCoach";
import {
  listSessions, getSession, createSession, updateSession, cancelSession,
  rescheduleSession, deleteSession, addSessionNote, recordAttendance,
  createActionItem, updateActionItem, getDeliverable,
} from "@/lib/ventures";
import { SESSION_MIN_LEAD_MINUTES, normalizeSessionMaterials } from "@/lib/ventureSessionRules";
import { notifyVentureCoach, notifyVentureLeadManagers } from "@/lib/ventureNotify";
import { isStaffActorForVenture } from "@/lib/ventureAuth";
import { hasVentureCapability } from "@/lib/venturePermissions";
import { resolveVentureCode } from "@/lib/ventureOperatingPlans";
import { assertBookableMilestone } from "@/lib/ventureMilestoneEngine";
import { signSessionMaterials } from "@/lib/ventureEvidence";

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

  /**
   * WHO MAY DEFINE THE CALENDAR.
   *
   * A delegated staff member may create, move or cancel a session only when
   * their RESPONSIBILITY grants `calendar.schedule`: a Coach supports the Venture
   * and attends sessions — they do not schedule them. Requiring a capability
   * every staff member already holds would block nobody, which is why the answer
   * comes from the permission matrix: the one place a responsibility differs.
   *
   * This is the only Venture permission matrix cell enforced anywhere today. It
   * is readable back through GET /api/ventures/[id]/my-access, which reports
   * exactly the cells wired here and no others — wire more, report more.
   *
   * Three deliberate exclusions:
   *   - The Venture's OWN members are untouched. A founder books and manages
   *     their own Venture's sessions; only the staff path is governed here.
   *   - Global authority is read from the gate's verdict (`access.path`), never
   *     re-derived from a role string: two derivations would drift.
   *   - PARTICIPATION is not management. Writing the memo, recording attendance
   *     and raising action items stay open — that is what a Coach is FOR.
   *
   * Returns a 403 response to send, or null to continue.
   */
  const sessionManagementDenial = async (staffActor) => {
    if (!staffActor) return null;
    if (access.path === "super-admin") return null;
    // Assignments store the VNT code; the route may receive the UUID. Zeroing
    // this conversion would deny every delegated manager on a UUID route.
    const ventureCode = await resolveVentureCode(db, id);
    const canSchedule = await hasVentureCapability(db, {
      ventureId: ventureCode,
      contactId: actor?.cid,
      area: "calendar",
      action: "schedule",
    });
    if (canSchedule) return null;
    return NextResponse.json(
      {
        success: false,
        error: "errors.insufficientPermissions",
        missing: { capability: "ventures.calendar.schedule" },
      },
      { status: 403 },
    );
  };

  /** The same check for the bare management actions below. */
  const deniedSessionManagement = async () =>
    sessionManagementDenial(await isStaffActorForVenture(db, id, actor));

  if (action === "create_session") {
    try {
      // A session is never created without its internal note: the note is the
      // record of why the session exists and what it is expected to cover.
      const sessionNote = String(body.description || body.agenda || "").trim();
      if (!sessionNote) {
        return NextResponse.json({ success: false, error: "A session note is required." }, { status: 400 });
      }
      // Vinance 3 rules: a session always belongs to a milestone (sessions
      // never exist outside one), always carries a concrete date and time, and
      // always starts at least SESSION_MIN_LEAD_MINUTES ahead of booking.
      const milestoneRef = body.milestone_ref ? String(body.milestone_ref) : null;
      if (!milestoneRef) {
        return NextResponse.json({ success: false, error: "A session must belong to a milestone." }, { status: 400 });
      }
      const startAt = body.start_time ? new Date(body.start_time) : null;
      if (!startAt || Number.isNaN(startAt.getTime())) {
        return NextResponse.json({ success: false, error: "A session date and time are required." }, { status: 400 });
      }
      if (startAt.getTime() < Date.now() + SESSION_MIN_LEAD_MINUTES * 60 * 1000) {
        return NextResponse.json(
          { success: false, error: `A session must start at least ${SESSION_MIN_LEAD_MINUTES} minutes from now.` },
          { status: 400 },
        );
      }
      // Documents the participants need for this session (a deck, a brief).
      // Only paths issued by THIS Venture's session upload route are accepted.
      const materials = normalizeSessionMaterials(body.materials);
      if (materials === null) {
        return NextResponse.json(
          { success: false, error: "The session materials are invalid (up to 5 documents)." },
          { status: 400 },
        );
      }
      // WHO is booking decides which milestone may carry the session. The
      // Venture books only against the one milestone the chain has released;
      // Future Studio staff plan ahead and may book against any milestone. The
      // refusal carries the reason (locked / already completed / a different
      // milestone is current), so the founder is never left guessing.
      const staffActor = await isStaffActorForVenture(db, id, actor);
      const denied = await sessionManagementDenial(staffActor);
      if (denied) return denied;

      if (!staffActor) {
        const vRow = await db
          .execute({ sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] })
          .catch(() => ({ rows: [] }));
        const ventureDbId = vRow.rows?.[0]?.id || null;
        const bookable = ventureDbId
          ? await assertBookableMilestone(db, { dbId: ventureDbId, milestoneId: milestoneRef })
          : { ok: false, reason: "This Venture could not be resolved, so the session was not booked." };
        if (!bookable.ok) {
          return NextResponse.json({ success: false, error: bookable.reason }, { status: 403 });
        }
      }
      // Optional: attach the session to one of the milestone's deliverables.
      let deliverableId = body.deliverable_id ? String(body.deliverable_id) : null;
      if (deliverableId) {
        const dv = await getDeliverable(deliverableId).catch(() => null);
        if (!dv || String(dv.milestone_id) !== milestoneRef) {
          return NextResponse.json({ success: false, error: "Unknown deliverable for this milestone." }, { status: 400 });
        }
      }
      // Coach identity (Phase 1): explicit coach_contact_id wins; otherwise
      // resolve the legacy catalog coach by email to a platform contact.
      let coachContactId = body.coach_contact_id ? String(body.coach_contact_id) : null;
      let resolvedCoach = null;
      if (!coachContactId && body.coach_id) {
        resolvedCoach = await resolveCoachContact(db, { coachId: parseInt(body.coach_id) });
        if (resolvedCoach) coachContactId = resolvedCoach.cid;
      }
      const r = await createSession({
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
      // ── Notices ─────────────────────────────────────────────────────────────
      // The memo lives on the SESSION and nowhere else: it is the Venture-facing
      // brief, and it travels with every notice below. The milestone record is
      // the manager's own judgement, written deliberately — never a copy of it.
      // ────────────────────────────────────────────────────────────────────────

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
              message: `You have been added to the Venture session "${body.title}"${when ? ` for ${when}` : ""}. Memo: ${sessionNote}`,
              emailSubject: "You have been added to a Venture session",
              emailLines: [
                `Session "${body.title}" has been scheduled${when ? ` for ${when}` : ""}.`,
                // The Memo is what the session is FOR — it travels with the notice.
                `Memo: ${sessionNote}`,
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
              params: { title: body.title, when: when ? ` for ${when}` : "", memo: sessionNote },
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
              message: `A session "${body.title}" has been scheduled${when ? ` for ${when}` : ""}. Memo: ${sessionNote}`,
              emailSubject: "A session has been scheduled for your Venture",
              emailLines: [
                `A session "${body.title}" has been scheduled${when ? ` for ${when}` : ""}.`,
                // The Venture is TOLD what the session is for — that is the memo.
                `Memo: ${sessionNote}`,
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
              params: { title: body.title, when: when ? ` for ${when}` : "", memo: sessionNote },
              dedupeKey: `session-scheduled:${r.id || ""}`,
            });
          }
        } catch (_) {}
      }
      // Lead Manager delivery (A8): the Venture's active Lead Managers are told
      // about the new session too (in-app + email), regardless of
      // venture_facing. The creator and an LM who is also the coach are left
      // out (they got the coach wording above).
      try {
        const lmV = await db.execute({ sql: "SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] });
        const dbId = lmV.rows?.[0]?.id;
        const ventureCode = lmV.rows?.[0]?.venture_id || id;
        if (dbId) {
          const when = body.start_time ? new Date(body.start_time).toLocaleString() : "";
          await notifyVentureLeadManagers(db, {
            dbId, ventureCode,
            title: "Session scheduled",
            message: `You have been added to the Venture session "${body.title}"${when ? ` for ${when}` : ""}. Memo: ${sessionNote}`,
            emailSubject: "You have been added to a Venture session",
            emailLines: [
              `Session "${body.title}" has been scheduled${when ? ` for ${when}` : ""}.`,
              `Memo: ${sessionNote}`,
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
            params: { title: body.title, when: when ? ` for ${when}` : "", memo: sessionNote },
            dedupeKey: `session-scheduled:${r.id}`,
            excludeCids: [req.session?.cid, coachContactId].filter(Boolean),
          });
        }
      } catch (_) {}
      return NextResponse.json({ success: true, session_id: r.id });
    } catch (e) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
  }

  if (action === "update_session") {
    const denied = await deniedSessionManagement();
    if (denied) return denied;
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
    const sess = await getSession(sessionId);
    if (!sess) return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
    await updateSession(sessionId, { description: note });
    return NextResponse.json({ success: true });
  }

  if (action === "cancel_session") {
    const denied = await deniedSessionManagement();
    if (denied) return denied;
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
      // Lead Manager delivery (A8): same event for the Venture's active Lead
      // Managers (in-app + email), minus the actor and the session coach.
      try {
        const lmV = await db.execute({ sql: "SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] });
        const dbId = lmV.rows?.[0]?.id;
        const ventureCode = lmV.rows?.[0]?.venture_id || id;
        if (dbId) {
          await notifyVentureLeadManagers(db, {
            dbId, ventureCode,
            title: "Session cancelled",
            message: `Venture session "${sess.title}" has been cancelled${sess.start_time ? ` (was ${fmtWhen(sess.start_time)})` : ""}.`,
            emailSubject: "Your Venture session was cancelled",
            emailLines: [
              `Session "${sess.title}" has been cancelled.`,
              sess.start_time ? `Was scheduled for: ${fmtWhen(sess.start_time)}` : "",
              "Log in to ImpactOS to see your updated calendar.",
            ].filter(Boolean),
            context: {
              journey_stage_id: sess.journey_stage_id || null,
              milestone_id: sess.milestone_ref || null,
              session_id: sess.id || null,
            },
            templateKey: "venture.notif.sessionCancelled",
            params: { title: sess.title },
            dedupeKey: `session-cancelled:${sess.id}`,
            excludeCids: [req.session?.cid, sess.coach_contact_id].filter(Boolean),
          });
        }
      } catch (_) {}
    }
    return NextResponse.json({ success: true });
  }

  if (action === "reschedule_session") {
    const denied = await deniedSessionManagement();
    if (denied) return denied;
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
        // Lead Manager delivery (A8): same event for the Venture's active Lead
        // Managers (in-app + email), minus the actor and the session coach.
        try {
          const lmV = await db.execute({ sql: "SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] });
          const dbId = lmV.rows?.[0]?.id;
          const ventureCode = lmV.rows?.[0]?.venture_id || id;
          if (dbId) {
            await notifyVentureLeadManagers(db, {
              dbId, ventureCode,
              title: "Session rescheduled",
              message: `Venture session "${sess.title}" has been rescheduled${sess.start_time ? ` to ${fmtWhen(sess.start_time)}` : ""}.`,
              emailSubject: "Your Venture session was rescheduled",
              emailLines: [
                `Session "${sess.title}" has been rescheduled.`,
                sess.start_time ? `New time: ${fmtWhen(sess.start_time)}` : "",
                sess.meeting_link ? `Meeting link: ${sess.meeting_link}` : "",
                "Log in to ImpactOS to see the details.",
              ].filter(Boolean),
              context: {
                journey_stage_id: sess.journey_stage_id || null,
                milestone_id: sess.milestone_ref || null,
                session_id: sess.id || null,
              },
              templateKey: "venture.notif.sessionRescheduled",
              params: { title: sess.title },
              dedupeKey: `session-rescheduled:${sess.id}`,
              excludeCids: [req.session?.cid, sess.coach_contact_id].filter(Boolean),
            });
          }
        } catch (_) {}
      }
      return NextResponse.json({ success: true });
    } catch (e) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
  }

  if (action === "delete_session") {
    const denied = await deniedSessionManagement();
    if (denied) return denied;
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
