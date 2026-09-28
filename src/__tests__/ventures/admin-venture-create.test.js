/**
 * POST /api/admin/ventures/create — the super-admin "Add a Venture" fast-path.
 *
 * The product decision under test: the administrator records the Venture and the
 * founder is INVITED by email — the route never fabricates a founder account or
 * writes a membership; the invitation screen is where that happens.
 *
 * It also reports the DELIVERY outcome: the Venture is created either way, but a
 * failed email must be surfaced so the admin knows nothing went out.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn(),
}));

jest.mock("@/lib/ventures", () => ({
  logVentureActivity: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/models/ventureAdmin", () => ({
  createAdminVenture: jest.fn(),
}));

jest.mock("@/models/ventureMemberInvitations", () => ({
  createVentureMemberInvitation: jest.fn(),
  recordVentureMemberInvitationDelivery: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("@/lib/email", () => ({
  sendVentureFounderInvitationEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("@/lib/appUrl", () => ({
  resolveAppUrl: () => "https://app.example",
}));

const { getSession } = require("@/lib/auth");
const { createAdminVenture } = require("@/models/ventureAdmin");
const {
  createVentureMemberInvitation,
  recordVentureMemberInvitationDelivery,
} = require("@/models/ventureMemberInvitations");
const { sendVentureFounderInvitationEmail } = require("@/lib/email");

const { POST } = require("@/app/api/admin/ventures/create/route");

const jsonReq = (body) => ({ json: async () => body });
const readJson = async (res) => res.json();

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ cid: "SA_1", role: "super_admin", name: "Super Admin" });
  createAdminVenture.mockResolvedValue({ venture_id: "VNT-ABCD1234", company_name: "Acme Labs" });
  createVentureMemberInvitation.mockResolvedValue({
    id: 9,
    token: "linktoken",
    email: "founder@acme.io",
    expires_at: new Date(Date.now() + 7 * 24 * 3600e3).toISOString(),
    resent: false,
  });
  sendVentureFounderInvitationEmail.mockResolvedValue({ success: true });
  recordVentureMemberInvitationDelivery.mockResolvedValue({ ok: true });
});

describe("POST /api/admin/ventures/create", () => {
  it("creates the Venture and invites its founder with the accept link", async () => {
    const res = await POST(jsonReq({ company_name: "Acme Labs", founder_email: "founder@acme.io" }));

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.venture).toEqual({ venture_id: "VNT-ABCD1234", company_name: "Acme Labs" });

    expect(createAdminVenture).toHaveBeenCalledWith(
      expect.objectContaining({ companyName: "Acme Labs", createdByCid: "SA_1" }),
    );
    expect(createVentureMemberInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        ventureId: "VNT-ABCD1234",
        email: "founder@acme.io",
        memberType: "founder",
        invitedByCid: "SA_1",
      }),
    );

    expect(sendVentureFounderInvitationEmail).toHaveBeenCalledTimes(1);
    const mail = sendVentureFounderInvitationEmail.mock.calls[0][0];
    expect(mail.to).toBe("founder@acme.io");
    expect(mail.inviteUrl).toBe("https://app.example/venture-invite/linktoken");
    expect(mail.ventureName).toBe("Acme Labs");
  });

  it("never writes a membership itself — joining is the invitation acceptance", async () => {
    const db = require("@/lib/db").default;
    await POST(jsonReq({ company_name: "Acme Labs", founder_email: "founder@acme.io" }));

    expect(db.execute).not.toHaveBeenCalled();
  });

  it("refuses a missing or too-short venture name", async () => {
    const res = await POST(jsonReq({ company_name: "A", founder_email: "founder@acme.io" }));

    expect(res.status).toBe(400);
    expect(createAdminVenture).not.toHaveBeenCalled();
    expect(sendVentureFounderInvitationEmail).not.toHaveBeenCalled();
  });

  it("refuses a missing or malformed founder email", async () => {
    const missing = await POST(jsonReq({ company_name: "Acme Labs" }));
    const malformed = await POST(jsonReq({ company_name: "Acme Labs", founder_email: "not-an-email" }));

    expect(missing.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(createAdminVenture).not.toHaveBeenCalled();
  });

  it("refuses a company name already in use", async () => {
    createAdminVenture.mockResolvedValueOnce({ conflict: true, venture_id: "VNT-OLD" });

    const res = await POST(jsonReq({ company_name: "Acme Labs", founder_email: "founder@acme.io" }));

    expect(res.status).toBe(409);
    expect(createVentureMemberInvitation).not.toHaveBeenCalled();
    expect(sendVentureFounderInvitationEmail).not.toHaveBeenCalled();
  });

  it("still succeeds when the transport fails, but reports the email as not sent", async () => {
    sendVentureFounderInvitationEmail.mockRejectedValueOnce(new Error("transport down"));

    const res = await POST(jsonReq({ company_name: "Acme Labs", founder_email: "founder@acme.io" }));

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.email_sent).toBe(false);
    // The invitation exists; its delivery outcome is recorded for the pending list.
    expect(recordVentureMemberInvitationDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, sent: false }),
    );
  });

  it("reports a real send as delivered", async () => {
    const res = await POST(jsonReq({ company_name: "Acme Labs", founder_email: "founder@acme.io" }));

    const body = await readJson(res);
    expect(body.email_sent).toBe(true);
    expect(recordVentureMemberInvitationDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, sent: true }),
    );
  });
});
