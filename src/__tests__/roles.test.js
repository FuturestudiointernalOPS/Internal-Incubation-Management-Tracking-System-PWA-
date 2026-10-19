/**
 * Canonical login identity resolution — FUTURE STUDIO group membership =
 * internal staff membership (see src/lib/platform/roles.js).
 */

const {
  resolveEffectiveRole,
  resolveLanding,
  INTERNAL_GROUP,
} = require("@/models/platform/roles");

afterEach(() => {
  delete process.env.AUTHZ_PM_IDENTITY;
});

describe("resolveEffectiveRole — FUTURE STUDIO group = internal staff", () => {
  test("privileged identities always win, even inside the group", () => {
    expect(
      resolveEffectiveRole({ role: "super_admin", group_name: INTERNAL_GROUP }),
    ).toBe("super_admin");
    expect(
      resolveEffectiveRole({ role: "investor", group_name: INTERNAL_GROUP }),
    ).toBe("investor");
    expect(
      resolveEffectiveRole({ role: "founder", group_name: INTERNAL_GROUP }),
    ).toBe("founder");
  });

  test("legacy 'sa' id resolves to super_admin (never overridden)", () => {
    expect(
      resolveEffectiveRole({ role: "participant", legacySa: true }),
    ).toBe("super_admin");
  });

  test("staff-family roles normalize to staff", () => {
    for (const role of ["staff", "project_manager"]) {
      expect(resolveEffectiveRole({ role })).toBe("staff");
    }
  });

  test("D-1 — program manager is a staff identity by default", () => {
    delete process.env.AUTHZ_PM_IDENTITY;
    expect(resolveEffectiveRole({ role: "program_manager" })).toBe("staff");
  });

  test("D-1 — the legacy role is available as an explicit rollback", () => {
    process.env.AUTHZ_PM_IDENTITY = "role";
    expect(resolveEffectiveRole({ role: "program_manager" })).toBe(
      "program_manager",
    );
  });

  test("D-1 — a staff identity with the PM profile lands in the PM space", () => {
    expect(
      resolveLanding({ role: "staff", profiles: ["program_manager"] }),
    ).toBe("/pm");
    expect(resolveLanding({ role: "staff", profiles: [] })).toBe("/staff");
  });

  test("FUTURE STUDIO active membership = staff for every other identity", () => {
    expect(
      resolveEffectiveRole({ role: "member", groups: [INTERNAL_GROUP] }),
    ).toBe("staff");
    expect(
      resolveEffectiveRole({ role: "participant", groups: [INTERNAL_GROUP] }),
    ).toBe("staff");
    expect(
      resolveEffectiveRole({ role: "facilitator", groups: [INTERNAL_GROUP] }),
    ).toBe("staff");
    expect(
      resolveEffectiveRole({ role: "", groups: [INTERNAL_GROUP] }),
    ).toBe("staff");
    // case-insensitive + raw group_name compat fallback
    expect(
      resolveEffectiveRole({ role: null, group_name: "future studio" }),
    ).toBe("staff");
  });

  test("EXPIRED/ENDED FUTURE STUDIO membership produces NO staff (Phase 1)", () => {
    // The caller passes only EFFECTIVE (active, unexpired) groups — an
    // expired membership is not in the list, so the person keeps their
    // explicit identity instead of being promoted to staff.
    expect(
      resolveEffectiveRole({ role: "participant", groups: [] }),
    ).toBe("participant");
    expect(
      resolveEffectiveRole({ role: "member", groups: ["COME UP"] }),
    ).toBe("member");
    expect(
      resolveEffectiveRole({ role: "", groups: [] }),
    ).toBe("participant");
  });

  test("outside the group, explicit identities are preserved", () => {
    expect(resolveEffectiveRole({ role: "participant" })).toBe("participant");
    expect(resolveEffectiveRole({ role: "member" })).toBe("member");
    expect(resolveEffectiveRole({ role: "facilitator" })).toBe("facilitator");
  });

  test("unknown or missing role outside the group defaults to participant", () => {
    expect(resolveEffectiveRole({ role: "" })).toBe("participant");
    expect(resolveEffectiveRole({ role: "weird_role" })).toBe("participant");
    expect(resolveEffectiveRole({})).toBe("participant");
  });

  test("team and family entity logins keep their entity identity", () => {
    expect(
      resolveEffectiveRole({
        role: "participant",
        group_name: INTERNAL_GROUP,
        isTeam: true,
      }),
    ).toBe("team");
    expect(
      resolveEffectiveRole({ role: "staff", isFamily: true }),
    ).toBe("participant");
  });
});
