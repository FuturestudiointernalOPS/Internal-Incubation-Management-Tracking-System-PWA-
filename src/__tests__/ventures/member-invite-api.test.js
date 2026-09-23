/**
 * POST /api/ventures/[id]/members — the founder's "add a member".
 *
 * The behaviour under test is the product decision: adding a member INVITES
 * them. The route must create a pending invitation and email the link, and must
 * never write a membership row itself.
 *
 * It also reports the DELIVERY outcome: the invitation is saved either way, but
 * the founder must be told when the email did not actually go out, and that
 * outcome is recorded on the invitation for the pending list.
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

jest.mock("@/lib/email", () => ({
  // Member invitations ride the shared transport (Google Workspace first,
  // Resend fallback), not a separate sender.
  sendVentureMemberInvitationEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("@/lib/appUrl", () => ({
  resolveAppUrl: () => "https://app.example",
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireOperationalVentureAccess: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("@/models/ventureMemberInvitations", () => ({
  createVentureMemberInvitation: jest.fn(),
  recordVentureMemberInvitationDelivery: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("@/models/ventureMemberAccess", () => ({
  resolveVentureCode: jest.fn(async (_db, id) => id),
  getVentureFounderCount: jest.fn().mockResolvedValue(2),
  checkVentureMemberViewAccess: jest.fn().mockResolvedValue(true),
  checkVentureMemberMutateAccess: jest.fn().mockResolvedValue(true),
}));

const db = require("@/lib/db").default;
const { getSession } = require("@/lib/auth");
const { sendVentureMemberInvitationEmail } = require("@/lib/email");
const {
  createVentureMemberInvitation,
  recordVentureMemberInvitationDelivery,
} = require("@/models/ventureMemberInvitations");
const {
  checkVentureMemberViewAccess,
  checkVentureMemberMutateAccess,
} = require("@/models/ventureMemberAccess");

const { POST } = require("@/app/api/ventures/[id]/members/route");

const readJson = async (res) => res.json();
const jsonReq = (body) => ({ json: async () => body });
const ctx = { params: { id: "VNT-1" } };

function primeDatabase({ alreadyMember = [], ventureName = "ABC Ventures" } = {}) {
  db.execute.mockImplementation(async ({ sql }) => {
    const text = String(sql);
    if (/FROM venture_members vm/.test(text)) return { rows: alreadyMember, rowsAffected: 0 };
    if (/FROM ventures WHERE venture_id/.test(text)) return { rows: [{ venture_name: ventureName }], rowsAffected: 0 };
    return { rows: [], rowsAffected: 0 };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ cid: "USR_FOUNDER", role: "participant", name: "Ada Founder" });
  checkVentureMemberViewAccess.mockResolvedValue(true);
  checkVentureMemberMutateAccess.mockResolvedValue(true);
  createVentureMemberInvitation.mockResolvedValue({
    id: 5,
    token: "linktoken",
    email: "guest@outside.io",
    expires_at: new Date(Date.now() + 3600e3).toISOString(),
    resent: false,
  });
  sendVentureMemberInvitationEmail.mockResolvedValue({ success: true });
  recordVentureMemberInvitationDelivery.mockResolvedValue({ ok: true });
  primeDatabase();
});

describe("POST /api/ventures/[id]/members", () => {
  it("creates a pending invitation and emails the accept link", async () => {
    const res = await POST(jsonReq({ email: "guest@outside.io", member_type: "team_member" }), ctx);

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.invitation).toMatchObject({ id: 5, email: "guest@outside.io" });

    expect(createVentureMemberInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        ventureId: "VNT-1",
        email: "guest@outside.io",
        memberType: "team_member",
        invitedByCid: "USR_FOUNDER",
      }),
    );

    expect(sendVentureMemberInvitationEmail).toHaveBeenCalledTimes(1);
    const mail = sendVentureMemberInvitationEmail.mock.calls[0][0];
    expect(mail.to).toBe("guest@outside.io");
    expect(mail.inviteUrl).toBe("https://app.example/venture-invite/linktoken");
    expect(mail.ventureName).toBe("ABC Ventures");
  });

  it("never writes the membership itself — joining is the acceptance", async () => {
    await POST(jsonReq({ email: "guest@outside.io", member_type: "founder" }), ctx);

    expect(db.execute.mock.calls.some(([call]) => /INSERT INTO venture_members/.test(String(call.sql)))).toBe(false);
  });

  it("refuses someone who is already on the roster", async () => {
    primeDatabase({ alreadyMember: [{ "?column?": 1 }] });

    const res = await POST(jsonReq({ email: "member@venture.io" }), ctx);

    expect(res.status).toBe(409);
    expect(createVentureMemberInvitation).not.toHaveBeenCalled();
    expect(sendVentureMemberInvitationEmail).not.toHaveBeenCalled();
  });

  it("requires a valid email address", async () => {
    const res = await POST(jsonReq({ email: "not-an-email" }), ctx);

    expect(res.status).toBe(400);
    expect(createVentureMemberInvitation).not.toHaveBeenCalled();
  });

  it("refuses a caller who may not manage members", async () => {
    checkVentureMemberMutateAccess.mockResolvedValue(false);

    const res = await POST(jsonReq({ email: "guest@outside.io" }), ctx);

    expect(res.status).toBe(403);
    expect(createVentureMemberInvitation).not.toHaveBeenCalled();
  });

  it("hides the roster from a caller without view access", async () => {
    checkVentureMemberViewAccess.mockResolvedValue(false);

    const res = await POST(jsonReq({ email: "guest@outside.io" }), ctx);

    expect(res.status).toBe(404);
    expect(createVentureMemberInvitation).not.toHaveBeenCalled();
  });

  it("still succeeds when the transport rejects, recording the invitation as not delivered", async () => {
    sendVentureMemberInvitationEmail.mockRejectedValueOnce(new Error("transport down"));

    const res = await POST(jsonReq({ email: "guest@outside.io" }), ctx);

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    // The invitation is saved, but the founder must be told no email went out.
    expect(body.email_sent).toBe(false);
    expect(recordVentureMemberInvitationDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, sent: false }),
    );
  });

  it("reports a transport refusal as not delivered", async () => {
    sendVentureMemberInvitationEmail.mockResolvedValueOnce({ success: false, error: "no provider configured" });

    const res = await POST(jsonReq({ email: "guest@outside.io" }), ctx);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.email_sent).toBe(false);
    expect(recordVentureMemberInvitationDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, sent: false, error: "no provider configured" }),
    );
  });

  it("reports a real send as delivered", async () => {
    const res = await POST(jsonReq({ email: "guest@outside.io" }), ctx);

    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.email_sent).toBe(true);
    expect(recordVentureMemberInvitationDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, sent: true }),
    );
  });
});
