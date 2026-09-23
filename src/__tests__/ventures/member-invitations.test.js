/**
 * Venture member invitations — the "invite, then join" model.
 *
 * A founder adds a member by email; the add creates a PENDING invitation and
 * emails a link. The membership row appears only at acceptance, which is why
 * these tests assert both halves: creating an invitation writes NOTHING to the
 * membership, and accepting writes it exactly once.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(async (plain) => `bcrypt(${plain})`),
}));

jest.mock("@/models/contactIdentity", () => ({
  normalizeEmail: (email) => String(email || "").trim().toLowerCase(),
  resolvePersonIdentity: jest.fn(),
  resolveOrCreateContactIdentity: jest.fn(),
  syncVentureRoleHistory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/models/authorization/contextGrants", () => ({
  syncContextGrantsForUser: jest.fn().mockResolvedValue(undefined),
}));

const db = require("@/lib/db").default;
const identity = require("@/models/contactIdentity");
const { syncContextGrantsForUser } = require("@/models/authorization/contextGrants");
const { hashToken } = require("@/lib/token-hashing");
const {
  createVentureMemberInvitation,
  listVentureMemberInvitations,
  getVentureMemberInvitationByToken,
  completeVentureMemberInvitation,
  revokeVentureMemberInvitation,
} = require("@/models/ventureMemberInvitations");

const isSchemaStatement = (sql) => /^CREATE\s+(TABLE|UNIQUE\s+INDEX|INDEX)/i.test(sql.trim());

/**
 * Answer by matching the SQL, not by a queue: the model's schema self-heal runs
 * on the first call of the file and would otherwise consume queued answers.
 */
function primeDatabase(routes = []) {
  db.execute.mockImplementation(async ({ sql, args = [] }) => {
    const text = String(sql);
    if (isSchemaStatement(text)) return { rows: [], rowsAffected: 0 };
    for (const [pattern, response] of routes) {
      if (pattern.test(text)) return typeof response === "function" ? response(args) : response;
    }
    return { rows: [], rowsAffected: 0 };
  });
}

