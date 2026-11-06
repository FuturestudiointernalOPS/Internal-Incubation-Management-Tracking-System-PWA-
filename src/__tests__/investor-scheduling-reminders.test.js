jest.mock("@/models/investor/meetingSlots", () => ({
  insertMeetingSlot: jest.fn(),
  insertMeetingSlots: jest.fn(),
  getSlotById: jest.fn(),
  getMeetingById: jest.fn(),
  acceptSlot: jest.fn(),
  expireOtherSlots: jest.fn(),
  insertConfirmedMeeting: jest.fn(),
  updateMeetingSchedule: jest.fn(),
  updateMeetingStatus: jest.fn(),
  updateMeetingOutcome: jest.fn(),
  markConfirmationEmailSent: jest.fn(),
  claimMeetingReminder: jest.fn(),
  releaseMeetingReminderClaim: jest.fn(),
  listMeetingsDueIn24h: jest.fn(),
  listMeetingsDueIn6h: jest.fn(),
  listMeetingsDueIn1h: jest.fn(),
  listSlotsForWorkspace: jest.fn(),
  listWorkspacesByInvestor: jest.fn(),
  listWorkspacesByVentureIds: jest.fn(),
  listInvestorMeetingFeedback: jest.fn(),
  upsertInvestorMeetingFeedback: jest.fn(),
}));
jest.mock("@/models/investorRelations", () => ({
  getRelationshipWorkspaceDetail: jest.fn(),
  insertInvestorMeeting: jest.fn(),
  listMeetingsForWorkspace: jest.fn(),
}));
jest.mock("@/models/authorization/contextGrantsStore", () => ({
  listActiveFounderVentures: jest.fn(),
}));
jest.mock("@/services/investor/activity", () => ({
  emitInvestorEvent: jest.fn(),
  resolveInvestorContext: jest.fn(),
}));
jest.mock("@/lib/identity", () => ({
  isInternalStaffFamilyRole: jest.fn(),
}));
jest.mock("@/lib/email", () => ({
  sendStandaloneEmail: jest.fn(),
}));
jest.mock("@/lib/appUrl", () => ({
  resolveAppUrl: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn() },
}));

const slots = require("@/models/investor/meetingSlots");
const { getRelationshipWorkspaceDetail } = require("@/models/investorRelations");
const { emitInvestorEvent } = require("@/services/investor/activity");
const { sendStandaloneEmail } = require("@/lib/email");
const { logger } = require("@/lib/logger");
const {
  acceptSlotAndConfirm,
  cancelMeeting,
  proposeSlots,
  recordMeetingOutcome,
  rescheduleMeeting,
  submitInvestorMeetingFeedback,
  sendDueMeetingReminders,
} = require("@/services/investor/scheduling");

