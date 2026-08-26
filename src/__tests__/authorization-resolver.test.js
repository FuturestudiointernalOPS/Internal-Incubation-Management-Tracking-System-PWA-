/**
 * Authorization Foundation (Phase 0) — unit tests for the pure resolution
 * logic: merge semantics (V2-equivalent), eligibility evaluation, and the
 * authorize() decision (allow / deny / restriction / missing / Super Admin).
 *
 * Pure logic only — the DB layer is mocked, no database access.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => {
  const PERMISSION_MODULES = {
    projects: { capabilities: ["view", "create", "edit", "delete", "archive"] },
    programs: { capabilities: ["view", "create", "edit", "delete", "publish"] },
    users: {
      capabilities: ["view", "create", "edit", "suspend", "delete", "assign_roles"],
    },
    reports: { capabilities: ["view", "create", "export", "delete"] },
    messaging: { capabilities: ["view", "send", "delete"] },
    internal_comms: { capabilities: ["view", "create_announcements", "moderate"] },
    contacts: { capabilities: ["view", "create", "edit", "delete", "import", "export"] },
    permissions: {
      capabilities: [
        "view_matrix",
        "grant",
        "revoke",
        "assign_capabilities",
        "assign_groups",
        "assign_responsibilities",
        "promote_super_admin",
        "remove_super_admin",
        "configure_eligibility",
      ],
    },
    engineering: {
      capabilities: ["view", "manage_tasks", "manage_errors", "manage_developers"],
    },
    finance: { capabilities: ["view", "create", "edit", "delete", "export"] },
    settings: { capabilities: ["view", "edit"] },
    facilitator: {
      capabilities: [
        "participants.view",
        "participants.manage",
        "attendance.view",
        "attendance.record",
        "assignments.view",
        "assignments.review",
        "assignments.grade",
        "sessions.conduct",
        "sessions.record",
        "progress.view",
        "groups.view",
        "groups.manage",
        "reviews.submit",
      ],
    },
  };
  return {
    PERMISSION_MODULES,
    ACCESS_LEVELS: { NONE: 0, VIEW: 1, CREATE: 2, EDIT: 3, DELETE: 4, FULL: 5 },
    getSession: jest.fn(async () => null),
    ensurePermissionsSchema: jest.fn(async () => {}),
  };
});

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body, init = {}) => ({ body, ...init }),
  },
}));

const {
  mergeEffectiveCapabilities,
  authorize,
} = require("@/lib/authorization/resolver");
const { evaluateEligibility } = require("@/lib/authorization/eligibility");
const { requireAuthorization } = require("@/lib/authorization");

// ─── mergeEffectiveCapabilities: V2 semantics ───────────────────────────────

describe("mergeEffectiveCapabilities (V2 semantics)", () => {
  test("takes the MAX of profile base and individual grants", () => {
    const base = { finance: { view: 1 } };
    const grants = { finance: { view: 3 } };
    const merged = mergeEffectiveCapabilities(base, {}, grants, {});
    expect(merged.finance.view).toBe(3);
  });

  test("takes the MAX of group grants and individual grants", () => {
    const group = { contacts: { view: 1, create: 2 } };
    const grants = { contacts: { view: 2 } };
    const merged = mergeEffectiveCapabilities({}, group, grants, {});
    expect(merged.contacts.view).toBe(2);
    expect(merged.contacts.create).toBe(2);
  });

  test("restrictions REMOVE the capability entirely (strongest block)", () => {
    const base = { finance: { view: 3, create: 2 } };
    const restrictions = { finance: new Set(["view"]) };
    const merged = mergeEffectiveCapabilities(base, {}, {}, restrictions);
    expect(merged.finance.view).toBeUndefined();
    expect(merged.finance.create).toBe(2);
  });

  test("missing everything produces an empty map (fail closed)", () => {
    const merged = mergeEffectiveCapabilities({}, {}, {}, {});
    expect(merged).toEqual({});
  });

  test("merges across multiple groups with max semantics", () => {
    const group = {
      finance: { view: 1 },
      crm: { view: 2 },
    };
    const grants = { crm: { view: 1 } };
    const merged = mergeEffectiveCapabilities({}, group, grants, {});
    expect(merged.crm.view).toBe(2);
  });
});

// ─── evaluateEligibility ─────────────────────────────────────────────────────

describe("evaluateEligibility", () => {
  test("eligible when an identity row says yes", () => {
    const rows = [{ feature_key: "finance", eligible: 1 }];
    expect(evaluateEligibility(rows, "finance")).toBe(true);
  });

  test("NOT eligible when no rows exist (missing = deny)", () => {
    expect(evaluateEligibility([], "finance")).toBe(false);
  });

  test("NOT eligible when a row says no", () => {
    const rows = [{ feature_key: "finance", eligible: 0 }];
    expect(evaluateEligibility(rows, "finance")).toBe(false);
  });

  test("an explicit deny wins over an allow", () => {
    const rows = [
      { feature_key: "finance", eligible: 1 },
      { feature_key: "finance", eligible: 0 },
    ];
    expect(evaluateEligibility(rows, "finance")).toBe(false);
  });

  test("ignores rows for other features", () => {
    const rows = [{ feature_key: "crm", eligible: 1 }];
    expect(evaluateEligibility(rows, "finance")).toBe(false);
  });
});

// ─── authorize(): Super Admin ───────────────────────────────────────────────

const saCtx = (overrides = {}) => ({
  cid: "USR-SA",
  role: "super_admin",
  isSuperAdmin: true,
  eligibility: null,
  effective: { finance: { view: 5, create: 5 } },
  grants: {},
  restrictions: {},
  ...overrides,
});

describe("authorize() — Super Admin", () => {
  test("SA with no restriction and no grant is allowed", () => {
    expect(authorize(saCtx(), "finance", "view")).toBe(true);
    expect(authorize(saCtx(), "contacts", "delete")).toBe(true);
  });

  test("SA with an explicit restriction is DENIED", () => {
    const ctx = saCtx({ restrictions: { finance: new Set(["view"]) } });
    expect(authorize(ctx, "finance", "view")).toBe(false);
    expect(authorize(ctx, "finance", "create")).toBe(true); // unrelated cap unaffected
  });

  test("SA with an explicit grant below minLevel is DENIED (V2 edge case)", () => {
    const ctx = saCtx({ grants: { finance: { view: 0 } } });
    expect(authorize(ctx, "finance", "view")).toBe(false);
  });

  test("SA with an explicit grant at/above minLevel is allowed", () => {
    const ctx = saCtx({ grants: { finance: { view: 2 } } });
    expect(authorize(ctx, "finance", "view", 2)).toBe(true);
  });
});

// ─── authorize(): non-Super Admin ───────────────────────────────────────────

const staffCtx = (overrides = {}) => ({
  cid: "USR-STAFF",
  role: "staff",
  isSuperAdmin: false,
  eligibility: { finance: true, crm: false },
  effective: { finance: { view: 1, create: 2 }, contacts: { view: 3 } },
  grants: {},
  restrictions: {},
  ...overrides,
});

describe("authorize() — non-Super Admin", () => {
  test("eligible + sufficient level → allowed", () => {
    expect(authorize(staffCtx(), "finance", "view")).toBe(true);
    expect(authorize(staffCtx(), "finance", "create", 2)).toBe(true);
  });

  test("eligible but insufficient level → denied", () => {
    expect(authorize(staffCtx(), "finance", "view", 3)).toBe(false);
  });

  test("INELIGIBLE → denied even with a capability", () => {
    const ctx = staffCtx({ eligibility: { finance: false } });
    expect(authorize(ctx, "finance", "view")).toBe(false);
  });

  test("missing eligibility row (undefined) → denied (fail closed)", () => {
    const ctx = staffCtx({ eligibility: {} });
    expect(authorize(ctx, "finance", "view")).toBe(false);
  });

  test("missing capability → denied", () => {
    expect(authorize(staffCtx(), "finance", "export")).toBe(false);
    expect(authorize(staffCtx(), "projects", "view")).toBe(false);
  });

  test("restricted capability → denied even with a grant", () => {
    // Restrictions are applied at MERGE time: the capability is absent from
    // `effective`, so authorize() denies. Build the ctx the way the real
    // resolver does (restriction removes the capability entirely).
    const effective = mergeEffectiveCapabilities(
      { finance: { view: 1, create: 2 } },
      {},
      { finance: { view: 3 } },
      { finance: new Set(["view"]) },
    );
    const ctx = staffCtx({
      effective,
      grants: { finance: { view: 3 } },
      restrictions: { finance: new Set(["view"]) },
    });
    expect(authorize(ctx, "finance", "view")).toBe(false);
    expect(authorize(ctx, "finance", "create")).toBe(true);
  });

  test("null context → denied", () => {
    expect(authorize(null, "finance", "view")).toBe(false);
  });
});

// ─── knowledge module (Phase 2 migration) ───────────────────────────────────

describe("knowledge module (Phase 2)", () => {
  test("MODULE_TO_FEATURE maps knowledge → knowledge_base", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.knowledge).toBe("knowledge_base");
  });

  test("eligible staff with knowledge capabilities is allowed", () => {
    const ctx = staffCtx({
      eligibility: { knowledge_base: true },
      effective: { knowledge: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    expect(authorize(ctx, "knowledge", "view")).toBe(true);
    expect(authorize(ctx, "knowledge", "create")).toBe(true);
    expect(authorize(ctx, "knowledge", "delete")).toBe(true);
  });

  test("ineligible user is denied even with knowledge capability", () => {
    const ctx = staffCtx({
      eligibility: { knowledge_base: false },
      effective: { knowledge: { view: 1 } },
    });
    expect(authorize(ctx, "knowledge", "view")).toBe(false);
  });
});

// ─── reports module (Phase 3 migration) ─────────────────────────────────────

describe("reports module (Phase 3)", () => {
  test("MODULE_TO_FEATURE maps reports → reporting", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.reports).toBe("reporting");
  });

  test("reporting eligibility defaults cover the submit routes (admin removed by policy #3)", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    const reporting = FEATURE_ELIGIBILITY_DEFAULTS.reporting;
    expect(reporting).toEqual(
      expect.arrayContaining(["super_admin", "staff", "program_manager", "teacher", "developer"]),
    );
    expect(reporting).not.toContain("admin");
  });

  test("developer with reports.create is allowed on the submit routes", () => {
    const ctx = staffCtx({
      role: "developer",
      isSuperAdmin: false,
      eligibility: { reporting: true },
      effective: { reports: { view: 1, create: 2 } },
    });
    expect(authorize(ctx, "reports", "create")).toBe(true);
    expect(authorize(ctx, "reports", "export")).toBe(false); // no export for developer
  });

  test("teacher with reports.export is allowed on run-export only", () => {
    const ctx = staffCtx({
      role: "teacher",
      isSuperAdmin: false,
      eligibility: { reporting: true },
      effective: { reports: { view: 1, export: 3 } },
    });
    expect(authorize(ctx, "reports", "export")).toBe(true);
    expect(authorize(ctx, "reports", "create")).toBe(false); // teacher must NOT gain submit
  });
});

// ─── contacts module (Phase 4 migration) ────────────────────────────────────

describe("contacts module (Phase 4)", () => {
  test("MODULE_TO_FEATURE maps contacts → crm", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.contacts).toBe("crm");
  });

  test("crm eligibility defaults are internal identities only (participant/founder removed by policy #3)", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.crm).toEqual(
      expect.arrayContaining(["super_admin", "staff", "program_manager", "teacher", "developer"]),
    );
    expect(FEATURE_ELIGIBILITY_DEFAULTS.crm).not.toContain("participant");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.crm).not.toContain("founder");
  });

  test("eligible staff with contacts.view is allowed; edit requires higher capability", () => {
    const ctx = staffCtx({
      eligibility: { crm: true },
      effective: { contacts: { view: 1 } },
    });
    expect(authorize(ctx, "contacts", "view")).toBe(true);
    expect(authorize(ctx, "contacts", "edit")).toBe(false);
  });

  test("eligible participant WITHOUT a contacts capability is denied (eligible ≠ granted)", () => {
    const ctx = staffCtx({
      role: "participant",
      isSuperAdmin: false,
      eligibility: { crm: true },
      effective: {}, // no contacts capabilities
    });
    expect(authorize(ctx, "contacts", "view")).toBe(false);
    expect(authorize(ctx, "contacts", "edit")).toBe(false);
  });

  test("ineligible user is denied even with a contacts grant", () => {
    const ctx = staffCtx({
      role: "member",
      isSuperAdmin: false,
      eligibility: { crm: false },
      effective: { contacts: { view: 3 } },
      grants: { contacts: { view: 3 } },
    });
    expect(authorize(ctx, "contacts", "view")).toBe(false);
  });
});

// ─── internal_comms module (Phase 5 migration) ──────────────────────────────

describe("internal_comms module (Phase 5)", () => {
  test("MODULE_TO_FEATURE maps internal_comms → internal_comms", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.internal_comms).toBe("internal_comms");
  });

  test("internal_comms eligibility defaults no longer include admin (policy #3)", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.internal_comms).toEqual(
      expect.arrayContaining(["super_admin", "staff", "program_manager", "teacher", "developer"]),
    );
    expect(FEATURE_ELIGIBILITY_DEFAULTS.internal_comms).not.toContain("admin");
  });

  test("staff with create_announcements can post; teacher without it cannot", () => {
    const staff = staffCtx({
      eligibility: { internal_comms: true },
      effective: { internal_comms: { view: 1, create_announcements: 2, moderate: 3 } },
    });
    const teacher = staffCtx({
      role: "teacher",
      isSuperAdmin: false,
      eligibility: { internal_comms: true },
      effective: { internal_comms: { view: 1 } }, // eligible but no announcement caps
    });
    expect(authorize(staff, "internal_comms", "create_announcements")).toBe(true);
    expect(authorize(staff, "internal_comms", "moderate")).toBe(true);
    expect(authorize(teacher, "internal_comms", "create_announcements")).toBe(false);
  });
});

// ─── projects module (Phase 6 migration) ────────────────────────────────────

describe("projects module (Phase 6)", () => {
  test("MODULE_TO_FEATURE maps projects → project_ownership", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.projects).toBe("project_ownership");
  });

  test("staff with backfilled delete can delete; developer without it cannot", () => {
    const staff = staffCtx({
      eligibility: { project_ownership: true },
      effective: { projects: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    const developer = staffCtx({
      role: "developer",
      isSuperAdmin: false,
      eligibility: { project_ownership: true },
      effective: { projects: { view: 1, create: 2, edit: 3 } }, // no delete backfill
    });
    expect(authorize(staff, "projects", "delete")).toBe(true);
    expect(authorize(staff, "projects", "create")).toBe(true);
    expect(authorize(developer, "projects", "delete")).toBe(false);
    expect(authorize(developer, "projects", "create")).toBe(true); // POST allowlist ✓
  });

  test("program_manager with backfilled create/edit/delete is allowed (projects writes)", () => {
    const pm = staffCtx({
      role: "program_manager",
      isSuperAdmin: false,
      eligibility: { project_ownership: true },
      effective: { projects: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    expect(authorize(pm, "projects", "create")).toBe(true);
    expect(authorize(pm, "projects", "edit")).toBe(true);
    expect(authorize(pm, "projects", "delete")).toBe(true);
  });

  test("admin is NOT eligible for project_ownership even with Staff Default caps", () => {
    const admin = staffCtx({
      role: "admin",
      isSuperAdmin: false,
      eligibility: { project_ownership: false },
      effective: { projects: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    expect(authorize(admin, "projects", "delete")).toBe(false);
  });
});

// ─── tasks module (Phase 7 migration) ───────────────────────────────────────

describe("tasks module (Phase 7)", () => {
  test("MODULE_TO_FEATURE maps tasks → tasks", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.tasks).toBe("tasks");
  });

  test("tasks eligibility defaults cover the team-tasks allowlist incl. team", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.tasks).toEqual(
      expect.arrayContaining(["super_admin", "staff", "program_manager", "team"]),
    );
  });

  test("team member with tasks capabilities is allowed on the board", () => {
    const teamUser = staffCtx({
      role: "team",
      isSuperAdmin: false,
      eligibility: { tasks: true },
      effective: { tasks: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    expect(authorize(teamUser, "tasks", "view")).toBe(true);
    expect(authorize(teamUser, "tasks", "delete")).toBe(true);
  });

  test("admin inherits Staff Default tasks caps but is NOT eligible → denied", () => {
    const admin = staffCtx({
      role: "admin",
      isSuperAdmin: false,
      eligibility: { tasks: false },
      effective: { tasks: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    expect(authorize(admin, "tasks", "view")).toBe(false);
  });
});

// ─── engineering module (Phase 8 migration + errors gap) ────────────────────

describe("engineering module (Phase 8)", () => {
  test("MODULE_TO_FEATURE maps engineering → engineering", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.engineering).toBe("engineering");
  });

  test("developer with backfilled manage_developers can manage developers", () => {
    const dev = staffCtx({
      role: "developer",
      isSuperAdmin: false,
      eligibility: { engineering: true },
      effective: {
        engineering: { view: 1, manage_tasks: 2, manage_errors: 1, manage_developers: 2 },
      },
    });
    expect(authorize(dev, "engineering", "view")).toBe(true);
    expect(authorize(dev, "engineering", "manage_errors")).toBe(true);
    expect(authorize(dev, "engineering", "manage_developers")).toBe(true);
  });

  test("intern (profile caps but NOT eligible) is denied — no SA-surface gain", () => {
    const intern = staffCtx({
      role: "intern",
      isSuperAdmin: false,
      eligibility: { engineering: false },
      effective: { engineering: { view: 1, manage_tasks: 1 } },
    });
    expect(authorize(intern, "engineering", "view")).toBe(false);
    expect(authorize(intern, "engineering", "manage_errors")).toBe(false);
  });

  test("errors log access requires manage_errors — anonymous has none", () => {
    const ctx = staffCtx({
      role: "staff",
      isSuperAdmin: false,
      eligibility: { engineering: false },
      effective: {},
    });
    expect(authorize(ctx, "engineering", "manage_errors")).toBe(false);
  });
});

// ─── programs module (Phase 9 migration) ────────────────────────────────────

describe("programs module (Phase 9)", () => {
  test("MODULE_TO_FEATURE maps programs → program_management", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.programs).toBe("program_management");
  });

  test("staff/teacher with backfilled programs.edit are allowed (bypass replaced)", () => {
    const staff = staffCtx({
      eligibility: { program_management: true },
      effective: { programs: { view: 1, edit: 3 } },
    });
    const teacher = staffCtx({
      role: "teacher",
      isSuperAdmin: false,
      eligibility: { program_management: true },
      effective: { programs: { view: 1, edit: 3 } },
    });
    expect(authorize(staff, "programs", "edit")).toBe(true);
    expect(authorize(teacher, "programs", "edit")).toBe(true);
  });

  test("staff WITHOUT backfilled delete is denied on program deletion (SA-only preserved)", () => {
    const staff = staffCtx({
      eligibility: { program_management: true },
      effective: { programs: { view: 1, edit: 3 } }, // no delete backfill
    });
    expect(authorize(staff, "programs", "delete")).toBe(false);
    const pm = staffCtx({
      role: "program_manager",
      isSuperAdmin: false,
      eligibility: { program_management: true },
      effective: { programs: { view: 1, create: 2, edit: 3, publish: 4 } }, // PM profile has no delete
    });
    expect(authorize(pm, "programs", "delete")).toBe(false);
  });

  test("admin is NOT eligible for program_management even with Staff Default caps", () => {
    const admin = staffCtx({
      role: "admin",
      isSuperAdmin: false,
      eligibility: { program_management: false },
      effective: { programs: { view: 1, edit: 3 } }, // inherited Staff Default backfill
    });
    expect(authorize(admin, "programs", "edit")).toBe(false);
  });
});

// ─── ventures module (Phase 10 migration) ───────────────────────────────────

describe("ventures module (Phase 10)", () => {
  test("MODULE_TO_FEATURE maps ventures → ventures", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.ventures).toBe("ventures");
  });

  test("ventures eligibility defaults cover the CRUD allowlist", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.ventures).toEqual(
      expect.arrayContaining(["super_admin", "staff", "program_manager"]),
    );
  });

  test("staff/PM with backfilled create can create; nobody but SA can edit", () => {
    const staff = staffCtx({
      eligibility: { ventures: true },
      effective: { ventures: { create: 2 } }, // create backfilled, edit NOT
    });
    const pm = staffCtx({
      role: "program_manager",
      isSuperAdmin: false,
      eligibility: { ventures: true },
      effective: { ventures: { create: 2 } },
    });
    expect(authorize(staff, "ventures", "create")).toBe(true);
    expect(authorize(pm, "ventures", "create")).toBe(true);
    expect(authorize(staff, "ventures", "edit")).toBe(false); // SA-only preserved
  });

  test("participant is NOT eligible for venture CRUD (scoped workspace reads stay role-gated)", () => {
    const participant = staffCtx({
      role: "participant",
      isSuperAdmin: false,
      eligibility: { ventures: false },
      effective: {},
    });
    expect(authorize(participant, "ventures", "create")).toBe(false);
    expect(authorize(participant, "ventures", "view")).toBe(false);
  });
});

// ─── investor module (Phase 11 migration) ───────────────────────────────────

describe("investor module (Phase 11)", () => {
  test("MODULE_TO_FEATURE maps investor → investor", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.investor).toBe("investor");
  });

  test("investor eligibility covers the uniform portal allowlist (no PM)", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.investor).toEqual(
      expect.arrayContaining(["super_admin", "staff", "investor"]),
    );
    expect(FEATURE_ELIGIBILITY_DEFAULTS.investor).not.toContain("program_manager");
  });

  test("investor with backfilled caps is allowed; mentor (same profile) is NOT eligible", () => {
    const investor = staffCtx({
      role: "investor",
      isSuperAdmin: false,
      eligibility: { investor: true },
      effective: { investor: { view: 1, create: 2, edit: 3 } },
    });
    const mentor = staffCtx({
      role: "mentor",
      isSuperAdmin: false,
      eligibility: { investor: false },
      effective: { investor: { view: 1, create: 2, edit: 3 } }, // Mentor profile carries caps
    });
    expect(authorize(investor, "investor", "view")).toBe(true);
    expect(authorize(investor, "investor", "create")).toBe(true);
    expect(authorize(mentor, "investor", "view")).toBe(false);
  });

  test("program_manager is NOT eligible — PM-inclusive reads stay role-gated", () => {
    const pm = staffCtx({
      role: "program_manager",
      isSuperAdmin: false,
      eligibility: { investor: false },
      effective: { investor: { view: 1 } },
    });
    expect(authorize(pm, "investor", "view")).toBe(false);
  });
});

// ─── messaging module (MVP: internal-only policy) ───────────────────────────

describe("messaging module (MVP internal-only)", () => {
  test("messaging eligibility defaults are internal staff only", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.messaging).toEqual([
      "super_admin",
      "staff",
      "program_manager",
      "developer",
    ]);
  });

  test("participant/teacher are denied messaging even with profile caps (not eligible)", () => {
    const participant = staffCtx({
      role: "participant",
      isSuperAdmin: false,
      eligibility: { messaging: false },
      effective: { messaging: { view: 1, send: 2 } }, // profile caps but ineligible
    });
    const teacher = staffCtx({
      role: "teacher",
      isSuperAdmin: false,
      eligibility: { messaging: false },
      effective: { messaging: { view: 1, send: 2 } },
    });
    expect(authorize(participant, "messaging", "view")).toBe(false);
    expect(authorize(teacher, "messaging", "send")).toBe(false);
  });

  test("internal staff with messaging caps are allowed", () => {
    const staff = staffCtx({
      eligibility: { messaging: true },
      effective: { messaging: { view: 1, send: 2 } },
    });
    expect(authorize(staff, "messaging", "view")).toBe(true);
    expect(authorize(staff, "messaging", "send")).toBe(true);
  });
});

// ─── buildPermissionExplanation (explainability) ────────────────────────────

describe("buildPermissionExplanation (who has access + why)", () => {
  test("non-SA: eligibility verdict with identity sources + capability inputs", () => {
    const { buildPermissionExplanation } = require("@/lib/authorization");
    const ctx = {
      isSuperAdmin: false,
      eligibilityRows: [
        {
          feature_key: "finance",
          identity_type: "role",
          identity_value: "staff",
          eligible: 1,
        },
      ],
      baseCaps: { finance: { view: 1 } },
      groupCaps: { finance: { view: 3 } },
      grants: { finance: { export: 3 } },
    };
    const ex = buildPermissionExplanation(ctx);
    expect(ex.eligibility.finance).toEqual({
      eligible: true,
      sources: [{ identity_type: "role", identity_value: "staff", eligible: 1 }],
    });
    expect(ex.eligibility.crm.eligible).toBe(false); // no rows → not eligible
    expect(ex.sources.profile.finance.view).toBe(1);
    expect(ex.sources.groups.finance.view).toBe(3);
    expect(ex.sources.grants.finance.export).toBe(3);
  });

  test("SA: eligible everywhere by super_admin bypass", () => {
    const { buildPermissionExplanation } = require("@/lib/authorization");
    const ex = buildPermissionExplanation({
      isSuperAdmin: true,
      baseCaps: {},
      groupCaps: {},
      grants: {},
    });
    expect(ex.eligibility.finance).toEqual({
      eligible: true,
      source: "super_admin bypass",
    });
    expect(ex.eligibility.crm).toEqual({
      eligible: true,
      source: "super_admin bypass",
    });
  });

  test("null context → null", () => {
    const { buildPermissionExplanation } = require("@/lib/authorization");
    expect(buildPermissionExplanation(null)).toBeNull();
  });
});

// ─── requireAuthorization route helper ──────────────────────────────────────

describe("requireAuthorization", () => {
  test("returns 401 without a session", async () => {
    const res = await requireAuthorization("finance", "view");
    expect(res.status).toBe(401);
  });
});

// ─── Final eligibility policy (#3) — admin / participant / founder values ───
// Product Owner-approved final eligibility values:
//   - admin           → NOT eligible for internal_comms or reporting
//   - participant     → NOT eligible for crm
//   - founder         → NOT eligible for crm
// Verified against the production database by the read-only dry-run
// (scripts/dryrun-eligibility-policy.mjs): zero decision changes for every
// existing user (no admin-role users exist; participants/founders hold no
// contacts capabilities). These tests lock in the resolver behavior that the
// backfill (ensureFinalPolicyBackfill) and the updated seeds enforce.

describe("final eligibility policy (#3)", () => {
  test("admin is NOT eligible for internal_comms or reporting", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.internal_comms).not.toContain("admin");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.reporting).not.toContain("admin");
  });

  test("participant and founder are NOT crm-eligible", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.crm).not.toContain("participant");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.crm).not.toContain("founder");
  });

  test("admin with announcement caps is DENIED post-policy", () => {
    const admin = staffCtx({
      role: "admin",
      isSuperAdmin: false,
      eligibility: { internal_comms: false, reporting: false },
      effective: { internal_comms: { view: 1, create_announcements: 2, moderate: 3 } },
    });
    expect(authorize(admin, "internal_comms", "create_announcements")).toBe(false);
    expect(authorize(admin, "internal_comms", "moderate")).toBe(false);
    expect(authorize(admin, "internal_comms", "view")).toBe(false);
  });

  test("admin with reports caps is DENIED post-policy (submit + export routes)", () => {
    const admin = staffCtx({
      role: "admin",
      isSuperAdmin: false,
      eligibility: { internal_comms: false, reporting: false },
      effective: { reports: { view: 1, create: 2, export: 3 } },
    });
    expect(authorize(admin, "reports", "create")).toBe(false);
    expect(authorize(admin, "reports", "export")).toBe(false);
  });

  test("participant with a contacts grant is DENIED post-policy (eligibility boundary)", () => {
    const participant = staffCtx({
      role: "participant",
      isSuperAdmin: false,
      eligibility: { crm: false },
      effective: { contacts: { view: 5 } },
      grants: { contacts: { view: 5 } },
    });
    expect(authorize(participant, "contacts", "view")).toBe(false);
  });

  test("super_admin is unaffected by the policy (bypass preserved)", () => {
    expect(authorize(saCtx(), "internal_comms", "create_announcements")).toBe(true);
    expect(authorize(saCtx(), "reports", "export")).toBe(true);
    expect(authorize(saCtx(), "contacts", "view")).toBe(true);
  });

  test("ensureFinalPolicyBackfill deletes ONLY the four role rows (group rows sacred)", async () => {
    const dbMock = require("@/lib/db").default;
    const { ensureFinalPolicyBackfill } = require("@/lib/authorization/backfill");
    dbMock.execute.mockClear();
    await ensureFinalPolicyBackfill();
    const deletes = dbMock.execute.mock.calls
      .map((c) => (typeof c[0] === "string" ? c[0] : c[0]?.sql))
      .filter((sql) => sql && sql.includes("DELETE FROM feature_eligibility"));
    expect(deletes.length).toBeGreaterThan(0);
    const allSql = deletes.join("\n");
    for (const sql of deletes) {
      expect(sql).toMatch(/identity_type\s*=\s*'role'/);
    }
    expect(allSql).toMatch(/feature_key\s*=\s*'internal_comms'/);
    expect(allSql).toMatch(/feature_key\s*=\s*'reporting'/);
    expect(allSql).toMatch(/feature_key\s*=\s*'crm'/);
    expect(allSql).toMatch(/identity_value\s*=\s*'admin'/);
    expect(allSql).toMatch(/identity_value\s*IN\s*\(\s*'participant',\s*'founder'\s*\)/);
  });
});

// ─── Phase A — Permissions control center ───────────────────────────────────
// Dedicated configure_eligibility authority, one-time policy migrations, and
// eligibility change validation (the UI writes the same rows the resolver
// reads — the API only validates/normalizes them).

describe("permissions.configure_eligibility (Phase A)", () => {
  test("is part of the permissions module capability set", () => {
    const { PERMISSION_MODULES } = require("@/lib/auth");
    expect(PERMISSION_MODULES.permissions.capabilities).toContain(
      "configure_eligibility",
    );
  });

  test("SA may configure eligibility (bypass)", () => {
    expect(authorize(saCtx(), "permissions", "configure_eligibility")).toBe(
      true,
    );
  });

  test("holder of the capability may configure; others are denied", () => {
    const admin = staffCtx({
      role: "staff",
      eligibility: { user_management: true },
      effective: { permissions: { view_matrix: 1, configure_eligibility: 1 } },
    });
    const viewer = staffCtx({
      role: "staff",
      eligibility: { user_management: true },
      effective: { permissions: { view_matrix: 1 } }, // no configure cap
    });
    expect(authorize(admin, "permissions", "configure_eligibility")).toBe(
      true,
    );
    expect(authorize(viewer, "permissions", "configure_eligibility")).toBe(
      false,
    );
  });

  test("configure_eligibility is separate from assign_capabilities", () => {
    const ctx = staffCtx({
      role: "staff",
      eligibility: { user_management: true },
      effective: { permissions: { assign_capabilities: 2 } }, // different power
    });
    expect(authorize(ctx, "permissions", "configure_eligibility")).toBe(
      false,
    );
    expect(authorize(ctx, "permissions", "assign_capabilities")).toBe(true);
  });
});

describe("runAuthzMigration (one-time policy migrations)", () => {
  test("runs once per database, then never again", async () => {
    const dbMock = require("@/lib/db").default;
    const { runAuthzMigration } = require("@/lib/authorization");
    let markerPresent = false;
    dbMock.execute.mockImplementation(async ({ sql } = {}) => {
      const s = typeof sql === "string" ? sql : sql || "";
      if (s.includes("authz_migrations") && s.includes("SELECT")) {
        return { rows: markerPresent ? [{ name: "test-mig" }] : [] };
      }
      if (s.includes("INSERT INTO authz_migrations")) {
        markerPresent = true;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const fn1 = jest.fn(async () => {});
    const first = await runAuthzMigration("test-mig", fn1);
    expect(first.applied).toBe(true);
    expect(fn1).toHaveBeenCalledTimes(1);

    const fn2 = jest.fn(async () => {});
    const second = await runAuthzMigration("test-mig", fn2);
    expect(second.applied).toBe(false);
    expect(fn2).not.toHaveBeenCalled();

    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });

  test("does not record the migration when the work throws (retries next boot)", async () => {
    const dbMock = require("@/lib/db").default;
    const { runAuthzMigration } = require("@/lib/authorization");
    let markerPresent = false;
    dbMock.execute.mockImplementation(async ({ sql } = {}) => {
      const s = typeof sql === "string" ? sql : sql || "";
      if (s.includes("authz_migrations") && s.includes("SELECT")) {
        return { rows: markerPresent ? [{ name: "boom-mig" }] : [] };
      }
      if (s.includes("INSERT INTO authz_migrations")) {
        markerPresent = true;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const failing = jest.fn(async () => {
      throw new Error("boom");
    });
    await expect(runAuthzMigration("boom-mig", failing)).rejects.toThrow(
      "boom",
    );
    expect(markerPresent).toBe(false);

    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });
});

describe("validateEligibilityChanges (eligibility API)", () => {
  test("normalizes a valid batch (1, 0 and null → delete)", () => {
    const { validateEligibilityChanges } = require("@/lib/authorization");
    const r = validateEligibilityChanges([
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 1 },
      { feature_key: "crm", identity_type: "group", identity_value: "Future Studio", eligible: 0 },
      { feature_key: "messaging", identity_type: "role", identity_value: "member", eligible: null },
    ]);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.normalized).toEqual([
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 1 },
      { feature_key: "crm", identity_type: "group", identity_value: "Future Studio", eligible: 0 },
      { feature_key: "messaging", identity_type: "role", identity_value: "member", eligible: null },
    ]);
  });

  test("rejects unknown features, identity types, empty values and bad eligible values", () => {
    const { validateEligibilityChanges } = require("@/lib/authorization");
    const r = validateEligibilityChanges([
      { feature_key: "not_a_feature", identity_type: "role", identity_value: "staff", eligible: 1 },
      { feature_key: "finance", identity_type: "planet", identity_value: "staff", eligible: 1 },
      { feature_key: "finance", identity_type: "role", identity_value: "  ", eligible: 1 },
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 7 },
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: "yes" },
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBe(5);
    expect(r.normalized).toEqual([]);
  });

  test("rejects an empty batch", () => {
    const { validateEligibilityChanges } = require("@/lib/authorization");
    expect(validateEligibilityChanges([]).valid).toBe(false);
    expect(validateEligibilityChanges(null).valid).toBe(false);
    expect(validateEligibilityChanges(undefined).valid).toBe(false);
  });

  test("feature catalog covers every module-mapped and seeded feature", () => {
    const { FEATURE_KEYS } = require("@/lib/authorization");
    expect(FEATURE_KEYS).toEqual(
      expect.arrayContaining([
        "crm",
        "finance",
        "program_management",
        "reporting",
        "messaging",
        "internal_comms",
        "user_management",
        "system_settings",
      ]),
    );
  });
});
