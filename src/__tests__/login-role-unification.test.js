/**
 * LOT 1, STEP 1.1 — one sign-in role resolver.
 *
 * Both sign-in routes must call the canonical resolver. The matrix below pins
 * the values the resolver produces, including the reversible D-1 switch for
 * the program manager.
 */

const fs = require("node:fs");
const path = require("node:path");
const { resolveEffectiveRole } = require("@/models/platform/roles");

const read = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

afterEach(() => {
  delete process.env.AUTHZ_PM_IDENTITY;
});

describe("both sign-in paths use the canonical resolver", () => {
  test("login and session-login call resolveEffectiveRole", () => {
    expect(read("src/app/api/auth/login/route.js")).toContain(
      "resolveEffectiveRole(",
    );
    expect(read("src/app/api/auth/session-login/route.js")).toContain(
      "resolveEffectiveRole(",
    );
  });

  test("session-login no longer has its own program_manager branch", () => {
    const source = read("src/app/api/auth/session-login/route.js");
    expect(source).not.toContain('finalRole = "program_manager"');
    expect(source).not.toContain('user.role === "program_manager"');
  });
});

describe("resolved role matrix", () => {
  test.each([
    ["super_admin", "super_admin"],
    ["staff", "staff"],
    ["member", "member"],
    ["participant", "participant"],
    ["facilitator", "facilitator"],
    ["investor", "investor"],
    ["founder", "founder"],
  ])("%s → %s", (stored, expected) => {
    expect(resolveEffectiveRole({ role: stored })).toBe(expected);
  });

  test("program manager has exactly one target per mode", () => {
    delete process.env.AUTHZ_PM_IDENTITY;
    expect(resolveEffectiveRole({ role: "program_manager" })).toBe("staff");

    process.env.AUTHZ_PM_IDENTITY = "role";
    expect(resolveEffectiveRole({ role: "program_manager" })).toBe(
      "program_manager",
    );
  });

  test("team and family entity logins keep their entity identity", () => {
    expect(resolveEffectiveRole({ role: "staff", isTeam: true })).toBe("team");
    expect(resolveEffectiveRole({ role: "staff", isFamily: true })).toBe(
      "participant",
    );
  });
});
