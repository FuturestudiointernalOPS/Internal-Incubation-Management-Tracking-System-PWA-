import {
  insertMeetingSlots,
  getSlotById,
  getMeetingById,
  acceptSlot,
  expireOtherSlots,
  insertConfirmedMeeting,
  updateMeetingSchedule,
  updateMeetingStatus,
  updateMeetingOutcome,
  markConfirmationEmailSent,
  claimMeetingReminder,
  releaseMeetingReminderClaim,
  listMeetingsDueIn24h,
  listMeetingsDueIn6h,
  listMeetingsDueIn1h,
  listSlotsForWorkspace,
  listWorkspacesByInvestor,
  listWorkspacesByVentureIds,
  listInvestorMeetingFeedback,
  upsertInvestorMeetingFeedback,
} from "@/models/investor/meetingSlots";
import {
  getRelationshipWorkspaceDetail,
  insertInvestorMeeting,
  listMeetingsForWorkspace,
} from "@/models/investorRelations";
import { listActiveFounderVentures } from "@/models/authorization/contextGrantsStore";
import { emitInvestorEvent, resolveInvestorContext } from "@/services/investor/activity";
import { isInternalStaffFamilyRole } from "@/lib/identity";
import { sendStandaloneEmail } from "@/lib/email";
import { resolveAppUrl } from "@/lib/appUrl";
import { logger } from "@/lib/logger";

const MAX_SLOTS = 3;
const MAX_DURATION_MINUTES = 24 * 60;

function isValidTimezone(timezone) {
  if (typeof timezone !== "string" || timezone.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Propose up to 3 times. Times are stored in UTC; the proposer's timezone is
 * snapshotted so each side can render the slot in their own zone.
 */
export async function proposeSlots({ workspaceId, slots, proposerId, timezone, session }) {
  if (!workspaceId || !Array.isArray(slots) || slots.length === 0 || !isValidTimezone(timezone)) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }
  if (slots.length > MAX_SLOTS) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }

  const normalizedSlots = [];
  for (const slot of slots) {
    if (!slot || typeof slot.start_at !== "string"
      || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(slot.start_at)) {
      return { ok: false, status: 400, error: "errors.invalidRequest" };
    }

    const start = new Date(slot.start_at);
    const durationMinutes = slot.duration_minutes ?? 30;
    if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()
      || !Number.isInteger(durationMinutes) || durationMinutes < 1
      || durationMinutes > MAX_DURATION_MINUTES) {
      return { ok: false, status: 400, error: "errors.invalidRequest" };
    }
    if (slot.timezone != null && !isValidTimezone(slot.timezone)) {
      return { ok: false, status: 400, error: "errors.invalidRequest" };
    }
    normalizedSlots.push({
      startAt: start.toISOString(),
      durationMinutes,
    });
  }

  const proposerType = await getWorkspaceActorType({ session, workspaceId });
  if (!proposerType) return { ok: false, status: 403, error: "errors.insufficientPermissions" };

  const result = await insertMeetingSlots({
    workspaceId,
    proposedBy: proposerId || "unknown",
    proposedByType: proposerType,
    slots: normalizedSlots,
    timezone,
  });
  const created = result.rows || [];
  if (created.length !== normalizedSlots.length) {
    return { ok: false, status: 409, error: "errors.invalidRequest" };
  }

  await emitInvestorEvent({
    session,
    eventType: "slot_proposed",
    relatedId: workspaceId,
    metadata: { count: created.length, proposer_type: proposerType },
  });

  return { ok: true, slots: created };
}

