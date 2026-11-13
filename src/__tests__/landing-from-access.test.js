/**
 * Étape 4 — landing from access (the data-driven rule).
 *
 * The priority list is data; this suite pins the evaluation:
 *   - the structural space home is the fallback, never a role-label branch;
 *   - a capability gates the staff/owner destinations;
 *   - the member space answers ONE destination for every member, whatever
 *     relationship or profile they hold (the sections are decided by the
 *     dashboard's own read, not by the landing).
 */

const {
  resolveLandingFromAccess,
} = require("@/models/platform/roles");

describe("landing from access — staff and owner", () => {
  test("the owner lands on the admin home", () => {
    expect(
      resolveLandingFromAccess({
        role: "super_admin",
        effective: { permissions: { view_matrix: 1 } },
      }),
    ).toBe("/admin");
  });

  test("the owner stays in the admin space even without the matrix right", () => {
    expect(
      resolveLandingFromAccess({ role: "super_admin", effective: {} }),
    ).toBe("/admin");
  });

  test("a program manager profile with the program right lands in the PM space", () => {
    expect(
      resolveLandingFromAccess({
        role: "staff",
        profiles: ["program_manager"],
        effective: { programs: { view: 1 } },
      }),
    ).toBe("/staff/program-manager");
  });

  test("the PM profile without the program right falls back to staff", () => {
    expect(
      resolveLandingFromAccess({
        role: "staff",
        profiles: ["program_manager"],
        effective: {},
      }),
    ).toBe("/staff");
  });

  test("the finance right selects the finance home", () => {
    expect(
      resolveLandingFromAccess({
        role: "staff",
        effective: { finance: { view: 1 } },
      }),
    ).toBe("/staff/finance");
  });

  test("plain staff lands on the staff home", () => {
    expect(resolveLandingFromAccess({ role: "staff" })).toBe("/staff");
  });
});

describe("landing from access — one member home", () => {
  test("a team account keeps its workspace", () => {
    expect(resolveLandingFromAccess({ role: "team", teamId: 7 })).toBe(
      "/member/team/7",
    );
    expect(resolveLandingFromAccess({ role: "team" })).toBe("/member/team");
  });

  test.each([
    "member",
    "participant",
    "founder",
    "facilitator",
    "investor",
    "security_officer",
  ])("%s lands on the dashboard", (role) => {
    expect(resolveLandingFromAccess({ role })).toBe("/dashboard");
  });

  test("profiles do not open a separate destination any more", () => {
    for (const profiles of [["investor"], ["founder"], ["facilitator"], ["participant"]]) {
      expect(resolveLandingFromAccess({ role: "member", profiles })).toBe("/dashboard");
    }
  });
});

describe("landing from access — rights are optional at evaluation time", () => {
  test("an unloaded matrix does not block the profile destination", () => {
    expect(
      resolveLandingFromAccess({
        role: "staff",
        profiles: ["program_manager"],
        effective: null,
      }),
    ).toBe("/staff/program-manager");
  });
});
