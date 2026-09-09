/**
 * PHASE I3 — Context-surface resolver tests (pure).
 *
 * Locks the single-source surface map and label rules used by the context
 * switcher + workspaces hub:
 *   1. PATH_CONTEXT_ROLES ↔ SURFACE_HOMES stay in sync (one entry per surface).
 *   2. Pathname → surface resolution (longest prefix wins).
 *   3. Context label keys: venture rows distinguish Founder from Venture
 *      Member; LMS rows label Learner; unknown roles fall back to the member
 *      label (never an unmapped i18n key).
 *
 * These functions project context for UI/navigation only. They NEVER
 * authorize — server-side guards remain the security boundary.
 */
const {
  PATH_CONTEXT_ROLES,
  SURFACE_HOMES,
  resolveActiveSurface,
  surfaceHome,
  contextRoleLabelKey,
} = require("@/lib/context");

describe("surface map contract", () => {
  test("every surface role has exactly one pathname prefix", () => {
    const prefixRoles = PATH_CONTEXT_ROLES.map((p) => p.role);
    expect(new Set(prefixRoles).size).toBe(prefixRoles.length);
  });

  test("PATH_CONTEXT_ROLES and SURFACE_HOMES cover the same surfaces", () => {
    const prefixRoles = PATH_CONTEXT_ROLES.map((p) => p.role).sort();
    const homeSurfaces = Object.keys(SURFACE_HOMES).sort();
    expect(prefixRoles).toEqual(homeSurfaces);
  });

  test("every surface home actually resolves back to that surface", () => {
    for (const { role, prefix } of PATH_CONTEXT_ROLES) {
      expect(resolveActiveSurface(SURFACE_HOMES[role])).toBe(role);
      expect(SURFACE_HOMES[role].startsWith(prefix)).toBe(true);
    }
  });
});

describe("resolveActiveSurface", () => {
  test("resolves deep paths inside a surface", () => {
    expect(resolveActiveSurface("/admin/ventures/V-1/dashboard")).toBe("super_admin");
    expect(resolveActiveSurface("/participant/ventures/V-1")).toBe("participant");
    expect(resolveActiveSurface("/facilitator/program/P-1")).toBe("facilitator");
    expect(resolveActiveSurface("/participant/learning")).toBe("participant");
  });

  test("longest prefix wins where prefixes share a stem", () => {
    // "/participant/..." must not collide with shorter "/pm" or "/staff" rules.
    expect(resolveActiveSurface("/pm")).toBe("program_manager");
    expect(resolveActiveSurface("/workspaces")).toBe("member");
    expect(resolveActiveSurface("/workspaces/settings")).toBe("member");
  });

  test("returns null for paths outside every surface", () => {
    expect(resolveActiveSurface("/login")).toBeNull();
    expect(resolveActiveSurface("/register")).toBeNull();
    expect(resolveActiveSurface(null)).toBeNull();
    expect(resolveActiveSurface("")).toBeNull();
  });
});

describe("surfaceHome", () => {
  test("returns the configured home per surface", () => {
    expect(surfaceHome("super_admin")).toBe("/admin");
    expect(surfaceHome("participant")).toBe("/participant");
    expect(surfaceHome("member")).toBe("/workspaces");
  });

  test("falls back to the member workspace for unknown surfaces", () => {
    expect(surfaceHome("not-a-surface")).toBe("/workspaces");
    expect(surfaceHome()).toBe("/workspaces");
  });
});

describe("contextRoleLabelKey", () => {
  test("venture: founder signals (member_type / role / owner flags) → Founder", () => {
    expect(contextRoleLabelKey({ kind: "venture", row: { member_type: "founder" } })).toBe(
      "roleFounder",
    );
    expect(contextRoleLabelKey({ kind: "venture", row: { role: "founder" } })).toBe(
      "roleFounder",
    );
    expect(contextRoleLabelKey({ kind: "venture", row: { is_owner: true } })).toBe(
      "roleFounder",
    );
    expect(contextRoleLabelKey({ kind: "venture", row: { isOwner: true } })).toBe(
      "roleFounder",
    );
  });

  test("venture: team members (any free-text role) → Venture Member", () => {
    expect(contextRoleLabelKey({ kind: "venture", row: { member_type: "team_member" } })).toBe(
      "roleVentureMember",
    );
    expect(
      contextRoleLabelKey({ kind: "venture", row: { member_type: "team_member", role: "CEO" } }),
    ).toBe("roleVentureMember");
    expect(contextRoleLabelKey({ kind: "venture", row: {} })).toBe("roleVentureMember");
  });

  test("lms contexts are always labelled Learner", () => {
    expect(contextRoleLabelKey({ kind: "lms" })).toBe("roleLearner");
    expect(contextRoleLabelKey({ kind: "lms", row: { role: "founder" } })).toBe("roleLearner");
  });

  test("known contextual roles map to their label key", () => {
    for (const [role, key] of [
      ["facilitator", "roleFacilitator"],
      ["participant", "roleParticipant"],
      ["staff", "roleStaff"],
      ["program_manager", "roleProgramManager"],
      ["teacher", "roleTeacher"],
      ["finance", "roleFinance"],
      ["intern", "roleIntern"],
    ]) {
      expect(contextRoleLabelKey({ kind: "role", row: { role } })).toBe(key);
    }
  });

  test("unknown roles / responsibility keys fall back to the member label", () => {
    expect(contextRoleLabelKey({ kind: "role", row: { role: "engineering" } })).toBe("roleOther");
    expect(contextRoleLabelKey({ kind: "role", row: { role: "member" } })).toBe("roleOther");
    expect(contextRoleLabelKey({ kind: "role", row: {} })).toBe("roleOther");
  });
});
