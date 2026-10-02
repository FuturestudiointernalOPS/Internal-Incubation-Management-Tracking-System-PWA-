/**
 * services/ventures/sessionNotices — who is told about a Venture session, and
 * with which words.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/sessions/route.js` (lane L2):
 * the controller decides WHETHER an action happened; this module decides WHO is
 * told about it (founders, the coach, the Lead Managers) and WHAT they read.
 * Every notice is best-effort — a failed notice never fails the session write.
 *
 * It imports the same facades the controller used (`@/lib/ventureNotify`,
 * `@/models/ventureWorkspace`), so the route-level test mocks keep intercepting.
 * No SQL, no HTTP.
 */
import { notifyVentureCoach, notifyVentureLeadManagers } from "@/services/ventures/notify";
import { getVentureByCode, getVentureDbIdByCodeOrId, getVentureIdAndCode } from "@/models/ventureWorkspace";

/** A session time as the notices print it. */
export function fmtWhen(t) {
  return t ? new Date(t).toLocaleString() : "";
}

// Venture-facing session changes notify founders (in-app + email). Sessions
// created before the venture_facing flag existed (NULL) are treated as
// internal and never email founders.
export async function emailVentureAboutSession(ventureParam, sessionRecord, { inAppTitle, inAppMsg, subject, lines, templateKey = null, params = null, dedupeKey = null }) {
  try {
    if (!sessionRecord || sessionRecord.venture_facing !== true) return;
    const { notifyAndEmailVentureFounders } = await import("@/services/ventures/notify");
    const ventureDbIdResult = await getVentureByCode(ventureParam);
    const dbId = ventureDbIdResult.rows?.[0]?.id;
    if (!dbId) return;
    await notifyAndEmailVentureFounders({
      dbId, title: inAppTitle, message: inAppMsg, emailSubject: subject, emailLines: lines,
      context: {
        journey_stage_id: sessionRecord.journey_stage_id || null,
        milestone_id: sessionRecord.milestone_ref || null,
        session_id: sessionRecord.id || null,
      },
      templateKey, params, dedupeKey,
    });
    // Coach delivery (Phase 1): the platform user attached as coach gets the
    // same event in-app + by email (Future Studio staff or invited external).
    if (sessionRecord.coach_contact_id) {
      await notifyVentureCoach({
        dbId, coachContactId: sessionRecord.coach_contact_id,
        title: inAppTitle, message: inAppMsg, emailSubject: subject, emailLines: lines,
        context: {
          journey_stage_id: sessionRecord.journey_stage_id || null,
          milestone_id: sessionRecord.milestone_ref || null,
          session_id: sessionRecord.id || null,
        },
        templateKey, params, dedupeKey: dedupeKey ? `${dedupeKey}:coach` : null,
      });
    }
  } catch (_) {}
}

/**
 * The notices of a NEW session: the coach, the founders (venture-facing only)
 * and the Venture's active Lead Managers. The memo lives on the SESSION and
 * nowhere else: it is the Venture-facing brief, and it travels with every
 * notice. The milestone record is the manager's own judgement, written
 * deliberately — never a copy of it.
 *
 * @param {object} args
 * @param {string} args.ventureParam   the route's venture id (code or UUID)
 * @param {object} args.body           the create_session request body
 * @param {string} args.sessionNote    the memo
 * @param {object} args.createdSession the created session ({ id })
 * @param {string|null} args.coachContactId
 * @param {string|null} args.actorCid  who booked (left out of the LM notice)
 */
export async function notifySessionScheduled({ ventureParam, body, sessionNote, createdSession, coachContactId, actorCid }) {
  const id = ventureParam;
  // Coach delivery (Phase 1): the coach is added to the session — the
  // platform tells them (in-app + email), regardless of venture_facing.
  if (coachContactId) {
    try {
      const ventureDbIdResult = await getVentureDbIdByCodeOrId(id);
      const dbId = ventureDbIdResult.rows?.[0]?.id;
      if (dbId) {
        const when = body.start_time ? new Date(body.start_time).toLocaleString() : "";
        await notifyVentureCoach({
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
            session_id: createdSession.id || null,
          },
          templateKey: "venture.notif.sessionScheduled",
          params: { title: body.title, when: when ? ` for ${when}` : "", memo: sessionNote },
          dedupeKey: `session-scheduled:${createdSession.id || ""}:coach`,
        });
      }
    } catch (_) {}
  }
  // Venture-facing sessions notify founders (in-app + email).
  if (body.venture_facing === true) {
    try {
      const { notifyAndEmailVentureFounders } = await import("@/services/ventures/notify");
      const ventureDbIdResult = await getVentureByCode(id);
      const dbId = ventureDbIdResult.rows?.[0]?.id;
      if (dbId) {
        const when = body.start_time ? new Date(body.start_time).toLocaleString() : "";
        await notifyAndEmailVentureFounders({
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
            session_id: createdSession.id || null,
          },
          templateKey: "venture.notif.sessionScheduled",
          params: { title: body.title, when: when ? ` for ${when}` : "", memo: sessionNote },
          dedupeKey: `session-scheduled:${createdSession.id || ""}`,
        });
      }
    } catch (_) {}
  }
  // Lead Manager delivery (A8): the Venture's active Lead Managers are told
  // about the new session too (in-app + email), regardless of
  // venture_facing. The creator and an LM who is also the coach are left
  // out (they got the coach wording above).
  try {
    const leadManagerVenture = await getVentureIdAndCode(id);
    const dbId = leadManagerVenture.rows?.[0]?.id;
    const ventureCode = leadManagerVenture.rows?.[0]?.venture_id || id;
    if (dbId) {
      const when = body.start_time ? new Date(body.start_time).toLocaleString() : "";
      await notifyVentureLeadManagers({
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
          session_id: createdSession.id || null,
        },
        templateKey: "venture.notif.sessionScheduled",
        params: { title: body.title, when: when ? ` for ${when}` : "", memo: sessionNote },
        dedupeKey: `session-scheduled:${createdSession.id}`,
        excludeCids: [actorCid, coachContactId].filter(Boolean),
      });
    }
  } catch (_) {}
}

