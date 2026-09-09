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
  activeContextFromPathname,
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

describe("activeContextFromPathname (Phase I4)", () => {
  // Shape mirrors the context-switcher items derived from /api/workspaces.
  const fixtureItems = () => [
    {
      key: "assign-PB-facilitator",
      type: "program_assignment",
      href: "/facilitator/program/PB",
      title: "Program B",
      labelKey: "roleFacilitator",
    },
    {
      key: "part-PA",
      type: "program_participation",
      href: "/participant/PA",
      title: "Program A",
      labelKey: "roleParticipant",
    },
    {
      key: "venture-VX",
      type: "venture",
      href: "/participant/ventures/VX",
      title: "Venture X",
      labelKey: "roleFounder",
    },
    {
      key: "learning",
      type: "learning",
      href: "/participant/learning",
      title: "My Learning",
      labelKey: "roleLearner",
    },
    { key: "org-FS", type: "org", href: "/staff", title: "Future Studio", labelKey: "roleStaff" },
    { key: "resp-fin", type: "responsibility", href: "/finance", title: "Finance", labelKey: "roleFinance" },
  ];

  test("deep pages inside a workspace resolve to that context", () => {
    const items = fixtureItems();
    expect(
      activeContextFromPathname("/facilitator/program/PB/sessions/9", items),
    ).toMatchObject({ key: "assign-PB-facilitator" });
    expect(activeContextFromPathname("/participant/PA/deliverables", items)).toMatchObject({
      key: "part-PA",
    });
    expect(activeContextFromPathname("/participant/ventures/VX/team", items)).toMatchObject({
      key: "venture-VX",
    });
    expect(activeContextFromPathname("/participant/learning", items)).toMatchObject({
      key: "learning",
    });
  });

  test("exact context landing pages count as active", () => {
    expect(activeContextFromPathname("/facilitator/program/PB", fixtureItems())).toMatchObject({
      key: "assign-PB-facilitator",
    });
    expect(activeContextFromPathname("/participant/PA", fixtureItems())).toMatchObject({
      key: "part-PA",
    });
  });

  test("baseline/home pages wear no hat", () => {
    const items = fixtureItems();
    expect(activeContextFromPathname("/participant", items)).toBeNull();
    expect(activeContextFromPathname("/facilitator", items)).toBeNull();
    expect(activeContextFromPathname("/admin", items)).toBeNull();
    expect(activeContextFromPathname("/login", items)).toBeNull();
    expect(activeContextFromPathname(null, items)).toBeNull();
    expect(activeContextFromPathname("", items)).toBeNull();
  });

  test("org and responsibility rows never match as hats", () => {
    // Their hrefs are whole surfaces (/staff, /finance) — membership is an
    // entitlement, not a navigable workspace hat.
    expect(activeContextFromPathname("/staff", fixtureItems())).toBeNull();
    expect(activeContextFromPathname("/finance", fixtureItems())).toBeNull();
    expect(activeContextFromPathname("/staff/dashboard", fixtureItems())).toBeNull();
  });

  test("longest context href wins when two contexts could match", () => {
    const items = [
      { key: "narrow", type: "program_assignment", href: "/facilitator/program/PB" },
      { key: "broad", type: "program_assignment", href: "/facilitator" },
    ];
    expect(
      activeContextFromPathname("/facilitator/program/PB/sessions/9", items),
    ).toMatchObject({ key: "narrow" });
    expect(activeContextFromPathname("/facilitator", items)).toMatchObject({ key: "broad" });
  });

  test("non-matching neighbours never leak into the result", () => {
    const items = fixtureItems();
    // Participant home is a surface, not Program A — no context match.
    expect(activeContextFromPathname("/participant", items)).toBeNull();
    // The ventures area of one venture is not another venture's workspace.
    expect(activeContextFromPathname("/participant/ventures", items)).toBeNull();
  });

  test("handles malformed input without throwing", () => {
    expect(activeContextFromPathname("/participant/PA", null)).toBeNull();
    expect(activeContextFromPathname("/participant/PA", [])).toBeNull();
    expect(activeContextFromPathname("/participant/PA", [{ type: "venture" }])).toBeNull();
    expect(activeContextFromPathname("/participant/PA", [{ type: "venture", href: null }])).toBeNull();
  });
});
