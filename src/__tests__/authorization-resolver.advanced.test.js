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


describe("requireAuthorization", () => {
  test("returns 401 without a session", async () => {
    const res = await requireAuthorization("finance", "view");
    expect(res.status).toBe(401);
  });
});

// ─── LMS module (Phase 12) — feature-gated after promotion ───────────────────

describe("lms module", () => {
  test("MODULE_TO_FEATURE maps lms → lms (feature-gated)", () => {
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
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
    const { getAuthorizationContext } = require("@/models/authorization/index");
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
    const { getAuthorizationContext, invalidateAuthorizationContext } = require("@/models/authorization/index");

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
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.lms).toContain("program_manager");
  });

  // The seed grants lms.view to the Program Manager profile, but seeds never
  // overwrite: a database seeded before the LMS promotion kept a PM profile
  // with no lms row, so every PM learning surface answered 403. The backfill
  // closes that gap for existing databases (missing rows only).
  test("ensureLmsViewBackfill grants lms.view to the Program Manager profile + role fallback", async () => {
    const dbMock = require("@/lib/db").default;
    const { ensureLmsViewBackfill } = require("@/models/authorization/backfill");
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
    const { ensureLmsViewBackfill } = require("@/models/authorization/backfill");
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
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.communication).not.toContain("admin");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.reports).not.toContain("admin");
  });

  test("participant and founder are NOT crm-eligible", () => {
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
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
    const { ensureFinalPolicyBackfill } = require("@/models/authorization/backfill");
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
    const { ensureRetiredRoleCleanup } = require("@/models/authorization/backfill");
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
    const { runAuthzMigration } = require("@/models/authorization/index");
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
    const { runAuthzMigration } = require("@/models/authorization/index");
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
    const { validateEligibilityChanges } = require("@/models/authorization/index");
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
    const { validateEligibilityChanges } = require("@/models/authorization/index");
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
    const { validateEligibilityChanges } = require("@/models/authorization/index");
    expect(validateEligibilityChanges([]).valid).toBe(false);
    expect(validateEligibilityChanges(null).valid).toBe(false);
    expect(validateEligibilityChanges(undefined).valid).toBe(false);
  });

  test("feature catalog covers every module-mapped and seeded feature", () => {
    const { FEATURE_KEYS } = require("@/models/authorization/index");
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
    const { validateCapabilitiesWithinEligibility } = require("@/models/authorization/index");
    const result = validateCapabilitiesWithinEligibility(
      { programs: { view: 1 }, contacts: { view: 1 } },
      { programs: true, crm: true },
    );
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("ineligible feature capabilities are rejected (template boundary)", () => {
    const { validateCapabilitiesWithinEligibility } = require("@/models/authorization/index");
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
    const { validateCapabilitiesWithinEligibility } = require("@/models/authorization/index");
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
    const { validateCapabilitiesWithinEligibility } = require("@/models/authorization/index");
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
    const {
  TEMPLATE_CEILING_ROWS,
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
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
    const { CAPABILITY_CATALOG } = require("@/models/authorization/capability-catalog");
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
  const { restrictionsToJson } = require("@/services/authorization/context");
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

