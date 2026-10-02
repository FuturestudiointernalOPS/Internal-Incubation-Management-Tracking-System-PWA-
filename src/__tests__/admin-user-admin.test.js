/**
 * Behaviour of the user-administration use cases (service layer) plus the
 * approve route's session→actor wiring.
 *
 * The decisions are exercised with the repository, the mailer and the token
 * hashing mocked: the existence and status checks, the role rule (only a Super
 * Admin may name an arbitrary role; nobody can mint one through the approvable
 * set), the hashed setup token, the audit actor taken from the session, and the
 * pending-users grouping.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));
jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));
jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({
    cid: "ADM1",
    name: "Admin One",
    role: "super_admin",
  })),
}));
jest.mock("@/lib/token-hashing", () => ({
  hashToken: jest.fn(() => "HASHED"),
  ensureTokenHashColumns: jest.fn(async () => true),
}));
jest.mock("@/lib/email", () => ({
  sendStandaloneEmail: jest.fn(async () => ({ success: true })),
}));
jest.mock("@/models/adminOps", () => ({
  getUserForApproval: jest.fn(),
  approveContact: jest.fn(),
  insertPasswordSetupToken: jest.fn(),
  insertApprovalAuditLog: jest.fn(),
  markApprovalUserNotificationsRead: jest.fn(),
  getUserForRejection: jest.fn(),
  rejectContact: jest.fn(),
  insertRejectionAuditLog: jest.fn(),
  markRejectionUserNotificationsRead: jest.fn(),
  listPendingUsers: jest.fn(),
}));

const models = require("@/models/adminOps");
const { sendStandaloneEmail } = require("@/lib/email");
const { hashToken } = require("@/lib/token-hashing");
const {
  approveUser,
  rejectUser,
  listPendingUsersGrouped,
} = require("@/services/dashboard/userAdmin");
const approveRoute = require("@/app/api/admin/approve-user/route");

const PENDING_USER = {
  cid: "USR1",
  name: "Jane",
  email: "jane@x.test",
  status: "pending",
  role: "participant",
};

beforeEach(() => {
  jest.clearAllMocks();
  models.getUserForApproval.mockResolvedValue({ rows: [{ ...PENDING_USER }] });
  models.getUserForRejection.mockResolvedValue({ rows: [{ ...PENDING_USER }] });
  models.listPendingUsers.mockResolvedValue({ rows: [] });
  sendStandaloneEmail.mockResolvedValue({ success: true });
  hashToken.mockReturnValue("HASHED");
});

const approve = (overrides = {}) =>
  approveUser({
    userCid: "USR1",
    requestedRole: undefined,
    actor: { role: "staff", name: "Staff One" },
    baseUrl: "https://x.test",
    ...overrides,
  });

describe("approveUser — the checks", () => {
  test("a missing user CID is a 400 and reads nothing", async () => {
    const result = await approve({ userCid: null });
    expect(result.status).toBe(400);
    expect(models.getUserForApproval).not.toHaveBeenCalled();
  });

  test("an unknown user is a 404", async () => {
    models.getUserForApproval.mockResolvedValue({ rows: [] });
    const result = await approve();
    expect(result.status).toBe(404);
  });

  test("a user who is not pending is a 400 that names the status", async () => {
    models.getUserForApproval.mockResolvedValue({
      rows: [{ ...PENDING_USER, status: "approved" }],
    });
    const result = await approve();
    expect(result.status).toBe(400);
    expect(result.body.error).toContain("'approved'");
    expect(models.approveContact).not.toHaveBeenCalled();
  });
});

describe("approveUser — the role rule", () => {
  test("a non-Super-Admin cannot pick a privileged role (no mint)", async () => {
    await approve({ requestedRole: "super_admin" });
    expect(models.approveContact).toHaveBeenCalledWith("participant", "USR1");
  });

  test("a non-Super-Admin may pick a role from the approvable set", async () => {
    await approve({ requestedRole: "facilitator" });
    expect(models.approveContact).toHaveBeenCalledWith("facilitator", "USR1");
  });

  test("a Super Admin may pick any role", async () => {
    await approve({
      requestedRole: "super_admin",
      actor: { role: "super_admin", name: "Root" },
    });
    expect(models.approveContact).toHaveBeenCalledWith("super_admin", "USR1");
  });
});

describe("approveUser — the setup email and audit", () => {
  test("issues a hashed token, mails the link and audits the session actor", async () => {
    const result = await approve({ actor: { role: "staff", name: "Staff One" } });

    expect(models.insertPasswordSetupToken).toHaveBeenCalledTimes(1);
    const [cid, , hash] = models.insertPasswordSetupToken.mock.calls[0];
    expect(cid).toBe("USR1");
    expect(hash).toBe("HASHED");

    expect(sendStandaloneEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@x.test", isHtml: true }),
    );
    expect(models.insertApprovalAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ adminName: "Staff One" }),
    );
    expect(models.markApprovalUserNotificationsRead).toHaveBeenCalledWith("Jane");

    expect(result.status).toBe(200);
    expect(result.body.emailSent).toBe(true);
    expect(result.body.message).toContain("Setup email sent");

    // The live token and the setup URL never travel back to the caller.
    expect(result.body).not.toHaveProperty("token");
    expect(result.body).not.toHaveProperty("setupUrl");
  });

  test("a failed email is reported honestly", async () => {
    sendStandaloneEmail.mockResolvedValue({ success: false });
    const result = await approve();
    expect(result.body.emailSent).toBe(false);
    expect(result.body.message).toContain("could not be sent");
  });
});

describe("rejectUser", () => {
  test("a missing user CID is a 400", async () => {
    const result = await rejectUser({ userCid: null, actor: { name: "A" } });
    expect(result.status).toBe(400);
  });

  test("an unknown user is a 404", async () => {
    models.getUserForRejection.mockResolvedValue({ rows: [] });
    const result = await rejectUser({ userCid: "USR1", actor: { name: "A" } });
    expect(result.status).toBe(404);
    expect(models.rejectContact).not.toHaveBeenCalled();
  });

  test("rejects, audits the session actor and clears notifications", async () => {
    const result = await rejectUser({
      userCid: "USR1",
      actor: { cid: "ADM1" },
    });
    expect(models.rejectContact).toHaveBeenCalledWith("USR1");
    expect(models.insertRejectionAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ adminName: "ADM1" }),
    );
    expect(models.markRejectionUserNotificationsRead).toHaveBeenCalledWith("Jane");
    expect(result.status).toBe(200);
    expect(result.body.message).toContain("rejected");
  });
});

describe("listPendingUsersGrouped", () => {
  test("groups the pending users by group, with an UNASSIGNED bucket", async () => {
    models.listPendingUsers.mockResolvedValue({
      rows: [
        { cid: "A", group_name: "Future Studio" },
        { cid: "B", group_name: "Future Studio" },
        { cid: "C", group_name: null },
      ],
    });
    const result = await listPendingUsersGrouped();
    expect(result.status).toBe(200);
    expect(result.body.total).toBe(3);
    expect(result.body.grouped["Future Studio"]).toHaveLength(2);
    expect(result.body.grouped.UNASSIGNED).toHaveLength(1);
  });
});

describe("the approve route derives the actor from the session", () => {
  test("a POST audits the session's name and never echoes the token", async () => {
    const req = new Request("http://localhost/api/admin/approve-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_cid: "USR1", role: "participant" }),
    });
    const res = await approveRoute.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(models.insertApprovalAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ adminName: "Admin One" }),
    );
    expect(JSON.stringify(body)).not.toContain("setup-password");
    expect(body).not.toHaveProperty("token");
  });
});
