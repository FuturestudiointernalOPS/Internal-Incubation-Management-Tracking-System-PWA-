/**
 * Venture Run invitations (Phase 3) — unit tests for the invitation service.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("uuid", () => ({
  v4: jest.fn(() => "mock-uuid-token-abcdef"),
}));

const db = require("@/lib/db").default;
const {
  createVentureInvitation,
  getVentureInvitationByToken,
  markVentureInvitationStatus,
} = require("@/lib/ventureInvitations");
const { hashToken } = require("@/lib/token-hashing");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createVentureInvitation", () => {
  it("creates a 'sent' invitation with a hashed token and returns the plain token", async () => {
    db.execute.mockResolvedValueOnce({ rows: [{ id: 11 }] });

    const result = await createVentureInvitation({
      runId: 7,
      contactCid: "USR_1",
      email: "john@example.com",
      sourceType: "participant",
      programId: "P1",
      invitedByCid: "STAFF_1",
      expiresInHours: 72,
    });

    expect(result).toMatchObject({ id: 11, email: "john@example.com" });
    expect(result.token).toBe("mockuuidtokenabcdef");

    const call = db.execute.mock.calls[0];
    expect(call[0].sql).toContain("INSERT INTO platform_form_run_invitations");
    expect(call[0].args[3]).toBe("participant");
    expect(call[0].args[8]).toBe("mockuuidtokenabcdef"); // token
    expect(call[0].args[9]).toBe(hashToken("mockuuidtokenabcdef")); // token_hash
    expect(new Date(call[0].args[10]).getTime()).toBeGreaterThan(Date.now()); // expires_at in the future
  });

  it("rejects a missing/invalid email", async () => {
    await expect(
      createVentureInvitation({ runId: 7, email: "", sourceType: "external" })
    ).rejects.toThrow("valid recipient email");
    expect(db.execute).not.toHaveBeenCalled();
  });
});

describe("getVentureInvitationByToken", () => {
  it("returns the invitation for a valid token", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [{ id: 11, token_hash: hashToken("tok123"), expires_at: new Date(Date.now() + 3600e3).toISOString(), status: "sent", run_id: 7 }],
    });

    const { invitation } = await getVentureInvitationByToken("tok123");
    expect(invitation.id).toBe(11);
  });

  it("returns invalid for an unknown token", async () => {
    db.execute.mockResolvedValueOnce({ rows: [] });
    const { error } = await getVentureInvitationByToken("nope");
    expect(error).toBe("invalid");
  });

  it("returns expired for an expired invitation", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [{ id: 11, token_hash: hashToken("old"), expires_at: new Date(Date.now() - 3600e3).toISOString(), status: "sent" }],
    });
    const { error } = await getVentureInvitationByToken("old");
    expect(error).toBe("expired");
  });
});

describe("markVentureInvitationStatus", () => {
  it("updates status and sets used_at", async () => {
    db.execute.mockResolvedValueOnce({ rows: [] });
    await markVentureInvitationStatus(11, "submitted");
    const call = db.execute.mock.calls[0];
    expect(call[0].sql).toContain("UPDATE platform_form_run_invitations");
    expect(call[0].args[0]).toBe("submitted");
    expect(call[0].args[1]).toBe(11);
  });
});