const PENDING_SELECT = /FROM venture_member_invitations WHERE \(token_hash/;
const PENDING_FOR_EMAIL = /FROM venture_member_invitations/;
const CONTACT_BY_EMAIL = /FROM contacts WHERE LOWER\(email\)/;
const MEMBERSHIP_SELECT = /FROM venture_members/;

const pendingRow = (overrides = {}) => ({
  id: 7,
  venture_id: "VNT-1",
  email: "guest@outside.io",
  name: "Guest",
  member_type: "team_member",
  role: "member",
  contact_id: null,
  invited_by: "USR_FOUNDER",
  token: "tok123",
  status: "pending",
  expires_at: new Date(Date.now() + 3600e3).toISOString(),
  ...overrides,
});

const callWith = (pattern) => db.execute.mock.calls.find(([call]) => pattern.test(String(call.sql)));

beforeEach(() => {
  jest.clearAllMocks();
  primeDatabase();
});

describe("createVentureMemberInvitation", () => {
  it("stores a pending invitation with a hashed token and returns the plain link token", async () => {
    primeDatabase([
      [PENDING_FOR_EMAIL, { rows: [] }],
      [CONTACT_BY_EMAIL, { rows: [] }],
      [/INSERT INTO venture_member_invitations/, { rows: [{ id: 5 }] }],
    ]);

    const result = await createVentureMemberInvitation({
      ventureId: "VNT-1",
      email: "  Guest@Outside.io ",
      memberType: "founder",
      invitedByCid: "USR_FOUNDER",
    });

    expect(result).toMatchObject({ id: 5, email: "guest@outside.io", resent: false });
    expect(result.token).toBeTruthy();

    const insert = callWith(/INSERT INTO venture_member_invitations/);
    expect(insert[0].args[0]).toBe("VNT-1");
    expect(insert[0].args[1]).toBe("guest@outside.io");
    expect(insert[0].args[3]).toBe("founder"); // member_type
    expect(insert[0].args[4]).toBe("founder"); // default role for a founder
    expect(insert[0].args[7]).toBe(result.token);
    expect(insert[0].args[8]).toBe(hashToken(result.token));
  });

  it("writes nothing to the membership when inviting", async () => {
    primeDatabase([
      [PENDING_FOR_EMAIL, { rows: [] }],
      [CONTACT_BY_EMAIL, { rows: [] }],
      [/INSERT INTO venture_member_invitations/, { rows: [{ id: 5 }] }],
    ]);

    await createVentureMemberInvitation({ ventureId: "VNT-1", email: "guest@outside.io" });

    expect(callWith(/INSERT INTO venture_members/)).toBeUndefined();
  });

  it("reuses the pending row and mints a new token when the invitation is sent again", async () => {
    primeDatabase([
      [PENDING_FOR_EMAIL, { rows: [{ id: 9 }] }],
      [CONTACT_BY_EMAIL, { rows: [{ cid: "USR_9", name: "Guest", has_account: true }] }],
      [/UPDATE venture_member_invitations/, { rows: [], rowsAffected: 1 }],
    ]);

    const result = await createVentureMemberInvitation({
      ventureId: "VNT-1",
      email: "guest@outside.io",
      memberType: "team_member",
    });

    expect(result).toMatchObject({ id: 9, resent: true });
    expect(callWith(/INSERT INTO venture_member_invitations/)).toBeUndefined();
    const update = callWith(/UPDATE venture_member_invitations/);
    expect(update[0].args[7]).toBe(hashToken(result.token)); // token_hash
    expect(update[0].args[4]).toBe("USR_9"); // existing contact linked
  });

  it("rejects a missing email and an unknown member type", async () => {
    await expect(createVentureMemberInvitation({ ventureId: "VNT-1", email: "" })).rejects.toThrow("valid recipient email");
    await expect(
      createVentureMemberInvitation({ ventureId: "VNT-1", email: "a@b.co", memberType: "owner" }),
    ).rejects.toThrow("member_type");
  });
});

describe("getVentureMemberInvitationByToken", () => {
  const withInvitation = (row) => primeDatabase([[PENDING_SELECT, { rows: row ? [row] : [] }]]);

  it("returns the invitation for a live pending token", async () => {
    withInvitation(pendingRow());
    const { invitation } = await getVentureMemberInvitationByToken("tok123");
    expect(invitation.id).toBe(7);
  });

  it("tells the dead-end cases apart", async () => {
    withInvitation(null);
    expect((await getVentureMemberInvitationByToken("nope")).error).toBe("invalid");

    withInvitation(pendingRow({ status: "revoked" }));
    expect((await getVentureMemberInvitationByToken("tok123")).error).toBe("revoked");

    withInvitation(pendingRow({ expires_at: new Date(Date.now() - 3600e3).toISOString() }));
    expect((await getVentureMemberInvitationByToken("tok123")).error).toBe("expired");

    withInvitation(pendingRow({ status: "accepted" }));
    expect((await getVentureMemberInvitationByToken("tok123")).error).toBe("already");
  });
});

describe("listVentureMemberInvitations", () => {
  it("flags an expired invitation without hiding it", async () => {
    primeDatabase([
      [
        /FROM venture_member_invitations i/,
        {
          rows: [
            { id: 1, email: "late@x.io", status: "pending", expires_at: new Date(Date.now() - 1000).toISOString() },
            { id: 2, email: "fresh@x.io", status: "pending", expires_at: new Date(Date.now() + 3600e3).toISOString() },
          ],
        },
      ],
    ]);

    const rows = await listVentureMemberInvitations("VNT-1");
    expect(rows.map((row) => row.is_expired)).toEqual([true, false]);
  });
});

describe("completeVentureMemberInvitation", () => {
  const accepting = (row = pendingRow(), extra = []) =>
    primeDatabase([[PENDING_SELECT, { rows: [row] }], ...extra]);

  it("creates the membership from a matched identity and records the history", async () => {
    accepting(pendingRow(), [
      [MEMBERSHIP_SELECT, { rows: [] }],
      [/INSERT INTO venture_members/, { rows: [{ id: 1 }] }],
    ]);
    identity.resolvePersonIdentity.mockResolvedValue({ status: "matched", contact_cid: "USR_GUEST" });

    const result = await completeVentureMemberInvitation({ token: "tok123" });

    expect(result).toMatchObject({ ok: true, contact_cid: "USR_GUEST" });

    const insert = callWith(/INSERT INTO venture_members/);
    expect(insert[0].args[0]).toBe("VNT-1");
    expect(insert[0].args[1]).toBe("USR_GUEST"); // contact_id
    expect(insert[0].args[2]).toBe("USR_GUEST"); // user_cid kept in step
    expect(insert[0].args[3]).toBe("team_member");

    expect(identity.syncVentureRoleHistory).toHaveBeenCalledWith(
      expect.objectContaining({ contactCid: "USR_GUEST", ventureId: "VNT-1", active: true }),
    );
    const accepted = callWith(/UPDATE venture_member_invitations/);
    expect(accepted[0].sql).toContain("status = 'accepted'");
  });

  it("creates the contact for someone the platform has never seen", async () => {
    accepting(pendingRow(), [
      [MEMBERSHIP_SELECT, { rows: [] }],
      [/INSERT INTO venture_members/, { rows: [{ id: 1 }] }],
    ]);
    identity.resolvePersonIdentity.mockResolvedValue({ status: "new" });
    identity.resolveOrCreateContactIdentity.mockResolvedValue("USR_NEW");

    const result = await completeVentureMemberInvitation({ token: "tok123", name: "Nadia Guest" });

    expect(result.ok).toBe(true);
    expect(identity.resolveOrCreateContactIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ email: "guest@outside.io", name: "Nadia Guest" }),
    );
  });

  it("sets a password so an outside guest can sign in", async () => {
    accepting(pendingRow(), [
      [MEMBERSHIP_SELECT, { rows: [] }],
      [/INSERT INTO venture_members/, { rows: [{ id: 1 }] }],
    ]);
    identity.resolvePersonIdentity.mockResolvedValue({ status: "matched", contact_cid: "USR_GUEST" });

    await completeVentureMemberInvitation({ token: "tok123", password: "longenough" });

    const update = callWith(/UPDATE contacts SET password/);
    expect(update[0].args[0]).toBe("bcrypt(longenough)");
  });

  it("never duplicates an existing member, but still closes the invitation", async () => {
    accepting(pendingRow(), [[MEMBERSHIP_SELECT, { rows: [{ id: 3, removed_at: null }] }]]);
    identity.resolvePersonIdentity.mockResolvedValue({ status: "matched", contact_cid: "USR_GUEST" });

    const result = await completeVentureMemberInvitation({ token: "tok123" });

    expect(result).toMatchObject({ ok: true, already_member: true });
    expect(callWith(/INSERT INTO venture_members/)).toBeUndefined();
    expect(callWith(/UPDATE venture_member_invitations/)).toBeTruthy();
  });

  it("refuses an ambiguous identity rather than guessing", async () => {
    accepting();
    identity.resolvePersonIdentity.mockResolvedValue({ status: "conflict", matches: [{}, {}] });

    const result = await completeVentureMemberInvitation({ token: "tok123" });

    expect(result).toEqual({ ok: false, error: "identity_conflict" });
    expect(callWith(/INSERT INTO venture_members/)).toBeUndefined();
  });

  it("rejects a short password before touching anything", async () => {
    accepting();
    identity.resolvePersonIdentity.mockResolvedValue({ status: "matched", contact_cid: "USR_GUEST" });

    const result = await completeVentureMemberInvitation({ token: "tok123", password: "123" });

    expect(result).toEqual({ ok: false, error: "weak_password" });
    expect(identity.resolvePersonIdentity).not.toHaveBeenCalled();
  });

  it("applies the founder grants when a founder accepts", async () => {
    accepting(pendingRow({ member_type: "founder", role: "founder" }), [
      [MEMBERSHIP_SELECT, { rows: [] }],
      [/INSERT INTO venture_members/, { rows: [{ id: 1 }] }],
    ]);
    identity.resolvePersonIdentity.mockResolvedValue({ status: "matched", contact_cid: "USR_GUEST" });

    await completeVentureMemberInvitation({ token: "tok123" });

    expect(syncContextGrantsForUser).toHaveBeenCalledWith("USR_GUEST");
  });
});

describe("revokeVentureMemberInvitation", () => {
  it("reports whether a pending invitation was actually withdrawn", async () => {
    primeDatabase([[/UPDATE venture_member_invitations/, { rows: [], rowsAffected: 1 }]]);
    expect((await revokeVentureMemberInvitation({ id: 4, ventureId: "VNT-1" })).ok).toBe(true);

    primeDatabase([[/UPDATE venture_member_invitations/, { rows: [], rowsAffected: 0 }]]);
    expect((await revokeVentureMemberInvitation({ id: 4, ventureId: "VNT-1" })).ok).toBe(false);
  });
});
