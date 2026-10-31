/**
 * POST /api/ventures/[id]/founders — the invited founder is actually EMAILED.
 *
 * The founder screen used to record the invitation without sending anything.
 * It now creates the same invitation record as every other Venture invitation
 * and mails the same `/venture-invite/<token>` acceptance link, so the person
 * can join (and the founder row means something).
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn(async () => true),
}));
jest.mock("@/server/auth/guards", () => ({ requireAuth: jest.fn(async () => null) }));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "SA_1", role: "super_admin", name: "Super Admin" })),
}));
jest.mock("@/services/ventures/activity", () => ({
  logVentureActivity: jest.fn(async () => undefined),
}));
jest.mock("@/services/ventures/founders", () => ({
  VENTURE_ROLES: ["founder", "co-founder", "ceo"],
  // The legacy ledger row: whoever was invited is listed by the founder screen.
  inviteFounder: jest.fn(),
  canManageFounders: jest.fn(async () => ({ allowed: true, founderId: 1 })),
  listFounders: jest.fn(async () => []),
}));
jest.mock("@/models/ventureMemberInvitations", () => ({
  createVentureMemberInvitation: jest.fn(),
}));
jest.mock("@/models/ventureWorkspace", () => ({
  getVentureDisplayNameByCode: jest.fn(async () => ({ rows: [{ venture_name: "Acme Labs" }] })),
}));
jest.mock("@/services/ventures/memberRoster", () => ({
  deliverVentureMemberInvitation: jest.fn(async () => ({ emailSent: true, emailError: null })),
}));

const { inviteFounder } = require("@/services/ventures/founders");
const { createVentureMemberInvitation } = require("@/models/ventureMemberInvitations");
const { deliverVentureMemberInvitation } = require("@/services/ventures/memberRoster");

const { POST } = require("@/app/api/ventures/[id]/founders/route");

const call = (body) =>
  POST(
    new Request("http://x/api/ventures/VNT-1/founders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "VNT-1" }) },
  );

const VALID = { email: "nova@acme.io", name: "Nova Founder", role: "co-founder" };

beforeEach(() => {
  jest.clearAllMocks();
  inviteFounder.mockResolvedValue({ id: 12, token: "legacy-token", expires_at: "2026-11-02T00:00:00.000Z", isResend: false });
  createVentureMemberInvitation.mockResolvedValue({
    id: 21,
    token: "invite-token",
    email: "nova@acme.io",
    expires_at: "2026-11-07T00:00:00.000Z",
    resent: false,
  });
  deliverVentureMemberInvitation.mockResolvedValue({ emailSent: true, emailError: null });
});

describe("POST /api/ventures/[id]/founders", () => {
  test("creates the invitation and emails the founder accept link", async () => {
    const response = await call(VALID);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.email_sent).toBe(true);
    // The token is delivered by email only — never echoed to the caller.
    expect(JSON.stringify(body)).not.toContain("invite-token");

    expect(createVentureMemberInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        ventureId: "VNT-1",
        email: "nova@acme.io",
        memberType: "founder",
        role: "co-founder",
        invitedByCid: "SA_1",
      }),
    );
    expect(deliverVentureMemberInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        invitation: expect.objectContaining({ token: "invite-token" }),
        ventureName: "Acme Labs",
        memberType: "founder",
      }),
    );
  });

  test("a failed send is reported, not hidden behind a success", async () => {
    deliverVentureMemberInvitation.mockResolvedValue({ emailSent: false, emailError: "transport down" });

    const body = await (await call(VALID)).json();

    expect(body.success).toBe(true);
    expect(body.email_sent).toBe(false);
    expect(body.email_error).toBe("transport down");
  });

  test("someone who already accepted is refused before any email is prepared", async () => {
    inviteFounder.mockRejectedValueOnce(new Error("A founder with this email already exists and has accepted."));

    const response = await call(VALID);

    expect(response.status).toBe(400);
    expect(createVentureMemberInvitation).not.toHaveBeenCalled();
    expect(deliverVentureMemberInvitation).not.toHaveBeenCalled();
  });

  test("an unknown role is refused before any write", async () => {
    const response = await call({ ...VALID, role: "wizard" });

    expect(response.status).toBe(400);
    expect(inviteFounder).not.toHaveBeenCalled();
  });
});