/** The founder (+ coach) notice of an updated session whose time/place changed. */
export async function notifySessionUpdated({ ventureParam, session }) {
  await emailVentureAboutSession(ventureParam, session, {
    inAppTitle: "Session updated",
    inAppMsg: `Session "${session.title}" has been updated.`,
    subject: "Your Venture session was updated",
    lines: [
      `Session "${session.title}" has been updated.`,
      session.start_time ? `New time: ${fmtWhen(session.start_time)}` : "",
      session.meeting_link ? `Meeting link: ${session.meeting_link}` : "",
      "Log in to ImpactOS to see the details.",
    ].filter(Boolean),
    templateKey: "venture.notif.sessionUpdated",
    params: { title: session.title },
    dedupeKey: `session-updated:${session.id}`,
  });
}

/** The notices of a cancelled session: founders (+ coach), then the Lead Managers. */
export async function notifySessionCancelled({ ventureParam, session, actorCid }) {
  const id = ventureParam;
  await emailVentureAboutSession(id, session, {
    inAppTitle: "Session cancelled",
    inAppMsg: `Session "${session.title}" has been cancelled.`,
    subject: "Your Venture session was cancelled",
    lines: [
      `Session "${session.title}" has been cancelled.`,
      session.start_time ? `Was scheduled for: ${fmtWhen(session.start_time)}` : "",
      "Log in to ImpactOS to see your updated calendar.",
    ].filter(Boolean),
    templateKey: "venture.notif.sessionCancelled",
    params: { title: session.title },
    dedupeKey: `session-cancelled:${session.id}`,
  });
  // Lead Manager delivery (A8): same event for the Venture's active Lead
  // Managers (in-app + email), minus the actor and the session coach.
  try {
    const leadManagerVenture = await getVentureIdAndCode(id);
    const dbId = leadManagerVenture.rows?.[0]?.id;
    const ventureCode = leadManagerVenture.rows?.[0]?.venture_id || id;
    if (dbId) {
      await notifyVentureLeadManagers({
        dbId, ventureCode,
        title: "Session cancelled",
        message: `Venture session "${session.title}" has been cancelled${session.start_time ? ` (was ${fmtWhen(session.start_time)})` : ""}.`,
        emailSubject: "Your Venture session was cancelled",
        emailLines: [
          `Session "${session.title}" has been cancelled.`,
          session.start_time ? `Was scheduled for: ${fmtWhen(session.start_time)}` : "",
          "Log in to ImpactOS to see your updated calendar.",
        ].filter(Boolean),
        context: {
          journey_stage_id: session.journey_stage_id || null,
          milestone_id: session.milestone_ref || null,
          session_id: session.id || null,
        },
        templateKey: "venture.notif.sessionCancelled",
        params: { title: session.title },
        dedupeKey: `session-cancelled:${session.id}`,
        excludeCids: [actorCid, session.coach_contact_id].filter(Boolean),
      });
    }
  } catch (_) {}
}

/** The notices of a rescheduled session: founders (+ coach), then the Lead Managers. */
export async function notifySessionRescheduled({ ventureParam, session, actorCid }) {
  const id = ventureParam;
  await emailVentureAboutSession(id, session, {
    inAppTitle: "Session rescheduled",
    inAppMsg: `Session "${session.title}" has been rescheduled${session.start_time ? ` to ${fmtWhen(session.start_time)}` : ""}.`,
    subject: "Your Venture session was rescheduled",
    lines: [
      `Session "${session.title}" has been rescheduled.`,
      session.start_time ? `New time: ${fmtWhen(session.start_time)}` : "",
      session.meeting_link ? `Meeting link: ${session.meeting_link}` : "",
      "Log in to ImpactOS to see the details.",
    ].filter(Boolean),
    templateKey: "venture.notif.sessionRescheduled",
    params: { title: session.title },
    dedupeKey: `session-rescheduled:${session.id}`,
  });
  // Lead Manager delivery (A8): same event for the Venture's active Lead
  // Managers (in-app + email), minus the actor and the session coach.
  try {
    const leadManagerVenture = await getVentureIdAndCode(id);
    const dbId = leadManagerVenture.rows?.[0]?.id;
    const ventureCode = leadManagerVenture.rows?.[0]?.venture_id || id;
    if (dbId) {
      await notifyVentureLeadManagers({
        dbId, ventureCode,
        title: "Session rescheduled",
        message: `Venture session "${session.title}" has been rescheduled${session.start_time ? ` to ${fmtWhen(session.start_time)}` : ""}.`,
        emailSubject: "Your Venture session was rescheduled",
        emailLines: [
          `Session "${session.title}" has been rescheduled.`,
          session.start_time ? `New time: ${fmtWhen(session.start_time)}` : "",
          session.meeting_link ? `Meeting link: ${session.meeting_link}` : "",
          "Log in to ImpactOS to see the details.",
        ].filter(Boolean),
        context: {
          journey_stage_id: session.journey_stage_id || null,
          milestone_id: session.milestone_ref || null,
          session_id: session.id || null,
        },
        templateKey: "venture.notif.sessionRescheduled",
        params: { title: session.title },
        dedupeKey: `session-rescheduled:${session.id}`,
        excludeCids: [actorCid, session.coach_contact_id].filter(Boolean),
      });
    }
  } catch (_) {}
}
