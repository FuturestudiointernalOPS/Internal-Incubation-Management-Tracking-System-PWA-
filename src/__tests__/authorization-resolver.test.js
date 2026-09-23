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
    contacts: { capabilities: ["view", "create", "edit", "delete"] },
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
      capabilities: ["view", "manage_tasks", "manage_errors"],
    },
    finance: { capabilities: ["view", "create", "edit", "delete", "export"] },
    settings: { capabilities: ["view", "edit"] },
    org_membership: { capabilities: ["view", "manage"] },
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
    lms: { capabilities: ["view", "create", "edit", "delete"] },
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
  test("MODULE_TO_FEATURE maps knowledge → knowledge", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.knowledge).toBe("knowledge");
  });

  test("eligible staff with knowledge capabilities is allowed", () => {
    const ctx = staffCtx({
      eligibility: { knowledge: true },
      effective: { knowledge: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    expect(authorize(ctx, "knowledge", "view")).toBe(true);
    expect(authorize(ctx, "knowledge", "create")).toBe(true);
    expect(authorize(ctx, "knowledge", "delete")).toBe(true);
  });

  test("ineligible user is denied even with knowledge capability", () => {
    const ctx = staffCtx({
      eligibility: { knowledge: false },
      effective: { knowledge: { view: 1 } },
    });
    expect(authorize(ctx, "knowledge", "view")).toBe(false);
  });
});

// ─── reports module (Phase 3 migration) ─────────────────────────────────────

describe("reports module (Phase 3)", () => {
  test("MODULE_TO_FEATURE maps reports → reports", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.reports).toBe("reports");
  });

  test("reports eligibility defaults cover the submit routes (admin/developer removed)", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    const reports = FEATURE_ELIGIBILITY_DEFAULTS.reports;
    expect(reports).toEqual(
      expect.arrayContaining(["super_admin", "staff", "program_manager"]),
    );
    expect(reports).not.toContain("admin");
    expect(reports).not.toContain("developer");
  });

  test("a role with reports.create is allowed on the submit routes (export is not implied)", () => {
    const ctx = staffCtx({
      isSuperAdmin: false,
      eligibility: { reports: true },
      effective: { reports: { view: 1, create: 2 } },
    });
    expect(authorize(ctx, "reports", "create")).toBe(true);
    expect(authorize(ctx, "reports", "export")).toBe(false);
  });

  test("a grant of reports.export alone allows run-export only", () => {
    const ctx = staffCtx({
      role: "facilitator",
      isSuperAdmin: false,
      eligibility: { reports: true },
      effective: { reports: { view: 1, export: 3 } },
    });
    expect(authorize(ctx, "reports", "export")).toBe(true);
    expect(authorize(ctx, "reports", "create")).toBe(false); // export must NOT imply submit
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
      expect.arrayContaining(["super_admin", "staff", "program_manager"]),
    );
    expect(FEATURE_ELIGIBILITY_DEFAULTS.crm).not.toContain("participant");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.crm).not.toContain("founder");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.crm).not.toContain("developer");
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

// ─── communication feature (Messages + Announcements modules) ───────────────

// Both the messaging module (Messages) and the internal_comms module
// (Announcements) are consolidated under the single `communication` feature —
// mirroring how contacts lives under `crm`.

describe("communication feature (Messages + Announcements)", () => {
  test("MODULE_TO_FEATURE maps messaging + internal_comms → communication", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.messaging).toBe("communication");
    expect(MODULE_TO_FEATURE.internal_comms).toBe("communication");
  });

  test("communication eligibility defaults cover the CRM-like allowlist (PO decision, no admin)", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    // participant / mentor / investor are listed because their OWN seeded
    // default templates (Participant Default, Mentor) carry messaging caps. A
    // role must be eligible for every feature its default template grants —
    // otherwise the ceiling check rejects the whole template and it can never
    // be saved (the bug that made Staff Default unsavable).
    expect(FEATURE_ELIGIBILITY_DEFAULTS.communication).toEqual([
      "super_admin",
      "staff",
      "program_manager",
      "participant",
      "mentor",
      "investor",
    ]);
    expect(FEATURE_ELIGIBILITY_DEFAULTS.communication).not.toContain("admin");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.communication).not.toContain("developer");
    // The legacy messaging/internal_comms feature keys are gone.
    expect(FEATURE_ELIGIBILITY_DEFAULTS.messaging).toBeUndefined();
    expect(FEATURE_ELIGIBILITY_DEFAULTS.internal_comms).toBeUndefined();
  });

  test("staff with announcement caps can post; an eligible role without caps cannot", () => {
    const staff = staffCtx({
      eligibility: { communication: true },
      effective: { internal_comms: { view: 1, create_announcements: 2, moderate: 3 } },
    });
    const facilitator = staffCtx({
      role: "facilitator",
      isSuperAdmin: false,
      eligibility: { communication: true },
      effective: { internal_comms: { view: 1 } }, // eligible but no announcement caps
    });
    expect(authorize(staff, "internal_comms", "create_announcements")).toBe(true);
    expect(authorize(staff, "internal_comms", "moderate")).toBe(true);
    expect(authorize(facilitator, "internal_comms", "create_announcements")).toBe(false);
  });
});

