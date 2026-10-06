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

jest.mock("@/server/authz/capabilities", () => {
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
  };
});
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn(async () => null) }));
jest.mock("@/models/authorization/bootstrap", () => ({ ensurePermissionsSchema: jest.fn(async () => {}) }));

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
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
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
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
    expect(MODULE_TO_FEATURE.reports).toBe("reports");
  });

  test("reports eligibility defaults cover the submit routes (admin/developer removed)", () => {
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
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
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
    expect(MODULE_TO_FEATURE.contacts).toBe("crm");
  });

  test("crm eligibility defaults are internal identities only (participant/founder removed by policy #3)", () => {
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
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
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
    expect(MODULE_TO_FEATURE.messaging).toBe("communication");
    expect(MODULE_TO_FEATURE.internal_comms).toBe("communication");
  });

  test("communication eligibility defaults cover the CRM-like allowlist (PO decision, no admin)", () => {
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
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

