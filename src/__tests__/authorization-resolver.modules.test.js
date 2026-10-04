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
} = require("@/services/authorization/context");
const {
  evaluateEligibility,
} = require("@/services/authorization/eligibility");
const { requireAuthorization } = require("@/models/authorization/index");

// ─── mergeEffectiveCapabilities: V2 semantics ───────────────────────────────


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


describe("projects module (Phase 6)", () => {
  test("MODULE_TO_FEATURE maps projects → operations", () => {
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
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
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
    expect(MODULE_TO_FEATURE.tasks).toBe("operations");
  });

  test("operations eligibility defaults cover the tasks allowlist incl. team", () => {
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
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
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
    expect(MODULE_TO_FEATURE.engineering).toBe("settings");
  });

  test("manage_developers is gone from the engineering catalog (developer role retired)", () => {
    const { CAPABILITY_CATALOG } = require("@/models/authorization/capability-catalog");
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
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
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
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
    expect(MODULE_TO_FEATURE.ventures).toBe("ventures");
  });

  test("ventures eligibility defaults cover the CRUD allowlist", () => {
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
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
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
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
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
    expect(MODULE_TO_FEATURE.investor).toBe("investors");
  });

  test("investor eligibility covers the uniform portal allowlist (no PM)", () => {
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
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
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
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
    const { buildPermissionExplanation } = require("@/models/authorization/index");
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
    const { buildPermissionExplanation } = require("@/models/authorization/index");
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
    const { buildPermissionExplanation } = require("@/models/authorization/index");
    expect(buildPermissionExplanation(null)).toBeNull();
  });
});

// ─── requireAuthorization route helper ──────────────────────────────────────

