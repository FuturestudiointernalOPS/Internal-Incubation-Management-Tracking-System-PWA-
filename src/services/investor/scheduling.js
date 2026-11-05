import {
  insertMeetingSlot,
  getSlotById,
  acceptSlot,
  expireOtherSlots,
  insertConfirmedMeeting,
  updateMeetingSchedule,
  updateMeetingStatus,
  updateMeetingOutcome,
  markConfirmationEmailSent,
  markReminderSent,
  listMeetingsDueIn6h,
  listSlotsForWorkspace,
  listWorkspacesByInvestor,
  listWorkspacesByVentureIds,
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

const MAX_SLOTS = 3;

/**
 * Propose up to 3 times. Times are stored in UTC; the proposer's timezone is
 * snapshotted so each side can render the slot in their own zone.
 */
export async function proposeSlots({ workspaceId, slots, proposerType = "investor", proposerId, timezone, session }) {
  if (!workspaceId || !Array.isArray(slots) || slots.length === 0) {
    return { ok: false, status: 400, error: "workspace_id and slots are required." };
  }
  if (slots.length > MAX_SLOTS) {
    return { ok: false, status: 400, error: `At most ${MAX_SLOTS} slots may be proposed.` };
  }

  const created = [];
  for (const slot of slots) {
    if (!slot?.start_at) continue;
    const result = await insertMeetingSlot({
      workspaceId,
      proposedBy: proposerId || "unknown",
      proposedByType: proposerType,
      startAt: slot.start_at,
      durationMinutes: slot.duration_minutes || 30,
      timezone: timezone || slot.timezone || null,
    });
    created.push(result.rows?.[0]);
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
export async function acceptSlotAndConfirm({ slotId, videoLink = null, session }) {
  const found = await getSlotById(slotId);
  const slot = found.rows?.[0];
  if (!slot) return { ok: false, status: 404, error: "Slot not found." };
  if (slot.status !== "proposed") {
    return { ok: false, status: 409, error: "This slot is no longer open." };
  }

  await acceptSlot(slotId);
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
  const investorEmail = workspace?.investor_email || null;
  if (!investorEmail) return false;
  try {
    const when = new Date(slot.start_at).toISOString();
    await sendStandaloneEmail({
      to: investorEmail,
      subject: "Future Studio — Meeting confirmed",
      email_type: "investor_meeting_confirmation",
      contact_cid: null,
      body: `Your meeting is confirmed.\n\nWhen (UTC): ${when}\nDuration: ${slot.duration_minutes} minutes\nLink: ${meeting.video_link || "—"}\n\n${buildIcs({ meeting, slot })}`,
    });
    return true;
  } catch (_) {
    return false;
  }
}

export async function rescheduleMeeting({ meetingId, startAt, durationMinutes = null, timezone = null, session }) {
  if (!meetingId || !startAt) {
    return { ok: false, status: 400, error: "meeting_id and start_at are required." };
  }
  const result = await updateMeetingSchedule({ meetingId, startAt, durationMinutes, timezone });
  await emitInvestorEvent({
    session,
    eventType: "meeting_rescheduled",
    relatedId: meetingId,
    actorType: "studio",
    metadata: { start_at: startAt },
  });
  return { ok: true, meeting: result.rows?.[0] };
}

export async function cancelMeeting({ meetingId, reason = null, session }) {
  if (!meetingId) return { ok: false, status: 400, error: "meeting_id is required." };
  const result = await updateMeetingStatus({ meetingId, status: "cancelled" });
  await emitInvestorEvent({
    session,
    eventType: "meeting_cancelled",
    relatedId: meetingId,
    actorType: "studio",
    metadata: { reason },
  });
  return { ok: true, meeting: result.rows?.[0] };
}

/** The studio records the result after the time passes. */
export async function recordMeetingOutcome({ meetingId, status, outcomeCode = null, note = null, session }) {
  if (!["held", "no_show", "cancelled"].includes(status)) {
    return { ok: false, status: 400, error: "status must be held, no_show or cancelled." };
  }
  const result = await updateMeetingOutcome({ meetingId, status, outcomeCode, note });
  const eventType =
    status === "held" ? "meeting_held" : status === "no_show" ? "meeting_no_show" : "meeting_cancelled";
  await emitInvestorEvent({
    session,
    eventType,
    relatedId: meetingId,
    actorType: "studio",
    metadata: { outcome_code: outcomeCode, note },
  });
  return { ok: true, meeting: result.rows?.[0] };
}

/** Send the 6-hour-before reminder for due confirmed meetings. */
export async function sendDueMeetingReminders({ session }) {
  let sent = 0;
  const due = (await listMeetingsDueIn6h()).rows || [];

  for (const meeting of due) {
    if (await sendReminder(meeting, "6 hours")) {
      await markReminderSent({ meetingId: meeting.id, which: "6h" });
      await emitInvestorEvent({
        session,
        eventType: "meeting_reminder_sent",
        relatedId: meeting.id,
        actorType: "system",
        metadata: { window: "6h" },
      });
      sent += 1;
    }
  }

  return { ok: true, sent };
}

async function sendReminder(meeting, window) {
  let recipient = null;
  try {
    const detail = await getRelationshipWorkspaceDetail(meeting.workspace_id);
    recipient = detail.rows?.[0]?.investor_email || null;
  } catch (_) {}
  if (!recipient) return false;
  try {
    await sendStandaloneEmail({
      to: recipient,
      subject: `Future Studio — Meeting in ${window}`,
      email_type: "investor_meeting_reminder",
      contact_cid: null,
      body: `Reminder: your meeting starts at ${new Date(meeting.start_at).toISOString()} (UTC).\nLink: ${meeting.video_link || "—"}`,
    });
    return true;
  } catch (_) {
    return false;
  }
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
  const scope = await resolveMeetingScope({ session });
  if (scope.studio) return true;

  const detail = await getRelationshipWorkspaceDetail(workspaceId);
  const workspace = detail.rows?.[0];
  if (!workspace) return false;

  if (scope.investorId && String(workspace.investor_id) === String(scope.investorId)) return true;
  if (scope.founderVentures.some((ventureId) => String(ventureId) === String(workspace.venture_id))) {
    return true;
  }
  return false;
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

  return { ok: true, workspaces };
}
