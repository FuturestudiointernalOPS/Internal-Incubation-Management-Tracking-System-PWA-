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

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "USR_PM", role: "staff", email: "pm@x.test" })),
}));

jest.mock("@/models/authorization/index", () => ({
  getAuthorizationContext: jest.fn(async () => ({ isSuperAdmin: false })),
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/services/authorization/scope", () => ({
  isWithinScope: jest.fn(async () => true),
}));

const mockShadowEnabled = jest.fn(() => false);
const mockShadowCheck = jest.fn();
jest.mock("@/services/authorization/shadow", () => ({
  shadowEnabled: () => mockShadowEnabled(),
  shadowCheck: (...args) => mockShadowCheck(...args),
}));

const { getSession } = require("@/server/auth/session");
const { getAuthorizationContext, requireAuthorization } = require("@/models/authorization/index");
const { isWithinScope } = require("@/services/authorization/scope");
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
  mockShadowEnabled.mockReturnValue(false);
});

describe("enforcement is unconditional", () => {
  test("the scope of the program is consulted on every call", async () => {
    const res = await requireProgramScope({ programId: "P1", wave: "content" });

    expect(res).toBeNull();
    // No switch, no cache of "is it on": the assignment data is read.
    expect(isWithinScope).toHaveBeenCalledWith(
      "program_managed",
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

  test("managing the program → allowed", async () => {
    isWithinScope.mockResolvedValueOnce(true);
    const res = await requireProgramScope({ programId: "P1", wave: "content" });

    expect(res).toBeNull();
  });

  test("NOT managing the program → refused, and the missing scope is named", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await requireProgramScope({ programId: "P1", wave: "content" });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(decision(res)).toBe("out-of-scope");
    expect(body.missing).toEqual({ scope: "program_managed", wave: "content" });
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

describe("D-4 / Lot 8 — the replaced staffing rule is no longer probed", () => {
  const MANAGED = "program_managed";

  test("only the manager profile is consulted, even with the shadow flag on", async () => {
    // The transition probe was removed once its single divergence was explained.
    // Turning the flag on must not bring it back: the perimeter is one rule.
    mockShadowEnabled.mockReturnValue(true);

    const res = await requireProgramScope({ programId: "P1", wave: "content" });

    expect(res).toBeNull();
    expect(isWithinScope.mock.calls.map(([policy]) => policy)).toEqual([MANAGED]);
    expect(mockShadowCheck).not.toHaveBeenCalled();
  });
});

/**
 * Lot 3.2 — capability and perimeter are decided TOGETHER.
 *
 * A program-scope call that does not name a capability leaves the route to
 * check the right somewhere else (or nowhere). This scan freezes the coupling:
 * a new call without a capability fails here, and removing an entry from the
 * exception list is the only direction that keeps this green.
 */
describe("3.2 — every program-scope call names the capability it enforces", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  const ROOT = path.join(__dirname, "..", "..");

  // One call has no literal capability:
  //   - team-tasks: the helper receives `module`/`capability` as parameters, so
  //     every caller does name one even though this line does not.
  //
  // `submissions` used to be the second: grading is `assignments.grade` for a
  // facilitator and `programs.edit` for a program manager. The ANY-OF list
  // (`capabilities: [...]`) now expresses exactly that, so no route is left
  // uncoupled.
  const EXPECTED = ["src/app/api/team-tasks/route.js"];

  function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (entry.name.endsWith(".js")) out.push(full);
    }
    return out;
  }

  test("no route or service adds an uncoupled program-scope call", () => {
    const offenders = [];

    for (const file of [...walk(path.join(ROOT, "src", "app")), ...walk(path.join(ROOT, "src", "services"))]) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (!/requireProgramScope(ForAll)?\(/.test(line)) return;
        if (/export async function/.test(line)) return;
        const window = lines.slice(index, index + 9).join("\n");
        if (/capabilit(?:y|ies):/.test(window)) return;
        offenders.push(path.relative(ROOT, file).split(path.sep).join("/"));
      });
    }

    expect([...new Set(offenders)].sort()).toEqual([...EXPECTED].sort());
  });
});
