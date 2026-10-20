/**
 * D-6 (option 1) — honest venture refusals.
 *
 * The legacy venture gate used to answer the same thing — "not found" — whether
 * nobody was signed in, the venture did not exist, or the venture existed but
 * was not theirs. The three situations are now distinct, and the route only
 * translates the reason it receives.
 */

jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("@/services/ventures/accessFacts", () => ({ ventureAccessFacts: jest.fn() }));

const { getSession } = require("@/server/auth/session");
const { ventureAccessFacts } = require("@/services/ventures/accessFacts");
const { requireVentureAccess } = require("@/lib/ventureAuth");
const { ventureAccessRefusal } = require("@/server/http/refusal");

const SESSION = { cid: "USR_1", role: "founder", email: "f@example.com" };
const FACTS = { id: 42, venture_id: "VNT-ABC" };
const OUTSIDE = { is_member: false, is_assigned: false };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("requireVentureAccess — the reason is always explicit", () => {
  test("nobody signed in → unauthenticated", async () => {
    getSession.mockResolvedValue(null);

    const access = await requireVentureAccess("VNT-ABC");

    expect(access.session).toBeNull();
    expect(access.reason).toBe("unauthenticated");
    expect(ventureAccessFacts).not.toHaveBeenCalled();
  });

  test("the venture does not exist → not-found", async () => {
    getSession.mockResolvedValue(SESSION);
    ventureAccessFacts.mockResolvedValue({ facts: null, relationship: OUTSIDE });

    const access = await requireVentureAccess("VNT-MISSING");

    expect(access.session).toBeNull();
    expect(access.reason).toBe("not-found");
  });

  test("the venture exists but is not theirs → out-of-scope", async () => {
    getSession.mockResolvedValue(SESSION);
    ventureAccessFacts.mockResolvedValue({ facts: FACTS, relationship: OUTSIDE });

    const access = await requireVentureAccess("VNT-ABC");

    expect(access.session).toBeNull();
    expect(access.reason).toBe("out-of-scope");
  });

  test.each([
    ["a member", { is_member: true, is_assigned: false }],
    ["delegated staff", { is_member: false, is_assigned: true }],
  ])("%s is allowed, with no reason", async (_label, relationship) => {
    getSession.mockResolvedValue(SESSION);
    ventureAccessFacts.mockResolvedValue({ facts: FACTS, relationship });

    const access = await requireVentureAccess("VNT-ABC");

    expect(access.session).toBe(SESSION);
    expect(access.reason).toBeNull();
  });

  test("the platform owner bypasses the relationship lookup", async () => {
    getSession.mockResolvedValue({ ...SESSION, role: "super_admin" });

    const access = await requireVentureAccess("VNT-ABC");

    expect(access.session).not.toBeNull();
    expect(access.reason).toBeNull();
    expect(ventureAccessFacts).not.toHaveBeenCalled();
  });
});

describe("ventureAccessRefusal — one refusal shape per outcome", () => {
  test.each([
    ["unauthenticated", 401, "errors.authRequired"],
    ["not-found", 404, "errors.ventureNotFound"],
    ["out-of-scope", 403, "errors.insufficientPermissions"],
  ])("%s → %s %s", async (reason, status, errorKey) => {
    const response = ventureAccessRefusal(reason);

    expect(response.status).toBe(status);
    expect(response.headers.get("X-Authz-Decision")).toBe(reason);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: errorKey,
    });
  });

  test("an out-of-scope refusal names the missing perimeter", async () => {
    const body = await ventureAccessRefusal("out-of-scope").json();

    expect(body.missing).toEqual({ scope: "venture_own" });
  });

  test("an unknown reason fails closed as out-of-scope, never as allowed", () => {
    const response = ventureAccessRefusal(undefined);

    expect(response.status).toBe(403);
  });
});
