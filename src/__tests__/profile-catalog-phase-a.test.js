/**
 * PHASE A — Profile catalogue (docs/ROADMAP_ROLES_PROFILES_ACCESS.md).
 *
 * Three surfaces, none of which the others can see:
 *   1. the PURE catalogue + the service validation (no database, no HTTP);
 *   2. the store's schema self-heal, insert-only seed and edit;
 *   3. the API contract (GET seeds + reads, PUT validates + audits, both gated).
 *
 * The route runs against the REAL store over a mocked database, so the SQL the
 * screen depends on is exercised, not stubbed away.
 */

const mockExecute = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "U-ADMIN", name: "Admin" })),
}));

jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn(async () => {}),
}));

jest.mock("@/lib/requestOrigin", () => ({
  requireSameOrigin: jest.fn(() => null),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
  invalidateAllAuthorizationContexts: jest.fn(),
}));

const {
  PROFILE_CATALOG,
  PROFILE_KEYS,
  PROFILE_CONTEXTS,
  PROFILE_BASELINE_ROLES,
  getProfileDefinition,
  isValidProfileKey,
} = require("@/models/authorization/profile-catalog");
const {
  PROFILE_ROLE_ENFORCEMENT,
  normalizeAllowedRoles,
  validateProfileUpdate,
} = require("@/services/authorization/profileCatalog");

const EXPECTED_KEYS = [
  "participant",
  "learner",
  "founder",
  "investor",
  "facilitator",
  "program_manager",
  "venture_manager",
];

/** SQL of a mock call, whether it was passed as a string or as { sql, args }. */
const sqlOf = (call) => {
  const first = call[0];
  return typeof first === "string" ? first : String(first?.sql || "");
};
const callsMatching = (pattern) =>
  mockExecute.mock.calls.filter((call) => pattern.test(sqlOf(call)));

beforeEach(() => {
  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [], rowsAffected: 1 });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 1. Pure catalogue + service ──────────────────────────────────────────────

describe("profile catalogue — the agreed seven", () => {
  test("lists exactly the seven profiles of the product brief", () => {
    expect(PROFILE_KEYS).toEqual(EXPECTED_KEYS);
    expect(PROFILE_CATALOG).toHaveLength(7);
  });

  test("every profile has a known context and a valid, non-empty role list", () => {
    for (const profile of PROFILE_CATALOG) {
      expect(PROFILE_CONTEXTS).toContain(profile.context);
      expect(profile.allowedRoles.length).toBeGreaterThan(0);
      for (const role of profile.allowedRoles) {
        expect(PROFILE_BASELINE_ROLES).toContain(role);
      }
    }
  });

  test("every profile carries an i18n label key", () => {
    for (const profile of PROFILE_CATALOG) {
      expect(profile.labelKey.startsWith("engineering.permissions.")).toBe(true);
    }
  });

  test("the program/venture managers are staff-restricted; the member profiles are member-restricted", () => {
    expect(getProfileDefinition("program_manager").allowedRoles).toEqual(["staff"]);
    expect(getProfileDefinition("venture_manager").allowedRoles).toEqual(["staff"]);
    expect(getProfileDefinition("participant").allowedRoles).toEqual(["member"]);
    expect(getProfileDefinition("founder").allowedRoles).toEqual(["member"]);
  });

  test("unknown keys are refused", () => {
    expect(getProfileDefinition("ghost")).toBeNull();
    expect(isValidProfileKey("ghost")).toBe(false);
    expect(isValidProfileKey("founder")).toBe(true);
  });
});

