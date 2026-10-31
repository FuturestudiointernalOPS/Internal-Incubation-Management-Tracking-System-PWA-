/**
 * RESENDING A FOUNDER INVITATION — from the administration, not the Team tab.
 *
 * The founder invited when a Venture is created has no founder row yet: the
 * only trace is the pending invitation. This suite pins that such an invitation
 * is found, re-issued (new link) and mailed again, and that the answer tells the
 * truth about the mailer.
 */

jest.mock("@/models/ventureMemberInvitations", () => ({
  listVentureMemberInvitations: jest.fn(),
  createVentureMemberInvitation: jest.fn(),
  recordVentureMemberInvitationDelivery: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/models/ventureAdmin", () => ({ createAdminVenture: jest.fn() }));
jest.mock("@/models/ventureWorkspace", () => ({
  getVentureDisplayNameByCode: jest.fn(async () => ({ rows: [{ venture_name: "Acme Labs" }] })),
}));
jest.mock("@/services/ventures/memberRoster", () => ({
  deliverVentureMemberInvitation: jest.fn(),
}));
jest.mock("@/services/ventures/activity", () => ({
  logVentureActivity: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/email", () => ({
  sendVentureFounderInvitationEmail: jest.fn(),
}));
jest.mock("@/lib/appUrl", () => ({ resolveAppUrl: () => "https://app.example" }));

const {
  listVentureMemberInvitations,
  createVentureMemberInvitation,
} = require("@/models/ventureMemberInvitations");
const { deliverVentureMemberInvitation } = require("@/services/ventures/memberRoster");
const { logVentureActivity } = require("@/services/ventures/activity");
const { resendFounderInvite } = require("@/services/dashboard/adminVentures");

const FOUNDER_INVITE = {
  id: 7,
  email: "founder@acme.io",
  name: "Ada Founder",
  member_type: "founder",
  role: "founder",
  expires_at: "2026-11-06T10:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  listVentureMemberInvitations.mockResolvedValue([FOUNDER_INVITE]);
  createVentureMemberInvitation.mockResolvedValue({
    id: 7,
    token: "fresh-token",
    email: "founder@acme.io",
    expires_at: "2026-11-07T10:00:00.000Z",
    resent: true,
  });
  deliverVentureMemberInvitation.mockResolvedValue({ emailSent: true, emailError: null });
});

describe("resendFounderInvite", () => {
  test("re-issues the pending founder invitation and mails it again", async () => {
    const { status, body } = await resendFounderInvite({
      ventureId: "VNT-1",
      actor: { cid: "SA_1", name: "Super Admin" },
    });

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, email_sent: true });
    expect(createVentureMemberInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        ventureId: "VNT-1",
        email: "founder@acme.io",
        memberType: "founder",
        invitedByCid: "SA_1",
      }),
    );
    expect(deliverVentureMemberInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        invitation: expect.objectContaining({ token: "fresh-token" }),
        ventureName: "Acme Labs",
        memberType: "founder",
      }),
    );
    expect(logVentureActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "FOUNDER_INVITED",
        details: expect.objectContaining({ is_resend: true, email_sent: true }),
      }),
    );
  });

  test("sends the invitation named by id, not just the newest", async () => {
    listVentureMemberInvitations.mockResolvedValue([
      { ...FOUNDER_INVITE, id: 9, email: "newer@acme.io" },
      FOUNDER_INVITE,
    ]);

    await resendFounderInvite({ ventureId: "VNT-1", invitationId: 7, actor: { cid: "SA_1" } });

    expect(createVentureMemberInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ email: "founder@acme.io" }),
    );
  });

  test("refuses when nothing is pending — there is nothing to resend", async () => {
    listVentureMemberInvitations.mockResolvedValue([]);

    const { status, body } = await resendFounderInvite({ ventureId: "VNT-1", actor: {} });

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(createVentureMemberInvitation).not.toHaveBeenCalled();
  });

  test("a team-member invitation is not a founder invitation", async () => {
    listVentureMemberInvitations.mockResolvedValue([{ ...FOUNDER_INVITE, member_type: "team_member" }]);

    const { status } = await resendFounderInvite({ ventureId: "VNT-1", actor: {} });

    expect(status).toBe(404);
  });

  test("the invitation is renewed even when the mailer fails — and says so", async () => {
    deliverVentureMemberInvitation.mockResolvedValue({ emailSent: false, emailError: "transport down" });

    const { status, body } = await resendFounderInvite({ ventureId: "VNT-1", actor: {} });

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, email_sent: false, email_error: "transport down" });
    expect(createVentureMemberInvitation).toHaveBeenCalledTimes(1);
  });
});