describe("investor meeting reminders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    slots.listMeetingsDueIn1h.mockResolvedValue({ rows: [] });
    slots.listMeetingsDueIn6h.mockResolvedValue({ rows: [] });
    slots.listMeetingsDueIn24h.mockResolvedValue({ rows: [] });
    slots.claimMeetingReminder.mockImplementation(async ({ meetingId }) => ({
      rows: [{ id: meetingId }],
    }));
    slots.releaseMeetingReminderClaim.mockResolvedValue({ rows: [] });
    getRelationshipWorkspaceDetail.mockResolvedValue({
      rows: [{
        investor_id: "investor-profile",
        venture_id: "venture-1",
        investor_email: "investor@example.invalid",
        investor_language: "fr",
      }],
    });
    slots.insertMeetingSlots.mockResolvedValue({ rows: [{ id: 1 }] });
    slots.upsertInvestorMeetingFeedback.mockResolvedValue({
      rows: [{ meeting_id: "meeting-1", interest: "interested", note: null }],
    });
    slots.markConfirmationEmailSent.mockResolvedValue({ rows: [] });
    sendStandaloneEmail.mockResolvedValue({ success: true });
    process.env.INVESTOR_STUDIO_EMAIL = "studio@example.invalid";
  });

  it("sends the closest due reminder first and claims each reminder only once", async () => {
    const oneHour = {
      id: 1,
      workspace_id: 8,
      start_at: "2026-11-06T10:00:00.000Z",
      timezone: "Africa/Porto-Novo",
      video_link: "https://meet.example.invalid/room",
    };
    const sixHours = { ...oneHour, id: 2 };
    const twentyFourHours = { ...oneHour, id: 3 };
    slots.listMeetingsDueIn1h.mockResolvedValue({ rows: [oneHour] });
    slots.listMeetingsDueIn6h.mockResolvedValue({ rows: [oneHour, sixHours] });
    slots.listMeetingsDueIn24h.mockResolvedValue({ rows: [twentyFourHours] });

    const result = await sendDueMeetingReminders({ session: null });

    expect(result).toEqual({ ok: true, sent: 3, failed: 0 });
    expect(slots.claimMeetingReminder.mock.calls.map(([claim]) => claim)).toEqual([
      { meetingId: 1, which: "1h" },
      { meetingId: 2, which: "6h" },
      { meetingId: 3, which: "24h" },
    ]);
    expect(sendStandaloneEmail).toHaveBeenCalledTimes(3);
    expect(sendStandaloneEmail.mock.calls[0][0]).toMatchObject({
      subject: expect.stringContaining("Rappel de réunion"),
      body: expect.stringContaining("Lien : https://meet.example.invalid/room"),
      to: "investor@example.invalid",
    });
    expect(emitInvestorEvent).toHaveBeenCalledTimes(3);
  });

  it("skips a reminder already claimed by another worker", async () => {
    slots.listMeetingsDueIn6h.mockResolvedValue({ rows: [{ id: 22, workspace_id: 9 }] });
    slots.claimMeetingReminder.mockResolvedValue({ rows: [] });

    const result = await sendDueMeetingReminders({ session: null });

    expect(result).toEqual({ ok: true, sent: 0, failed: 0 });
    expect(sendStandaloneEmail).not.toHaveBeenCalled();
  });

  it("releases a claim for a failed email so a later sweep can retry", async () => {
    const meeting = { id: 33, workspace_id: 12, start_at: "2026-11-06T10:00:00.000Z" };
    slots.listMeetingsDueIn6h.mockResolvedValue({ rows: [meeting] });
    sendStandaloneEmail.mockRejectedValue(new Error("mail service unavailable"));

    const result = await sendDueMeetingReminders({ session: null });

    expect(result).toEqual({ ok: false, sent: 0, failed: 1 });
    expect(slots.releaseMeetingReminderClaim).toHaveBeenCalledWith({ meetingId: 33, which: "6h" });
    expect(logger.error).toHaveBeenCalledWith(
      "investor_meeting_reminder_email_failed",
      expect.objectContaining({ meetingId: 33, window: "6h" }),
    );
  });

  it("reports failure when no investor recipient is available", async () => {
    slots.listMeetingsDueIn24h.mockResolvedValue({
      rows: [{ id: 44, workspace_id: 16, start_at: "2026-11-06T10:00:00.000Z" }],
    });
    getRelationshipWorkspaceDetail.mockResolvedValue({ rows: [] });

    const result = await sendDueMeetingReminders({ session: null });

    expect(result).toEqual({ ok: false, sent: 0, failed: 1 });
    expect(slots.releaseMeetingReminderClaim).toHaveBeenCalledWith({ meetingId: 44, which: "24h" });
    expect(logger.error).toHaveBeenCalledWith(
      "investor_meeting_reminder_recipient_missing",
      { meetingId: 44 },
    );
  });

  it("does not accept a slot from a workspace other than the authorized workspace", async () => {
    slots.getSlotById.mockResolvedValue({
      rows: [{ id: 55, workspace_id: "other-workspace", status: "proposed" }],
    });

    const result = await acceptSlotAndConfirm({
      slotId: 55,
      expectedWorkspaceId: "authorized-workspace",
      session: { cid: "investor-user" },
    });

    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(slots.acceptSlot).not.toHaveBeenCalled();
    expect(slots.expireOtherSlots).not.toHaveBeenCalled();
    expect(slots.insertConfirmedMeeting).not.toHaveBeenCalled();
  });

  it("does not create multiple meetings when another request accepted the slot first", async () => {
    const { listActiveFounderVentures } = require("@/models/authorization/contextGrantsStore");
    const { resolveInvestorContext } = require("@/services/investor/activity");
    slots.getSlotById.mockResolvedValue({
      rows: [{ id: 56, workspace_id: "workspace-56", status: "proposed", proposed_by_type: "founder" }],
    });
    slots.acceptSlot.mockResolvedValue({ rows: [] });
    listActiveFounderVentures.mockResolvedValue([]);
    resolveInvestorContext.mockResolvedValue({ investorId: "investor-profile" });
    getRelationshipWorkspaceDetail.mockResolvedValue({
      rows: [{ id: "workspace-56", venture_id: "venture-1", investor_id: "investor-profile" }],
    });

    const result = await acceptSlotAndConfirm({
      slotId: 56,
      expectedWorkspaceId: "workspace-56",
      session: { cid: "investor-user" },
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(slots.expireOtherSlots).not.toHaveBeenCalled();
    expect(slots.insertConfirmedMeeting).not.toHaveBeenCalled();
  });

  it("rejects malformed, past, and unknown-timezone proposals before writing", async () => {
    const proposals = [
      { start_at: "not-a-date", timezone: "Africa/Porto-Novo" },
      { start_at: new Date(Date.now() - 60_000).toISOString(), timezone: "Africa/Porto-Novo" },
      { start_at: new Date(Date.now() + 60_000).toISOString(), timezone: "Unknown/Zone" },
    ];

    for (const proposal of proposals) {
      const result = await proposeSlots({
        workspaceId: 7,
        slots: [{ start_at: proposal.start_at, duration_minutes: 30 }],
        proposerId: "founder-user",
        timezone: proposal.timezone,
        session: { cid: "founder-user" },
      });
      expect(result).toMatchObject({ ok: false, status: 400 });
    }

    expect(slots.insertMeetingSlots).not.toHaveBeenCalled();
  });

  it("rejects a client-supplied studio identity and derives the workspace participant", async () => {
    const { listActiveFounderVentures } = require("@/models/authorization/contextGrantsStore");
    const { resolveInvestorContext } = require("@/services/investor/activity");
    const workspaceDetail = require("@/models/investorRelations").getRelationshipWorkspaceDetail;
    listActiveFounderVentures.mockResolvedValue(["venture-1"]);
    resolveInvestorContext.mockResolvedValue({ investorId: null });
    workspaceDetail.mockResolvedValue({ rows: [{ id: 8, venture_id: "venture-1" }] });
    slots.insertMeetingSlots.mockResolvedValue({ rows: [{ id: 3 }] });

    const result = await proposeSlots({
      workspaceId: 8,
      slots: [{ start_at: new Date(Date.now() + 60_000).toISOString(), duration_minutes: 30 }],
      proposerId: "founder-user",
      timezone: "Africa/Porto-Novo",
      session: { cid: "founder-user", role: "founder" },
    });

    expect(result.ok).toBe(true);
    expect(slots.insertMeetingSlots).toHaveBeenCalledWith(expect.objectContaining({
      proposedByType: "founder",
    }));
    expect(slots.insertMeetingSlots).toHaveBeenCalledWith(expect.not.objectContaining({
      proposedByType: "studio",
    }));
  });

  it("rejects a slot proposer accepting their own proposal", async () => {
    const { listActiveFounderVentures } = require("@/models/authorization/contextGrantsStore");
    const { resolveInvestorContext } = require("@/services/investor/activity");
    slots.getSlotById.mockResolvedValue({
      rows: [{ id: 57, workspace_id: "workspace-57", status: "proposed", proposed_by_type: "founder" }],
    });
    listActiveFounderVentures.mockResolvedValue(["venture-1"]);
    resolveInvestorContext.mockResolvedValue({ investorId: null });
    getRelationshipWorkspaceDetail.mockResolvedValue({
      rows: [{ id: "workspace-57", venture_id: "venture-1", investor_id: "investor-profile" }],
    });

    const result = await acceptSlotAndConfirm({
      slotId: 57,
      expectedWorkspaceId: "workspace-57",
      session: { cid: "founder-user", role: "founder" },
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(slots.acceptSlot).not.toHaveBeenCalled();
  });

  it("allows the other approved workspace participant to accept and create a meeting", async () => {
    const { listActiveFounderVentures } = require("@/models/authorization/contextGrantsStore");
    const { resolveInvestorContext } = require("@/services/investor/activity");
    slots.getSlotById.mockResolvedValue({
      rows: [{
        id: 58,
        workspace_id: "workspace-58",
        status: "proposed",
        proposed_by_type: "founder",
        start_at: new Date(Date.now() + 60_000).toISOString(),
        duration_minutes: 30,
        proposer_timezone: "Africa/Porto-Novo",
      }],
    });
    slots.acceptSlot.mockResolvedValue({ rows: [{ id: 58 }] });
    slots.insertConfirmedMeeting.mockResolvedValue({
      rows: [{ id: "meeting-58", start_at: new Date(Date.now() + 60_000).toISOString(), video_link: "https://meet.example.invalid" }],
    });
    listActiveFounderVentures.mockResolvedValue([]);
    resolveInvestorContext.mockResolvedValue({ investorId: "investor-profile" });
    getRelationshipWorkspaceDetail.mockResolvedValue({
      rows: [{
        id: "workspace-58",
        investor_id: "investor-profile",
        venture_id: "venture-1",
        investor_email: "investor@example.invalid",
        founder_email: "founder@example.invalid",
      }],
    });

    const result = await acceptSlotAndConfirm({
      slotId: 58,
      expectedWorkspaceId: "workspace-58",
      session: { cid: "investor-user" },
    });

    expect(result.ok).toBe(true);
    expect(slots.insertConfirmedMeeting).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "workspace-58",
    }));
  });

  it("allows feedback only from the investor after a held meeting", async () => {
    const { listActiveFounderVentures } = require("@/models/authorization/contextGrantsStore");
    const { resolveInvestorContext } = require("@/services/investor/activity");
    listActiveFounderVentures.mockResolvedValue([]);
    resolveInvestorContext.mockResolvedValue({ investorId: "investor-profile" });
    slots.getMeetingById.mockResolvedValue({
      rows: [{
        id: "meeting-1",
        workspace_id: "workspace-1",
        status: "held",
        start_at: new Date(Date.now() - 60_000).toISOString(),
      }],
    });
    getRelationshipWorkspaceDetail.mockResolvedValue({
      rows: [{ id: "workspace-1", venture_id: "venture-1", investor_id: "investor-profile" }],
    });

    const result = await submitInvestorMeetingFeedback({
      meetingId: "meeting-1",
      interest: "interested",
      session: { cid: "investor-user" },
    });

    expect(result).toMatchObject({ ok: true, feedback: { interest: "interested" } });
    expect(slots.upsertInvestorMeetingFeedback).toHaveBeenCalledWith(expect.objectContaining({
      meetingId: "meeting-1",
      investorProfileId: "investor-profile",
    }));
  });

  it("rejects a future meeting outcome and invalid outcome codes before writing", async () => {
    slots.getMeetingById.mockResolvedValue({
      rows: [{ id: "meeting-2", start_at: new Date(Date.now() + 60_000).toISOString() }],
    });

    const future = await recordMeetingOutcome({
      meetingId: "meeting-2",
      status: "held",
      outcomeCode: "follow_up",
      session: { cid: "studio-user", role: "super_admin" },
    });
    const invalidCode = await recordMeetingOutcome({
      meetingId: "meeting-2",
      status: "held",
      outcomeCode: "unexpected",
      session: { cid: "studio-user", role: "super_admin" },
    });

    expect(future).toMatchObject({ ok: false, status: 409 });
    expect(invalidCode).toMatchObject({ ok: false, status: 400 });
    expect(slots.updateMeetingOutcome).not.toHaveBeenCalled();
  });

  it("allows either workspace participant to cancel and notifies both sides", async () => {
    const { listActiveFounderVentures } = require("@/models/authorization/contextGrantsStore");
    const { resolveInvestorContext } = require("@/services/investor/activity");
    listActiveFounderVentures.mockResolvedValue([]);
    resolveInvestorContext.mockResolvedValue({ investorId: "investor-profile" });
    slots.getMeetingById.mockResolvedValue({
      rows: [{
        id: "meeting-3",
        workspace_id: "workspace-3",
        status: "confirmed",
        start_at: new Date(Date.now() + 60_000).toISOString(),
      }],
    });
    slots.updateMeetingStatus.mockResolvedValue({
      rows: [{ id: "meeting-3", workspace_id: "workspace-3", status: "cancelled" }],
    });
    getRelationshipWorkspaceDetail.mockResolvedValue({
      rows: [{
        id: "workspace-3",
        venture_id: "venture-1",
        investor_id: "investor-profile",
        investor_email: "investor@example.invalid",
        founder_email: "founder@example.invalid",
      }],
    });

    const result = await cancelMeeting({ meetingId: "meeting-3", session: { cid: "investor-user" } });

    expect(result).toMatchObject({ ok: true, emailSent: true });
    expect(sendStandaloneEmail).toHaveBeenCalledTimes(2);
    expect(slots.updateMeetingStatus).toHaveBeenCalledWith({ meetingId: "meeting-3", status: "cancelled" });
  });

  it("allows an authorized participant to reschedule and sends updated details", async () => {
    const { listActiveFounderVentures } = require("@/models/authorization/contextGrantsStore");
    const { resolveInvestorContext } = require("@/services/investor/activity");
    const startAt = new Date(Date.now() + 3_600_000).toISOString();
    listActiveFounderVentures.mockResolvedValue([]);
    resolveInvestorContext.mockResolvedValue({ investorId: "investor-profile" });
    slots.getMeetingById.mockResolvedValue({
      rows: [{
        id: "meeting-4",
        workspace_id: "workspace-4",
        status: "confirmed",
      }],
    });
    slots.updateMeetingSchedule.mockResolvedValue({
      rows: [{
        id: "meeting-4",
        workspace_id: "workspace-4",
        start_at: startAt,
        video_link: "https://meet.example.invalid",
      }],
    });
    getRelationshipWorkspaceDetail.mockResolvedValue({
      rows: [{
        id: "workspace-4",
        venture_id: "venture-1",
        investor_id: "investor-profile",
        investor_email: "investor@example.invalid",
        founder_email: "founder@example.invalid",
      }],
    });

    const result = await rescheduleMeeting({
      meetingId: "meeting-4",
      startAt,
      session: { cid: "investor-user" },
    });

    expect(result).toMatchObject({ ok: true, emailSent: true });
    expect(slots.updateMeetingSchedule).toHaveBeenCalledWith({
      meetingId: "meeting-4",
      startAt,
      durationMinutes: null,
      timezone: null,
    });
    expect(sendStandaloneEmail).toHaveBeenCalledTimes(2);
  });
});