// ─── projects module (Phase 6 migration) ────────────────────────────────────

describe("projects module (Phase 6)", () => {
  test("MODULE_TO_FEATURE maps projects → operations", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.projects).toBe("operations");
  });

  test("a grantee with projects.delete can delete; without it cannot", () => {
    const withDelete = staffCtx({
      eligibility: { operations: true },
      effective: { projects: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    const withoutDelete = staffCtx({
      eligibility: { operations: true },
      effective: { projects: { view: 1, create: 2, edit: 3 } }, // no delete backfill
    });
    expect(authorize(withDelete, "projects", "delete")).toBe(true);
    expect(authorize(withDelete, "projects", "create")).toBe(true);
    expect(authorize(withoutDelete, "projects", "delete")).toBe(false);
    expect(authorize(withoutDelete, "projects", "create")).toBe(true); // POST allowlist ✓
  });

  test("program_manager with backfilled create/edit/delete is allowed (projects writes)", () => {
    const pm = staffCtx({
      role: "program_manager",
      isSuperAdmin: false,
      eligibility: { operations: true },
      effective: { projects: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    expect(authorize(pm, "projects", "create")).toBe(true);
    expect(authorize(pm, "projects", "edit")).toBe(true);
    expect(authorize(pm, "projects", "delete")).toBe(true);
  });

  test("admin is NOT eligible for operations even with Staff Default caps", () => {
    const admin = staffCtx({
      role: "admin",
      isSuperAdmin: false,
      eligibility: { operations: false },
      effective: { projects: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    expect(authorize(admin, "projects", "delete")).toBe(false);
  });
});

// ─── tasks module (Phase 7 migration) ───────────────────────────────────────

describe("tasks module (Phase 7)", () => {
  test("MODULE_TO_FEATURE maps tasks → operations", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.tasks).toBe("operations");
  });

  test("operations eligibility defaults cover the tasks allowlist incl. team", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.operations).toEqual(
      expect.arrayContaining(["super_admin", "staff", "program_manager", "team"]),
    );
  });

  test("team member with tasks capabilities is allowed on the board", () => {
    const teamUser = staffCtx({
      role: "team",
      isSuperAdmin: false,
      eligibility: { operations: true },
      effective: { tasks: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    expect(authorize(teamUser, "tasks", "view")).toBe(true);
    expect(authorize(teamUser, "tasks", "delete")).toBe(true);
  });

  test("admin inherits Staff Default tasks caps but is NOT eligible → denied", () => {
    const admin = staffCtx({
      role: "admin",
      isSuperAdmin: false,
      eligibility: { operations: false },
      effective: { tasks: { view: 1, create: 2, edit: 3, delete: 4 } },
    });
    expect(authorize(admin, "tasks", "view")).toBe(false);
  });
});

// ─── engineering module (Phase 8 migration + errors gap) ────────────────────

describe("engineering module (Phase 8)", () => {
  test("MODULE_TO_FEATURE maps engineering → settings", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.engineering).toBe("settings");
  });

  test("manage_developers is gone from the engineering catalog (developer role retired)", () => {
    const { CAPABILITY_CATALOG } = require("@/lib/authorization/capability-catalog");
    expect(CAPABILITY_CATALOG.engineering.capabilities.manage_developers).toBeUndefined();
  });

  test("intern (profile caps but NOT eligible) is denied — no SA-surface gain", () => {
    const intern = staffCtx({
      role: "intern",
      isSuperAdmin: false,
      eligibility: { settings: false },
      effective: { engineering: { view: 1, manage_tasks: 1 } },
    });
    expect(authorize(intern, "engineering", "view")).toBe(false);
    expect(authorize(intern, "engineering", "manage_errors")).toBe(false);
  });

  test("errors log access requires manage_errors — anonymous has none", () => {
    const ctx = staffCtx({
      role: "staff",
      isSuperAdmin: false,
      eligibility: { settings: false },
      effective: {},
    });
    expect(authorize(ctx, "engineering", "manage_errors")).toBe(false);
  });
});

// ─── programs module (Phase 9 migration) ────────────────────────────────────

describe("programs module (Phase 9)", () => {
  test("MODULE_TO_FEATURE maps programs → programs", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.programs).toBe("programs");
  });

  test("staff with backfilled programs.edit are allowed (bypass replaced)", () => {
    const staff = staffCtx({
      eligibility: { programs: true },
      effective: { programs: { view: 1, edit: 3 } },
    });
    expect(authorize(staff, "programs", "edit")).toBe(true);
  });

  test("staff WITHOUT backfilled delete is denied on program deletion (SA-only preserved)", () => {
    const staff = staffCtx({
      eligibility: { programs: true },
      effective: { programs: { view: 1, edit: 3 } }, // no delete backfill
    });
    expect(authorize(staff, "programs", "delete")).toBe(false);
    const pm = staffCtx({
      role: "program_manager",
      isSuperAdmin: false,
      eligibility: { programs: true },
      effective: { programs: { view: 1, create: 2, edit: 3, publish: 4 } }, // PM profile has no delete
    });
    expect(authorize(pm, "programs", "delete")).toBe(false);
  });

  test("admin is NOT eligible for programs even with Staff Default caps", () => {
    const admin = staffCtx({
      role: "admin",
      isSuperAdmin: false,
      eligibility: { programs: false },
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

  // Phase 6: a venture founder is a BASELINE MEMBER with a venture context, so
  // the feature must be eligible for that baseline — otherwise the capability
  // the Context Roles mapping grants is dead on arrival (eligibility is checked
  // first and fails closed). Eligibility stays a CEILING: the capability and
  // the venture scope still decide.
  test("member is eligible for ventures, and eligibility remains a ceiling", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.ventures).toContain("member");

    const memberWithGrant = staffCtx({
      role: "member",
      eligibility: { ventures: true },
      effective: { ventures: { view: 1 } },
    });
    // eligibility + capability → authorized (scope is enforced separately)
    expect(authorize(memberWithGrant, "ventures", "view")).toBe(true);
    // eligible but no capability → denied
    expect(authorize({ ...memberWithGrant, effective: {} }, "ventures", "view")).toBe(false);
    // capability but not eligible → denied
    expect(
      authorize({ ...memberWithGrant, eligibility: { ventures: false } }, "ventures", "view"),
    ).toBe(false);
    // view never implies edit
    expect(authorize(memberWithGrant, "ventures", "edit")).toBe(false);
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
  test("MODULE_TO_FEATURE maps investor → investors", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.investor).toBe("investors");
  });

  test("investor eligibility covers the uniform portal allowlist (no PM)", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.investors).toEqual(
      expect.arrayContaining(["super_admin", "staff", "investor"]),
    );
    expect(FEATURE_ELIGIBILITY_DEFAULTS.investors).not.toContain("program_manager");
  });

  test("investor with backfilled caps is allowed; mentor (same profile) is NOT eligible", () => {
    const investor = staffCtx({
      role: "investor",
      isSuperAdmin: false,
      eligibility: { investors: true },
      effective: { investor: { view: 1, create: 2, edit: 3 } },
    });
    const mentor = staffCtx({
      role: "mentor",
      isSuperAdmin: false,
      eligibility: { investors: false },
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
      eligibility: { investors: false },
      effective: { investor: { view: 1 } },
    });
    expect(authorize(pm, "investor", "view")).toBe(false);
  });
});

// ─── messaging module (consolidated under the communication feature) ────────

describe("messaging module (communication feature)", () => {
  test("messaging eligibility now rides the communication feature (internal roles per PO)", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.communication).toEqual([
      "super_admin",
      "staff",
      "program_manager",
      "participant",
      "mentor",
      "investor",
    ]);
  });

  test("participant/facilitator are denied messaging when not eligible despite profile caps", () => {
    const participant = staffCtx({
      role: "participant",
      isSuperAdmin: false,
      eligibility: { communication: false },
      effective: { messaging: { view: 1, send: 2 } }, // profile caps but ineligible
    });
    const facilitator = staffCtx({
      role: "facilitator",
      isSuperAdmin: false,
      eligibility: { communication: false },
      effective: { messaging: { view: 1, send: 2 } },
    });
    expect(authorize(participant, "messaging", "view")).toBe(false);
    expect(authorize(facilitator, "messaging", "send")).toBe(false);
  });

  test("internal staff with messaging caps are allowed", () => {
    const staff = staffCtx({
      eligibility: { communication: true },
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
    const explanation = buildPermissionExplanation(ctx);
    expect(explanation.eligibility.finance).toEqual({
      eligible: true,
      sources: [{ identity_type: "role", identity_value: "staff", eligible: 1 }],
    });
    expect(explanation.eligibility.crm.eligible).toBe(false); // no rows → not eligible
    expect(explanation.sources.profile.finance.view).toBe(1);
    expect(explanation.sources.groups.finance.view).toBe(3);
    expect(explanation.sources.grants.finance.export).toBe(3);
  });

  test("SA: eligible everywhere by super_admin bypass", () => {
    const { buildPermissionExplanation } = require("@/lib/authorization");
    const explanation = buildPermissionExplanation({
      isSuperAdmin: true,
      baseCaps: {},
      groupCaps: {},
      grants: {},
    });
    expect(explanation.eligibility.finance).toEqual({
      eligible: true,
      source: "super_admin bypass",
    });
    expect(explanation.eligibility.crm).toEqual({
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

// ─── LMS module (Phase 12) — feature-gated after promotion ───────────────────

describe("lms module", () => {
  test("MODULE_TO_FEATURE maps lms → lms (feature-gated)", () => {
    const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");
    expect(MODULE_TO_FEATURE.lms).toBe("lms");
  });

  test("delegated staff with lms.create is allowed when eligible", () => {
    const ctx = staffCtx({
      eligibility: { lms: true },
      effective: { lms: { view: 1, create: 2 } },
    });
    expect(authorize(ctx, "lms", "create")).toBe(true);
    expect(authorize(ctx, "lms", "enroll")).toBe(false);
  });

  test("staff without lms capabilities is denied (no default grant)", () => {
    const ctx = staffCtx({ eligibility: { lms: true }, effective: { programs: { view: 1 } } });
    expect(authorize(ctx, "lms", "view")).toBe(false);
  });

  test("ineligible user is denied even with lms capability", () => {
    const ctx = staffCtx({ eligibility: {}, effective: { lms: { view: 1 } } });
    expect(authorize(ctx, "lms", "view")).toBe(false);
  });

  test("super admin is allowed without explicit lms rows (matrix bypass)", () => {
    expect(authorize(saCtx(), "lms", "create")).toBe(true);
    expect(authorize(saCtx(), "lms", "publish")).toBe(true);
  });

  test("super admin with an explicit lms restriction is denied", () => {
    const ctx = saCtx({ restrictions: { lms: new Set(["publish"]) } });
    expect(authorize(ctx, "lms", "publish")).toBe(false);
    expect(authorize(ctx, "lms", "view")).toBe(true); // unrelated cap unaffected
  });

  test("missing capability → denied (fail closed)", () => {
    const ctx = staffCtx({ eligibility: { lms: true }, effective: {} });
    expect(authorize(ctx, "lms", "enroll")).toBe(false);
  });

  // A page load issues several authorized requests at once; on a cold cache they
  // all miss and would each run the same resolution queries in parallel.
  test("concurrent readers of one user share ONE resolution", async () => {
    const dbMock = require("@/lib/db").default;
    const { getAuthorizationContext } = require("@/lib/authorization");
    dbMock.execute.mockClear();

    const user = { cid: "USER_SHARED_CONTEXT", role: "staff" };
    const [firstContext, secondContext, thirdContext] = await Promise.all([
      getAuthorizationContext(user),
      getAuthorizationContext(user),
      getAuthorizationContext(user),
    ]);

    expect(firstContext).toBe(secondContext);
    expect(secondContext).toBe(thirdContext);
    const restrictionReads = dbMock.execute.mock.calls.filter((call) =>
      /SELECT module, capability FROM user_capability_restrictions\s+WHERE user_cid/i.test(
        typeof call[0] === "string" ? call[0] : call[0]?.sql || "",
      ),
    );
    expect(restrictionReads).toHaveLength(1);
  });

  test("a context is reused from the cache, and invalidated on demand", async () => {
    const dbMock = require("@/lib/db").default;
    const { getAuthorizationContext, invalidateAuthorizationContext } = require("@/lib/authorization");

    const user = { cid: "USER_CACHED_CONTEXT", role: "staff" };
    const cachedContext = await getAuthorizationContext(user);

    dbMock.execute.mockClear();
    expect(await getAuthorizationContext(user)).toBe(cachedContext);
    expect(dbMock.execute).not.toHaveBeenCalled();

    // A permission write for that user must not keep serving the old answer.
    invalidateAuthorizationContext(user.cid);
    dbMock.execute.mockClear();
    await getAuthorizationContext(user);
    expect(dbMock.execute).toHaveBeenCalled();
  });

  test("program_manager is eligible for the lms feature (PM surface is reachable)", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.lms).toContain("program_manager");
  });

  // The seed grants lms.view to the Program Manager profile, but seeds never
  // overwrite: a database seeded before the LMS promotion kept a PM profile
  // with no lms row, so every PM learning surface answered 403. The backfill
  // closes that gap for existing databases (missing rows only).
  test("ensureLmsViewBackfill grants lms.view to the Program Manager profile + role fallback", async () => {
    const dbMock = require("@/lib/db").default;
    const { ensureLmsViewBackfill } = require("@/lib/authorization/backfill");
    dbMock.execute.mockClear();
    dbMock.execute.mockImplementation(async (query = {}) => {
      const sql = typeof query === "string" ? query : query.sql || "";
      if (sql.includes("FROM access_profiles")) return { rows: [{ id: 5 }] };
      return { rows: [] };
    });

    await ensureLmsViewBackfill();

    const calls = dbMock.execute.mock.calls.map((call) =>
      typeof call[0] === "string" ? { sql: call[0], args: [] } : call[0],
    );
    const profileInserts = calls.filter((call) =>
      call.sql.includes("INSERT INTO access_profile_capabilities"),
    );
    expect(profileInserts).toHaveLength(1);
    expect(profileInserts[0].args).toEqual([5, "lms", "view", 1]);
    expect(profileInserts[0].sql).toMatch(
      /ON CONFLICT \(profile_id, module, capability\) DO NOTHING/,
    );

    const roleInserts = calls.filter((call) => call.sql.includes("INSERT INTO role_capabilities"));
    expect(roleInserts).toHaveLength(1);
    expect(roleInserts[0].args).toEqual(["program_manager", "lms", "view", 1]);

    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });

  test("ensureLmsViewBackfill never grants a write capability", async () => {
    const dbMock = require("@/lib/db").default;
    const { ensureLmsViewBackfill } = require("@/lib/authorization/backfill");
    dbMock.execute.mockClear();
    dbMock.execute.mockImplementation(async (query = {}) => {
      const sql = typeof query === "string" ? query : query.sql || "";
      if (sql.includes("FROM access_profiles")) return { rows: [{ id: 5 }] };
      return { rows: [] };
    });

    await ensureLmsViewBackfill();

    const granted = dbMock.execute.mock.calls
      .map((call) => (typeof call[0] === "string" ? [] : call[0].args))
      .filter((args) => Array.isArray(args) && args.includes("lms"))
      .map((args) => args[args.indexOf("lms") + 1]);
    expect(granted.length).toBeGreaterThan(0);
    for (const capability of granted) expect(capability).toBe("view");

    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
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
  test("admin is NOT eligible for communication (internal_comms legacy) or reports", () => {
    const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.communication).not.toContain("admin");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.reports).not.toContain("admin");
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
      eligibility: { communication: false, reports: false },
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
      eligibility: { communication: false, reports: false },
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

  test("ensureFinalPolicyBackfill deletes ONLY the retired role rows (group rows sacred)", async () => {
    const dbMock = require("@/lib/db").default;
    const { ensureFinalPolicyBackfill } = require("@/lib/authorization/backfill");
    dbMock.execute.mockClear();
    await ensureFinalPolicyBackfill();
    const deletes = dbMock.execute.mock.calls
      .map((call) => (typeof call[0] === "string" ? call[0] : call[0]?.sql))
      .filter((sql) => sql && sql.includes("DELETE FROM feature_eligibility"));
    expect(deletes.length).toBeGreaterThan(0);
    const allSql = deletes.join("\n");
    for (const sql of deletes) {
      expect(sql).toMatch(/identity_type\s*=\s*'role'/);
    }
    expect(allSql).toMatch(/feature_key\s*=\s*'crm'/);
    expect(allSql).toMatch(/identity_value\s*IN\s*\(\s*'participant',\s*'founder'\s*\)/);
  });
});

// ─── Retired roles cleanup (developer / admin) ────────────────
// The one-time `retire-developer-admin-roles-v1` migration removes every row
// keyed by the retired roles or their templates. These tests pin the SQL it
// issues so a future seed cannot quietly re-introduce the vocabulary.

describe("retired roles cleanup (developer / admin)", () => {
  test("removes the retired templates, roles and manage_developers grants", async () => {
    const dbMock = require("@/lib/db").default;
    const { ensureRetiredRoleCleanup } = require("@/lib/authorization/backfill");
    dbMock.execute.mockClear();
    dbMock.execute.mockImplementation(async () => ({ rows: [] }));

    await ensureRetiredRoleCleanup();

    const allSql = dbMock.execute.mock.calls
      .map((call) => (typeof call[0] === "string" ? call[0] : call[0]?.sql))
      .filter(Boolean)
      .join("\n");

    // Templates: per-user assignments cleared FIRST, then caps + profiles.
    expect(allSql).toMatch(/UPDATE contacts SET access_profile_id = NULL/);
    expect(allSql).toMatch(/DELETE FROM access_profile_capabilities/);
    expect(allSql).toMatch(
      /DELETE FROM access_profiles WHERE name IN \('Developer', 'Developer Intern'\)/,
    );

    // Retired role rows (role-keyed only — group eligibility is sacred).
    expect(allSql).toMatch(/DELETE FROM role_access_profile_defaults/);
    expect(allSql).toMatch(
      /DELETE FROM role_capabilities WHERE role IN \('developer', 'admin'\)/,
    );
    expect(allSql).toMatch(
      /DELETE FROM feature_eligibility[\s\S]*?identity_type = 'role'[\s\S]*?'developer', 'admin'/,
    );

    // The retired capability, stripped from every capability table.
    for (const table of [
      "role_capabilities",
      "group_capabilities",
      "user_capabilities",
      "user_capability_restrictions",
      "access_profile_capabilities",
      "responsibility_capability_grants",
    ]) {
      expect(allSql).toMatch(
        new RegExp(
          `DELETE FROM ${table} WHERE module = 'engineering' AND capability = 'manage_developers'`,
        ),
      );
    }
  });

  test("is registered as a one-time authz migration", () => {
    const src = require("fs").readFileSync(
      require("path").join(process.cwd(), "src/models/authorization/backfill.js"),
      "utf8",
    );
    expect(src).toMatch(
      /"retire-developer-admin-roles-v1"[\s\S]*?ensureRetiredRoleCleanup/,
    );
  });
});

// ─── Phase A — Permissions control center ───────────────────────────────
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
      eligibility: { security: true },
      effective: { permissions: { view_matrix: 1, configure_eligibility: 1 } },
    });
    const viewer = staffCtx({
      role: "staff",
      eligibility: { security: true },
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
      eligibility: { security: true },
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
      const statement = typeof sql === "string" ? sql : sql || "";
      if (statement.includes("authz_migrations") && statement.includes("SELECT")) {
        return { rows: markerPresent ? [{ name: "test-mig" }] : [] };
      }
      if (statement.includes("INSERT INTO authz_migrations")) {
        markerPresent = true;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const firstMigration = jest.fn(async () => {});
    const firstResult = await runAuthzMigration("test-mig", firstMigration);
    expect(firstResult.applied).toBe(true);
    expect(firstMigration).toHaveBeenCalledTimes(1);

    const secondMigration = jest.fn(async () => {});
    const secondResult = await runAuthzMigration("test-mig", secondMigration);
    expect(secondResult.applied).toBe(false);
    expect(secondMigration).not.toHaveBeenCalled();

    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });

  test("does not record the migration when the work throws (retries next boot)", async () => {
    const dbMock = require("@/lib/db").default;
    const { runAuthzMigration } = require("@/lib/authorization");
    let markerPresent = false;
    dbMock.execute.mockImplementation(async ({ sql } = {}) => {
      const statement = typeof sql === "string" ? sql : sql || "";
      if (statement.includes("authz_migrations") && statement.includes("SELECT")) {
        return { rows: markerPresent ? [{ name: "boom-mig" }] : [] };
      }
      if (statement.includes("INSERT INTO authz_migrations")) {
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
    const result = validateEligibilityChanges([
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 1 },
      { feature_key: "crm", identity_type: "group", identity_value: "Future Studio", eligible: 0 },
      { feature_key: "communication", identity_type: "role", identity_value: "member", eligible: null },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.normalized).toEqual([
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 1 },
      { feature_key: "crm", identity_type: "group", identity_value: "Future Studio", eligible: 0 },
      { feature_key: "communication", identity_type: "role", identity_value: "member", eligible: null },
    ]);
  });

  test("rejects unknown features, identity types, empty values and bad eligible values", () => {
    const { validateEligibilityChanges } = require("@/lib/authorization");
    const result = validateEligibilityChanges([
      { feature_key: "not_a_feature", identity_type: "role", identity_value: "staff", eligible: 1 },
      { feature_key: "finance", identity_type: "planet", identity_value: "staff", eligible: 1 },
      { feature_key: "finance", identity_type: "role", identity_value: "  ", eligible: 1 },
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 7 },
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: "yes" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(5);
    expect(result.normalized).toEqual([]);
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
        "communication",
        "finance",
        "programs",
        "reports",
        "security",
        "settings",
      ]),
    );
  });

  test("capabilities within eligibility are valid (Phase 2)", () => {
    const { validateCapabilitiesWithinEligibility } = require("@/lib/authorization");
    const result = validateCapabilitiesWithinEligibility(
      { programs: { view: 1 }, contacts: { view: 1 } },
      { programs: true, crm: true },
    );
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("ineligible feature capabilities are rejected (template boundary)", () => {
    const { validateCapabilitiesWithinEligibility } = require("@/lib/authorization");
    const result = validateCapabilitiesWithinEligibility(
      { programs: { view: 1 }, finance: { view: 1 } },
      { programs: true, finance: false },
    );
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([
      { module: "finance", capability: "view", feature: "finance" },
    ]);
  });

  test("unset eligibility (missing = fail closed) rejects template caps", () => {
    const { validateCapabilitiesWithinEligibility } = require("@/lib/authorization");
    const result = validateCapabilitiesWithinEligibility(
      { finance: { view: 1 } },
      { programs: true }, // finance row missing entirely
    );
    expect(result.valid).toBe(false);
    expect(result.violations[0]).toEqual({
      module: "finance",
      capability: "view",
      feature: "finance",
    });
  });

  test("infra modules without a feature mapping are not eligibility-bound", () => {
    const { validateCapabilitiesWithinEligibility } = require("@/lib/authorization");
    const result = validateCapabilitiesWithinEligibility(
      { org_membership: { manage: 2 } },
      {},
    );
    expect(result.valid).toBe(true);
  });

  test("the template-ceiling catch-up mirrors the canonical defaults (no drift)", () => {
    // The catch-up exists for databases whose eligibility bootstrap ran BEFORE
    // the seeded default templates were reconciled with their roles' ceilings.
    // It must add exactly what a fresh database gets from the defaults — a
    // divergence would make the two populations behave differently.
    const { TEMPLATE_CEILING_ROWS, FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
    const rows = Object.entries(TEMPLATE_CEILING_ROWS);
    expect(rows.length).toBeGreaterThan(0);
    for (const [featureKey, roles] of rows) {
      expect(FEATURE_ELIGIBILITY_DEFAULTS[featureKey]).toBeDefined();
      for (const role of roles) {
        expect(FEATURE_ELIGIBILITY_DEFAULTS[featureKey]).toContain(role);
      }
    }
  });

  test("capability catalog exposes labels and risk for every module", () => {
    const { CAPABILITY_CATALOG } = require("@/lib/authorization/capability-catalog");
    const { PERMISSION_MODULES } = require("@/lib/auth");
    for (const [mod, def] of Object.entries(PERMISSION_MODULES)) {
      expect(CAPABILITY_CATALOG[mod]).toBeDefined();
      for (const cap of def.capabilities) {
        expect(CAPABILITY_CATALOG[mod].capabilities[cap]).toBeDefined();
      }
    }
  });
});

describe("org_membership capability (Phase 1 — protected groups)", () => {
  test("is part of the module set; SA bypasses", () => {
    const { PERMISSION_MODULES } = require("@/lib/auth");
    expect(PERMISSION_MODULES.org_membership.capabilities).toEqual([
      "view",
      "manage",
    ]);
    expect(authorize(saCtx(), "org_membership", "manage")).toBe(true);
    expect(authorize(saCtx(), "org_membership", "view")).toBe(true);
  });

  test("holders may manage membership; assign_capabilities does NOT imply it", () => {
    const manager = staffCtx({
      role: "staff",
      eligibility: {},
      effective: { org_membership: { view: 1, manage: 2 } },
    });
    const capAssigner = staffCtx({
      role: "staff",
      eligibility: {},
      effective: { permissions: { assign_capabilities: 2 } }, // different power
    });
    expect(authorize(manager, "org_membership", "manage")).toBe(true);
    expect(authorize(manager, "org_membership", "view")).toBe(true);
    expect(authorize(capAssigner, "org_membership", "manage")).toBe(false);
    expect(authorize(capAssigner, "org_membership", "view")).toBe(false);
  });
});

/**
 * Restrictions must survive the server → client wire: the People matrix reads
 * `sources.restrictions` from the user-context JSON, and a raw Set serializes
 * to `{}` (which silently turned every restriction into "allowed").
 */
describe("restrictionsToJson (server → client wire format)", () => {
  const { restrictionsToJson } = require("@/lib/authorization/resolver");
  const { deriveUserCapState } = require("@/components/permissions/matrixHelpers");

  test("projects Set-based restrictions into the JSON object shape", () => {
    expect(
      restrictionsToJson({ finance: new Set(["view", "create"]) }),
    ).toEqual({ finance: { view: true, create: true } });
  });

  test("a restriction survives JSON.stringify → JSON.parse (the wire)", () => {
    const wire = JSON.parse(
      JSON.stringify(restrictionsToJson({ finance: new Set(["view"]) })),
    );
    expect(wire).toEqual({ finance: { view: true } });
  });

  test("empty and null maps project to {}", () => {
    expect(restrictionsToJson({})).toEqual({});
    expect(restrictionsToJson(null)).toEqual({});
  });

  test("the People helper reads the projected restriction (DENIED, not allowed)", () => {
    const state = deriveUserCapState(
      {
        profile: { finance: { view: 1 } },
        groups: {},
        grants: {},
        restrictions: JSON.parse(
          JSON.stringify(restrictionsToJson({ finance: new Set(["view"]) })),
        ),
      },
      "finance",
      "view",
    );
    expect(state.restricted).toBe(true);
    expect(state.effective).toBe(false);
  });
});

describe("one-time migration batch (resilience)", () => {
  test("a failing migration does not reject the batch, and is not retried per call", async () => {
    jest.resetModules();
    const dbMock = require("@/lib/db").default;
    let executions = 0;
    dbMock.execute.mockImplementation(async ({ sql } = {}) => {
      executions += 1;
      // The shape of the real failure: one backfill reads a column the database
      // does not have. Before, this rejected the whole batch, which the
      // authorization gate awaits - so one missing column returned 500 from
      // every gated endpoint, and re-ran on every request.
      if (String(sql || "").includes("v2_program_staff")) {
        throw new Error('column "access_profile_id" does not exist');
      }
      return { rows: [] };
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { ensureCapabilityBackfills } = require("@/models/authorization/backfill");

    await expect(ensureCapabilityBackfills()).resolves.toBeUndefined();
    // Reported, not hidden.
    expect(errorSpy).toHaveBeenCalled();

    // Attempted once per process: a second call must not re-run the batch.
    const before = executions;
    await ensureCapabilityBackfills();
    expect(executions).toBe(before);

    errorSpy.mockRestore();
    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });
});