/** Accept one slot: confirm the meeting, expire the rest, notify, log. */
export async function acceptSlotAndConfirm({
  slotId,
  expectedWorkspaceId = null,
  videoLink = null,
  session,
}) {
  const found = await getSlotById(slotId);
  const slot = found.rows?.[0];
  if (!slot) return { ok: false, status: 404, error: "Slot not found." };
  if (expectedWorkspaceId != null && String(slot.workspace_id) !== String(expectedWorkspaceId)) {
    return { ok: false, status: 404, error: "errors.notFound" };
  }
  const actorType = await getWorkspaceActorType({ session, workspaceId: slot.workspace_id });
  if (!actorType) return { ok: false, status: 403, error: "errors.insufficientPermissions" };
  if (actorType === slot.proposed_by_type) {
    return { ok: false, status: 403, error: "errors.insufficientPermissions" };
  }
  if (slot.status !== "proposed") {
    return { ok: false, status: 409, error: "This slot is no longer open." };
  }

  const accepted = await acceptSlot(slotId);
  if (!accepted.rows?.[0]) {
    return { ok: false, status: 409, error: "This slot is no longer open." };
  }
  await expireOtherSlots({ workspaceId: slot.workspace_id, keepId: slotId });

  const meetingResult = await insertConfirmedMeeting({
    workspaceId: slot.workspace_id,
    startAt: slot.start_at,
    durationMinutes: slot.duration_minutes,
    videoLink: videoLink || resolveAppUrl(),
    timezone: slot.proposer_timezone,
  });
  const meeting = meetingResult.rows?.[0];

  // Mirror into the platform calendar (best-effort).
  let workspace = null;
  try {
    const detail = await getRelationshipWorkspaceDetail(slot.workspace_id);
    workspace = detail.rows?.[0] || null;
    if (workspace?.venture_id) {
      await insertInvestorMeeting(
        workspace.venture_id,
        "Investor introduction meeting",
        null,
        meeting.start_at,
        null,
        "video",
        session?.cid || session?.id || null,
      );
    }
  } catch (_) {}

  const emailSent = await sendMeetingConfirmation({ meeting, slot, workspace });
  if (emailSent) await markConfirmationEmailSent(meeting.id).catch(() => {});

  await emitInvestorEvent({
    session,
    eventType: "slot_accepted",
    relatedId: slot.workspace_id,
    metadata: { slot_id: slotId, meeting_id: meeting?.id ?? null },
  });
  await emitInvestorEvent({
    session,
    eventType: "meeting_confirmed",
    relatedId: meeting?.id ?? null,
    metadata: { start_at: slot.start_at },
  });
  if (emailSent) {
    await emitInvestorEvent({
      session,
      eventType: "meeting_email_sent",
      relatedId: meeting?.id ?? null,
      metadata: {},
    });
  }

  return { ok: true, meeting };
}

