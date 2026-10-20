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
  test("the platform owner always wins, even inside the group", () => {
    expect(
      resolveEffectiveRole({ role: "super_admin", group_name: INTERNAL_GROUP }),
    ).toBe("super_admin");
  });

  test("D-2 — retired contextual labels normalize to member", () => {
    for (const role of ["participant", "facilitator", "investor", "founder"]) {
      expect(resolveEffectiveRole({ role })).toBe("member");
    }
    // A retired label inside the internal group still resolves as staff.
    expect(
      resolveEffectiveRole({ role: "investor", group_name: INTERNAL_GROUP }),
    ).toBe("staff");
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
    expect(resolveEffectiveRole({ role: "participant", groups: [] })).toBe(
      "member",
    );
    expect(
      resolveEffectiveRole({ role: "member", groups: ["COME UP"] }),
    ).toBe("member");
    expect(resolveEffectiveRole({ role: "", groups: [] })).toBe("member");
  });

  test("outside the group, baseline identities are preserved", () => {
    expect(resolveEffectiveRole({ role: "member" })).toBe("member");
    expect(resolveEffectiveRole({ role: "staff" })).toBe("staff");
    // A retired label is a FUNCTION (profile), never an identity.
    for (const role of ["participant", "facilitator", "investor", "founder"]) {
      expect(resolveEffectiveRole({ role })).toBe("member");
    }
  });

  test("unknown or missing role outside the group defaults to member", () => {
    expect(resolveEffectiveRole({ role: "" })).toBe("member");
    expect(resolveEffectiveRole({ role: "weird_role" })).toBe("member");
    expect(resolveEffectiveRole({})).toBe("member");
  });

  test("team and family entity logins keep their entity identity", () => {
    expect(
      resolveEffectiveRole({
        role: "participant",
        group_name: INTERNAL_GROUP,
        isTeam: true,
      }),
    ).toBe("team");
    expect(resolveEffectiveRole({ role: "staff", isFamily: true })).toBe(
      "member",
    );
  });
});