describe("validateProfileUpdate", () => {
  test("accepts a known key with known roles", () => {
    const result = validateProfileUpdate({
      key: "founder",
      allowed_roles: ["member", "staff"],
      is_active: true,
    });
    expect(result.valid).toBe(true);
    expect(result.normalized.allowed_roles).toEqual(["member", "staff"]);
  });

  test("refuses a malformed profile key (properties are dynamic now)", () => {
    const result = validateProfileUpdate({ key: "Not A Key!", allowed_roles: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("invalid profile key");
  });

  test("refuses an unknown role", () => {
    const result = validateProfileUpdate({ key: "founder", allowed_roles: ["wizard"] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown roles");
  });

  test("[] is a real state — explicitly nobody, not 'not configured'", () => {
    const result = validateProfileUpdate({ key: "founder", allowed_roles: [] });
    expect(result.valid).toBe(true);
    expect(result.normalized.allowed_roles).toEqual([]);
  });

  test("de-duplicates roles and defaults is_active to true", () => {
    const result = validateProfileUpdate({
      key: "founder",
      allowed_roles: ["member", "member"],
    });
    expect(result.normalized.allowed_roles).toEqual(["member"]);
    expect(result.normalized.is_active).toBe(true);
  });

  test("keeps an explicit false", () => {
    const result = validateProfileUpdate({ key: "founder", allowed_roles: [], is_active: false });
    expect(result.normalized.is_active).toBe(false);
  });
});

describe("normalizeAllowedRoles", () => {
  test("reads arrays, JSON strings and null alike", () => {
    expect(normalizeAllowedRoles(["member"])).toEqual(["member"]);
    expect(normalizeAllowedRoles('["member","staff"]')).toEqual(["member", "staff"]);
    expect(normalizeAllowedRoles(null)).toEqual([]);
    expect(normalizeAllowedRoles("not json")).toEqual([]);
  });
});

// ── 2. Store ─────────────────────────────────────────────────────────────────

describe("profiles store", () => {
  const loadStore = () => {
    jest.resetModules();
    return require("@/models/authorization/profilesStore");
  };

  test("creates its table once per process, idempotently", async () => {
    const { ensureProfilesSchema } = loadStore();
    await ensureProfilesSchema();
    await ensureProfilesSchema();
    const ddl = callsMatching(/CREATE TABLE IF NOT EXISTS profiles/i);
    expect(ddl).toHaveLength(1);
  });

  test("seeds the whole catalogue with ON CONFLICT DO NOTHING", async () => {
    const { seedProfiles } = loadStore();
    await seedProfiles();
    const inserts = callsMatching(/INSERT INTO profiles/i);
    expect(inserts).toHaveLength(PROFILE_CATALOG.length);
    expect(inserts.every((call) => /ON CONFLICT \(key\) DO NOTHING/i.test(sqlOf(call)))).toBe(true);
    const keys = inserts.map((call) => call[0].args[0]);
    expect(keys).toEqual(EXPECTED_KEYS);
  });

  test("updateProfile writes allowed_roles, is_active and notes — never key/context", async () => {
    const { updateProfile } = loadStore();
    await updateProfile({
      key: "founder",
      allowedRoles: ["member"],
      isActive: false,
      notes: "note",
    });
    const update = callsMatching(/UPDATE profiles/i)[0];
    const setClause = sqlOf(update).split(/WHERE/i)[0];
    expect(setClause).toContain("allowed_roles = ?");
    // key/context are identity columns — never in the SET clause.
    expect(setClause).not.toMatch(/\bkey\b/i);
    expect(setClause).not.toMatch(/\bcontext\b/i);
    expect(update[0].args).toEqual(['["member"]', 0, "note", "founder"]);
  });
});

// ── 3. Route contract ────────────────────────────────────────────────────────

describe("GET/PUT /api/engineering/permissions/profiles", () => {
  const loadRoute = () => {
    jest.resetModules();
    return require("@/app/api/engineering/permissions/profiles/route");
  };

  test("GET is gated on permissions.view_matrix and returns the catalogue", async () => {
    const route = loadRoute();
    const { requireAuthorization } = require("@/models/authorization/index");
    mockExecute.mockImplementation(async (arg) => {
      const sql = typeof arg === "string" ? arg : String(arg?.sql || "");
      if (/SELECT[\s\S]*FROM profiles/i.test(sql)) {
        return {
          rows: [
            {
              key: "founder",
              context: "venture",
              allowed_roles: '["member"]',
              is_active: 1,
              notes: "",
            },
          ],
        };
      }
      return { rows: [], rowsAffected: 1 };
    });

    const res = await route.GET({});
    const body = await res.json();

    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
    expect(body.success).toBe(true);
    expect(body.contexts).toEqual(PROFILE_CONTEXTS);
    // Phase B — the GET reports the profile ↔ role rule's current mode.
    expect(body.role_enforcement).toBe(PROFILE_ROLE_ENFORCEMENT);
    expect(body.profiles[0]).toMatchObject({
      key: "founder",
      context: "venture",
      label_key: "engineering.permissions.profileFounder",
      allowed_roles: ["member"],
      is_active: 1,
    });
  });

  test("PUT is gated on permissions.configure_eligibility, edits and audits", async () => {
    const route = loadRoute();
    const { requireAuthorization } = require("@/models/authorization/index");
    const { logPermissionAudit } = require("@/models/authorization/accessQueries");

    // The route now checks the profile EXISTS before editing it.
    mockExecute.mockImplementation(async (arg) => {
      const sql = typeof arg === "string" ? arg : String(arg?.sql || "");
      if (/FROM profiles WHERE key = \?/i.test(sql)) {
        return {
          rows: [
            { key: "founder", context: "venture", allowed_roles: '["member"]', is_active: 1, notes: "" },
          ],
        };
      }
      return { rows: [], rowsAffected: 1 };
    });

    const res = await route.PUT({
      json: async () => ({
        key: "founder",
        allowed_roles: ["member", "staff"],
        is_active: true,
        notes: "widened",
        reason: "pilot",
      }),
    });
    const body = await res.json();

    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "configure_eligibility");
    expect(body.success).toBe(true);
    expect(body.profile.allowed_roles).toEqual(["member", "staff"]);
    expect(callsMatching(/UPDATE profiles/i)).toHaveLength(1);
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "profile_updated", targetName: "founder" }),
    );
  });

  test("PUT refuses a malformed key before touching the database", async () => {
    const route = loadRoute();
    const res = await route.PUT({
      json: async () => ({ key: "Ghost Key", allowed_roles: ["member"] }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(callsMatching(/UPDATE profiles/i)).toHaveLength(0);
  });
});
