/**
 * PROGRAM SCOPED ACCESS — the record-scope layer for program writes.
 *
 * The rule is enforced UNCONDITIONALLY: there is no rollout switch, because a
 * rule that only applies when somebody remembers to enable it does not protect
 * anything. What is locked here:
 *
 *   - the enforcement applies on every call (no gate to be off by accident);
 *   - a missing program id is a DENIAL (an action that cannot be attributed to a
 *     program cannot be scope-checked);
 *   - enrollment never confers scope for a write (the rule is "staffed", not
 *     "assigned");
 *   - Super Admin is unscoped, and an infrastructure failure is a 500 rather
 *     than a silent allow.
 */

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "USR_PM", role: "staff", email: "pm@x.test" })),
}));

jest.mock("@/lib/authorization", () => ({
  getAuthorizationContext: jest.fn(async () => ({ isSuperAdmin: false })),
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/authorization/scope", () => ({
  isWithinScope: jest.fn(async () => true),
}));

const { getSession } = require("@/lib/auth");
const { getAuthorizationContext, requireAuthorization } = require("@/lib/authorization");
const { isWithinScope } = require("@/lib/authorization/scope");
const {
  requireProgramScope,
  requireProgramScopeForAll,
} = require("@/lib/programScopedAccess");

const decision = (res) => res.headers.get("X-Authz-Decision");

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ cid: "USR_PM", role: "staff", email: "pm@x.test" });
  getAuthorizationContext.mockResolvedValue({ isSuperAdmin: false });
  requireAuthorization.mockResolvedValue(null);
  isWithinScope.mockResolvedValue(true);
});

describe("enforcement is unconditional", () => {
  test("the scope of the program is consulted on every call", async () => {
    const res = await requireProgramScope({ programId: "P1", wave: "content" });

    expect(res).toBeNull();
    // No switch, no cache of "is it on": the assignment data is read.
    expect(isWithinScope).toHaveBeenCalledWith(
      "program_staffed",
      "USR_PM",
      "P1",
      { email: "pm@x.test" },
    );
  });

  test("an unknown wave name is harmless — it only labels the denial", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await requireProgramScope({ programId: "P1", wave: "nope" });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.missing.wave).toBe("nope");
  });
});

describe("denials", () => {
  test("an unauthenticated caller is refused", async () => {
    getSession.mockResolvedValueOnce(null);
    const res = await requireProgramScope({ programId: "P1", wave: "content" });

    expect(res.status).toBe(401);
    expect(decision(res)).toBe("unauthenticated");
  });

  test("Super Admin passes unscoped — resolver semantics", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true });
    const res = await requireProgramScope({ programId: "P1", wave: "content" });

    expect(res).toBeNull();
    expect(isWithinScope).not.toHaveBeenCalled();
  });

  test("staffed on the program → allowed", async () => {
    isWithinScope.mockResolvedValueOnce(true);
    const res = await requireProgramScope({ programId: "P1", wave: "content" });

    expect(res).toBeNull();
  });

  test("NOT staffed on the program → refused, and the missing scope is named", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await requireProgramScope({ programId: "P1", wave: "content" });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(decision(res)).toBe("out-of-scope");
    expect(body.missing).toEqual({ scope: "program_staffed", wave: "content" });
  });

  test("a missing program id is a denial, never a pass", async () => {
    const res = await requireProgramScope({ programId: null, wave: "content" });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(decision(res)).toBe("unresolvable");
    expect(body.missing.reason).toBe("program-unresolvable");
    expect(isWithinScope).not.toHaveBeenCalled();
  });

  test("an optional capability is enforced through the resolver", async () => {
    requireAuthorization.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    const res = await requireProgramScope({
      programId: "P1",
      wave: "content",
      module: "programs",
      capability: "edit",
      minLevel: 3,
    });

    expect(res.status).toBe(403);
    expect(decision(res)).toBe("capability-missing");
    expect(requireAuthorization).toHaveBeenCalledWith("programs", "edit", 3);
    // The record scope is not even reached when the capability is missing.
    expect(isWithinScope).not.toHaveBeenCalled();
  });

  test("an infrastructure failure is a 500, never a silent allow", async () => {
    isWithinScope.mockRejectedValueOnce(new Error("db down"));
    const res = await requireProgramScope({ programId: "P1", wave: "content" });

    expect(res.status).toBe(500);
    expect(decision(res)).toBe("system-failure");
  });
});

describe("bulk actions — every id must be in scope", () => {

  test("all ids in scope → allowed", async () => {
    isWithinScope.mockResolvedValue(true);
    const res = await requireProgramScopeForAll({
      programIds: ["P1", "P2"],
      wave: "enrollment",
    });

    expect(res).toBeNull();
    expect(isWithinScope).toHaveBeenCalledTimes(2);
  });

  test("ONE out-of-scope id refuses the WHOLE batch, not half of it", async () => {
    isWithinScope
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const res = await requireProgramScopeForAll({
      programIds: ["P1", "P2"],
      wave: "enrollment",
    });

    expect(res.status).toBe(403);
    expect(decision(res)).toBe("out-of-scope");
  });

  test("an empty list cannot be scoped, so it is refused", async () => {
    const res = await requireProgramScopeForAll({
      programIds: [],
      wave: "enrollment",
    });
    expect(res.status).toBe(403);
    expect(decision(res)).toBe("unresolvable");
  });

  test("a single id is accepted without wrapping it in an array", async () => {
    const res = await requireProgramScopeForAll({
      programIds: "P1",
      wave: "enrollment",
    });
    expect(res).toBeNull();
  });

  test("an unauthenticated bulk call is refused before any scope lookup", async () => {
    getSession.mockResolvedValueOnce(null);
    const res = await requireProgramScopeForAll({
      programIds: ["P1", "P2"],
      wave: "enrollment",
    });
    expect(res.status).toBe(401);
    expect(isWithinScope).not.toHaveBeenCalled();
  });
});