/** The ICS is included inline; the transport does not carry attachments. */
function buildIcs({ meeting, slot }) {
  const start = new Date(slot.start_at);
  const stamp = start.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Future Studio//InvestOS//EN",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@impactos`,
    `DTSTART:${stamp}`,
    "SUMMARY:Future Studio introduction meeting",
    "DESCRIPTION:Meeting confirmed through InvestOS.",
    meeting.video_link ? `LOCATION:${meeting.video_link}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

async function sendMeetingConfirmation({ meeting, slot, workspace }) {
  const recipients = [
    {
      email: workspace?.investor_email,
      cid: workspace?.investor_cid,
      language: workspace?.investor_language,
      timezone: workspace?.investor_timezone || slot.proposer_timezone || "UTC",
    },
    {
      email: workspace?.founder_email,
      cid: workspace?.founder_cid,
      language: workspace?.founder_language,
      timezone: workspace?.founder_timezone || "UTC",
    },
  ].filter((recipient) => recipient.email);
  if (!recipients.length) {
    logger.error("investor_meeting_confirmation_recipient_missing", { meetingId: meeting?.id });
    return false;
  }

  let allSent = true;
  for (const recipient of recipients) {
    try {
      const language = recipient.language === "fr" ? "fr" : "en";
      const when = formatMeetingTime(slot.start_at, recipient.timezone, language);
      const ics = buildIcs({ meeting, slot });
      const copy = language === "fr"
        ? {
            subject: "Future Studio — Réunion confirmée",
            body: `Votre réunion est confirmée.\n\nDate et heure : ${when} (${recipient.timezone})\nDurée : ${slot.duration_minutes} minutes\nLien : ${meeting.video_link || "—"}\n\n${ics}`,
          }
        : {
            subject: "Future Studio — Meeting confirmed",
            body: `Your meeting is confirmed.\n\nWhen: ${when} (${recipient.timezone})\nDuration: ${slot.duration_minutes} minutes\nLink: ${meeting.video_link || "—"}\n\n${ics}`,
          };
      await sendStandaloneEmail({
        to: recipient.email,
        cc: process.env.INVESTOR_STUDIO_EMAIL || undefined,
        subject: copy.subject,
        email_type: "investor_meeting_confirmation",
        contact_cid: recipient.cid || null,
        body: copy.body,
        attachments: [{
          filename: `meeting-${meeting.id}.ics`,
          content: Buffer.from(ics, "utf8"),
          contentType: "text/calendar; charset=utf-8",
        }],
      });
    } catch (error) {
      allSent = false;
      logger.error("investor_meeting_confirmation_email_failed", {
        meetingId: meeting?.id,
        recipientCid: recipient.cid || null,
        error: error.message,
      });
    }
  }
  if (!process.env.INVESTOR_STUDIO_EMAIL) {
    logger.error("investor_meeting_studio_copy_unconfigured", { meetingId: meeting?.id });
  }
  return allSent;
}

function formatMeetingTime(startAt, timezone, language) {
  try {
    return new Date(startAt).toLocaleString(language === "fr" ? "fr-FR" : "en-GB", {
      timeZone: timezone,
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch (error) {
    logger.error("investor_meeting_timezone_invalid", { timezone, error: error.message });
    return new Date(startAt).toISOString();
  }
}

export async function rescheduleMeeting({ meetingId, startAt, durationMinutes = null, timezone = null, session }) {
  if (!meetingId || !startAt) {
    return { ok: false, status: 400, error: "meeting_id and start_at are required." };
  }
  const start = new Date(startAt);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()
    || (timezone != null && !isValidTimezone(timezone))
    || (durationMinutes != null && (!Number.isInteger(durationMinutes)
      || durationMinutes < 1 || durationMinutes > MAX_DURATION_MINUTES))) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }
  const current = (await getMeetingById(meetingId)).rows?.[0];
  if (!current) return { ok: false, status: 404, error: "errors.notFound" };
  const actorType = await getWorkspaceActorType({ session, workspaceId: current.workspace_id });
  if (!actorType) return { ok: false, status: 403, error: "errors.insufficientPermissions" };
  if (!["confirmed", "scheduled"].includes(current.status)) {
    return { ok: false, status: 409, error: "errors.invalidRequest" };
  }
  const result = await updateMeetingSchedule({ meetingId, startAt, durationMinutes, timezone });
  const meeting = result.rows?.[0];
  if (!meeting) return { ok: false, status: 409, error: "errors.invalidRequest" };
  await emitInvestorEvent({
    session,
    eventType: "meeting_rescheduled",
    relatedId: meetingId,
    actorType,
    metadata: { start_at: startAt },
  });
  const emailSent = await sendMeetingChangeEmail({ meeting, event: "rescheduled" });
  if (emailSent) {
    await emitInvestorEvent({ session, eventType: "meeting_email_sent", relatedId: meetingId, metadata: { reason: "rescheduled" } });
  }
  return { ok: true, meeting, emailSent };
}

export async function cancelMeeting({ meetingId, reason = null, session }) {
  if (!meetingId) return { ok: false, status: 400, error: "meeting_id is required." };
  if (reason != null && (typeof reason !== "string" || reason.length > 500)) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }
  const current = (await getMeetingById(meetingId)).rows?.[0];
  if (!current) return { ok: false, status: 404, error: "errors.notFound" };
  const actorType = await getWorkspaceActorType({ session, workspaceId: current.workspace_id });
  if (!actorType) return { ok: false, status: 403, error: "errors.insufficientPermissions" };
  if (!["confirmed", "scheduled"].includes(current.status)) {
    return { ok: false, status: 409, error: "errors.invalidRequest" };
  }
  const result = await updateMeetingStatus({ meetingId, status: "cancelled" });
  const meeting = result.rows?.[0];
  if (!meeting) return { ok: false, status: 409, error: "errors.invalidRequest" };
  await emitInvestorEvent({
    session,
    eventType: "meeting_cancelled",
    relatedId: meetingId,
    actorType,
    metadata: { reason_provided: Boolean(reason) },
  });
  const emailSent = await sendMeetingChangeEmail({ meeting, event: "cancelled", reason });
  if (emailSent) {
    await emitInvestorEvent({ session, eventType: "meeting_email_sent", relatedId: meetingId, metadata: { reason: "cancelled" } });
  }
  return { ok: true, meeting, emailSent };
}

/** The studio records the result after the time passes. */
export async function recordMeetingOutcome({
  meetingId,
  status,
  outcomeCode = null,
  note = null,
  actionItems = null,
  session,
}) {
  const allowedOutcomes = ["follow_up", "not_a_fit", "more_information", "moving_to_diligence"];
  if (!["held", "no_show"].includes(status) || !allowedOutcomes.includes(outcomeCode)
    || (note != null && (typeof note !== "string" || note.length > 2000))
    || (actionItems != null && (!Array.isArray(actionItems)
      || actionItems.length > 20
      || actionItems.some((item) => typeof item !== "string" || item.length > 500)))) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }
  const current = (await getMeetingById(meetingId)).rows?.[0];
  if (!current) return { ok: false, status: 404, error: "errors.notFound" };
  const scheduledAt = meetingStartDate(current);
  if (!scheduledAt || scheduledAt.getTime() > Date.now()) {
    return { ok: false, status: 409, error: "errors.invalidRequest" };
  }
  const result = await updateMeetingOutcome({
    meetingId,
    status,
    outcomeCode,
    note,
    actionItems: actionItems?.length ? JSON.stringify(actionItems) : null,
  });
  const meeting = result.rows?.[0];
  if (!meeting) return { ok: false, status: 409, error: "errors.invalidRequest" };
  const eventType = status === "held" ? "meeting_held" : "meeting_no_show";
  await emitInvestorEvent({
    session,
    eventType,
    relatedId: meetingId,
    actorType: "studio",
    metadata: { outcome_code: outcomeCode },
  });
  return { ok: true, meeting };
}

export async function submitInvestorMeetingFeedback({ meetingId, interest, note = null, session }) {
  const allowedInterest = ["interested", "not_interested", "need_more_information"];
  if (!meetingId || !allowedInterest.includes(interest)
    || (note != null && (typeof note !== "string" || note.length > 1000))) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }
  const meeting = (await getMeetingById(meetingId)).rows?.[0];
  if (!meeting) return { ok: false, status: 404, error: "errors.notFound" };
  const scheduledAt = meetingStartDate(meeting);
  if (meeting.status !== "held" || !scheduledAt || scheduledAt.getTime() > Date.now()) {
    return { ok: false, status: 409, error: "errors.invalidRequest" };
  }
  const actorType = await getWorkspaceActorType({ session, workspaceId: meeting.workspace_id });
  if (actorType !== "investor") return { ok: false, status: 403, error: "errors.insufficientPermissions" };
  const context = await resolveInvestorContext(session);
  if (!context.investorId) return { ok: false, status: 403, error: "errors.insufficientPermissions" };
  const result = await upsertInvestorMeetingFeedback({
    meetingId,
    investorProfileId: context.investorId,
    interest,
    note: note?.trim() || null,
  });
  const feedback = result.rows?.[0];
  await emitInvestorEvent({
    session,
    eventType: "meeting_feedback_submitted",
    relatedId: meetingId,
    actorType: "investor",
    metadata: { interest },
  });
  return { ok: true, feedback };
}

function meetingStartDate(meeting) {
  if (meeting.start_at) {
    const date = new Date(meeting.start_at);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (!meeting.scheduled_date) return null;
  const time = typeof meeting.scheduled_time === "string" ? meeting.scheduled_time.slice(0, 8) : "00:00:00";
  const date = new Date(`${meeting.scheduled_date}T${time}Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

async function sendMeetingChangeEmail({ meeting, event, reason = null }) {
  try {
    const detail = await getRelationshipWorkspaceDetail(meeting.workspace_id);
    const workspace = detail.rows?.[0];
    const recipients = [
      {
        email: workspace?.investor_email,
        cid: workspace?.investor_cid,
        language: workspace?.investor_language,
        timezone: workspace?.investor_timezone || meeting.timezone || "UTC",
      },
      {
        email: workspace?.founder_email,
        cid: workspace?.founder_cid,
        language: workspace?.founder_language,
        timezone: workspace?.founder_timezone || "UTC",
      },
    ].filter((recipient) => recipient.email);
    if (recipients.length !== 2) {
      logger.error("investor_meeting_change_recipient_missing", { meetingId: meeting.id });
      return false;
    }

    let allSent = true;
    for (const recipient of recipients) {
      const language = recipient.language === "fr" ? "fr" : "en";
      const when = meeting.start_at
        ? formatMeetingTime(meeting.start_at, recipient.timezone, language)
        : "";
      const message = language === "fr"
        ? event === "cancelled"
          ? `La réunion prévue ${when ? `le ${when}` : ""} a été annulée.${reason ? ` Motif : ${reason}` : ""}`
          : `La réunion a été reportée au ${when} (${recipient.timezone}).`
        : event === "cancelled"
          ? `The meeting ${when ? `scheduled for ${when}` : ""} was cancelled.${reason ? ` Reason: ${reason}` : ""}`
          : `The meeting has been rescheduled to ${when} (${recipient.timezone}).`;
      try {
        await sendStandaloneEmail({
          to: recipient.email,
          cc: process.env.INVESTOR_STUDIO_EMAIL || undefined,
          subject: language === "fr"
            ? `Future Studio — Réunion ${event === "cancelled" ? "annulée" : "reportée"}`
            : `Future Studio — Meeting ${event}`,
          email_type: `investor_meeting_${event}`,
          contact_cid: recipient.cid || null,
          body: message,
        });
      } catch (error) {
        allSent = false;
        logger.error("investor_meeting_change_email_recipient_failed", {
          meetingId: meeting.id,
          event,
          recipientCid: recipient.cid || null,
          error: error.message,
        });
      }
    }
    if (!process.env.INVESTOR_STUDIO_EMAIL) {
      logger.error("investor_meeting_studio_copy_unconfigured", { meetingId: meeting.id });
      allSent = false;
    }
    return allSent;
  } catch (error) {
    logger.error("investor_meeting_change_email_failed", {
      meetingId: meeting.id,
      event,
      error: error.message,
    });
    return false;
  }
}

/** Send staged reminders, with an atomic claim to avoid concurrent duplicates. */
export async function sendDueMeetingReminders({ session }) {
  let sent = 0;
  let failed = 0;
  const windows = [
    { which: "1h", label: "1h", list: listMeetingsDueIn1h },
    { which: "6h", label: "6h", list: listMeetingsDueIn6h },
    { which: "24h", label: "24h", list: listMeetingsDueIn24h },
  ];
  const handled = new Set();

  for (const { which, label, list } of windows) {
    const due = (await list()).rows || [];
    for (const meeting of due) {
      if (handled.has(String(meeting.id))) continue;
      handled.add(String(meeting.id));
      const claim = await claimMeetingReminder({ meetingId: meeting.id, which });
      if (!claim.rows?.length) continue;

      if (await sendReminder(meeting, label)) {
        await emitInvestorEvent({
          session,
          eventType: "meeting_reminder_sent",
          relatedId: meeting.id,
          actorType: "system",
          metadata: { window: which },
        });
        sent += 1;
      } else {
        await releaseMeetingReminderClaim({ meetingId: meeting.id, which });
        failed += 1;
      }
    }
  }

  return { ok: failed === 0, sent, failed };
}

async function sendReminder(meeting, window) {
  let workspace;
  try {
    const detail = await getRelationshipWorkspaceDetail(meeting.workspace_id);
    workspace = detail.rows?.[0] || null;
  } catch (error) {
    logger.error("investor_meeting_reminder_context_failed", {
      meetingId: meeting.id,
      error: error.message,
    });
    return false;
  }
  const recipients = [
    {
      email: workspace?.investor_email,
      cid: workspace?.investor_cid,
      language: workspace?.investor_language,
      timezone: workspace?.investor_timezone || meeting.timezone || "UTC",
    },
    {
      email: workspace?.founder_email,
      cid: workspace?.founder_cid,
      language: workspace?.founder_language,
      timezone: workspace?.founder_timezone || "UTC",
    },
  ].filter((recipient) => recipient.email);
  if (!recipients.length) {
    logger.error("investor_meeting_reminder_recipient_missing", { meetingId: meeting.id });
    return false;
  }
  let allSent = true;
  for (const recipient of recipients) {
    try {
      const language = recipient.language === "fr" ? "fr" : "en";
      const localizedWhen = formatMeetingTime(meeting.start_at, recipient.timezone, language);
      const copy = language === "fr"
        ? {
            subject: `Future Studio — Rappel de réunion (${window})`,
            body: `Rappel : votre réunion commence le ${localizedWhen} (${recipient.timezone}).\nLien : ${meeting.video_link || "—"}`,
          }
        : {
            subject: `Future Studio — Meeting reminder (${window})`,
            body: `Reminder: your meeting starts on ${localizedWhen} (${recipient.timezone}).\nLink: ${meeting.video_link || "—"}`,
          };
      await sendStandaloneEmail({
        to: recipient.email,
        cc: process.env.INVESTOR_STUDIO_EMAIL || undefined,
        subject: copy.subject,
        email_type: "investor_meeting_reminder",
        contact_cid: recipient.cid || null,
        body: copy.body,
      });
    } catch (error) {
      allSent = false;
      logger.error("investor_meeting_reminder_email_failed", {
        meetingId: meeting.id,
        recipientCid: recipient.cid || null,
        window,
        error: error.message,
      });
    }
  }
  return allSent;
}

// ── Meeting scope — investor, founder or studio ───────────────────────────────

export async function resolveMeetingScope({ session }) {
  const userId = session?.cid || session?.id || null;
  const studio = isInternalStaffFamilyRole(session?.role);
  if (!userId) return { investorId: null, founderVentures: [], studio };

  const ctx = await resolveInvestorContext(session);
  let founderVentures = [];
  try {
    founderVentures = await listActiveFounderVentures(userId);
  } catch (_) {}

  return { investorId: ctx.investorId, founderVentures, studio };
}

/** May this caller act on this workspace? Investor owner, founder, or studio. */
export async function canActOnWorkspace({ session, workspaceId }) {
  return Boolean(await getWorkspaceActorType({ session, workspaceId }));
}

async function getWorkspaceActorType({ session, workspaceId }) {
  const scope = await resolveMeetingScope({ session });
  const detail = await getRelationshipWorkspaceDetail(workspaceId);
  const workspace = detail.rows?.[0];
  if (!workspace) return null;
  if (scope.studio) return "studio";

  if (scope.investorId && String(workspace.investor_id) === String(scope.investorId)) return "investor";
  if (scope.founderVentures.some((ventureId) => String(ventureId) === String(workspace.venture_id))) {
    return "founder";
  }
  return null;
}

/** The workspaces this caller can see, each with its open slots and meetings. */
export async function listMeetingWorkspacesForCaller({ session }) {
  const scope = await resolveMeetingScope({ session });
  const rows = [];

  if (scope.investorId) {
    rows.push(...((await listWorkspacesByInvestor(scope.investorId)).rows || []));
  }
  if (scope.founderVentures.length > 0) {
    rows.push(...((await listWorkspacesByVentureIds(scope.founderVentures)).rows || []));
  }

  const seen = new Set();
  const workspaces = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const slots = (await listSlotsForWorkspace(row.id)).rows || [];
    const meetings = (await listMeetingsForWorkspace(row.id)).rows || [];
    workspaces.push({ ...row, slots, meetings });
  }

  if (scope.investorId) {
    const meetingIds = workspaces.flatMap((workspace) => workspace.meetings.map((meeting) => meeting.id));
    const feedbackRows = (await listInvestorMeetingFeedback({
      investorProfileId: scope.investorId,
      meetingIds,
    })).rows || [];
    const feedbackByMeeting = new Map(feedbackRows.map((feedback) => [String(feedback.meeting_id), feedback]));
    for (const workspace of workspaces) {
      workspace.meetings = workspace.meetings.map((meeting) => ({
        ...meeting,
        my_feedback: feedbackByMeeting.get(String(meeting.id)) || null,
      }));
    }
  }

  return { ok: true, workspaces };
}
