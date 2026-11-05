/**
 * THE INVITATION EMAIL FOLLOWS THE SEAT.
 *
 * A founder invitation and a team-member invitation carry the SAME acceptance
 * link, but not the same wording: the founder email speaks about the company,
 * the member email about a seat on the team. Both ride the shared transport and
 * both record their delivery outcome.
 */

jest.mock("@/lib/email", () => ({
  sendVentureFounderInvitationEmail: jest.fn(),
  sendVentureMemberInvitationEmail: jest.fn(),
}));
jest.mock("@/lib/appUrl", () => ({ resolveAppUrl: () => "https://app.example" }));
jest.mock("@/models/ventureMemberInvitations", () => ({
  recordVentureMemberInvitationDelivery: jest.fn(async () => ({ ok: true })),
}));
jest.mock("@/models/workspace", () => ({ createLinkedNotification: jest.fn(async () => ({})) }));
jest.mock("@/services/ventures/accessFacts", () => ({ invalidateVentureAccess: jest.fn() }));

const {
  sendVentureFounderInvitationEmail,
  sendVentureMemberInvitationEmail,
} = require("@/lib/email");
const { recordVentureMemberInvitationDelivery } = require("@/models/ventureMemberInvitations");
const { deliverVentureMemberInvitation } = require("@/services/ventures/memberRoster");

const INVITATION = {
  id: 3,
  token: "tok-abc",
  email: "person@outside.io",
  expires_at: "2026-11-07T00:00:00.000Z",
  contact_id: null,
  contact_has_account: false,
  resent: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  sendVentureFounderInvitationEmail.mockResolvedValue({ success: true });
  sendVentureMemberInvitationEmail.mockResolvedValue({ success: true });
});

describe("deliverVentureMemberInvitation", () => {
  test("a founder invitation uses the founder wording and the shared link", async () => {
    const result = await deliverVentureMemberInvitation({
      invitation: INVITATION,
      ventureName: "Acme Labs",
      memberType: "founder",
      inviterName: "Super Admin",
    });

    expect(result).toEqual({ emailSent: true, emailError: null });
    expect(sendVentureFounderInvitationEmail).toHaveBeenCalledWith({
      to: "person@outside.io",
      ventureName: "Acme Labs",
      inviteUrl: "https://app.example/venture-invite/tok-abc",
      expiresAt: "2026-11-07T00:00:00.000Z",
    });
    expect(sendVentureMemberInvitationEmail).not.toHaveBeenCalled();
    expect(recordVentureMemberInvitationDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, sent: true }),
    );
  });

  test("a team-member invitation keeps the member wording", async () => {
    await deliverVentureMemberInvitation({
      invitation: INVITATION,
      ventureName: "Acme Labs",
      memberType: "team_member",
      inviterName: "Ada",
    });

    expect(sendVentureMemberInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        memberType: "team_member",
        inviterName: "Ada",
        inviteUrl: "https://app.example/venture-invite/tok-abc",
      }),
    );
    expect(sendVentureFounderInvitationEmail).not.toHaveBeenCalled();
  });

  test("a mailer failure is recorded and reported, never thrown", async () => {
    sendVentureFounderInvitationEmail.mockRejectedValueOnce(new Error("transport down"));

    const result = await deliverVentureMemberInvitation({
      invitation: INVITATION,
      ventureName: "Acme Labs",
      memberType: "founder",
    });

    expect(result).toEqual({ emailSent: false, emailError: "transport down" });
    expect(recordVentureMemberInvitationDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, sent: false, error: "transport down" }),
    );
  });
});
