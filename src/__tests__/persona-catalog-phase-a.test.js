/**
 * PHASE A — Persona catalogue (docs/ROADMAP_ROLES_PERSONAS_ACCESS.md).
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
}));

const {
  PERSONA_CATALOG,
  PERSONA_KEYS,
  PERSONA_CONTEXTS,
  PERSONA_BASELINE_ROLES,
  getPersonaDefinition,
  isValidPersonaKey,
} = require("@/models/authorization/persona-catalog");
const {
  normalizeAllowedRoles,
  validatePersonaUpdate,
} = require("@/services/authorization/personaCatalog");

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

describe("persona catalogue — the agreed seven", () => {
  test("lists exactly the seven personas of the product brief", () => {
    expect(PERSONA_KEYS).toEqual(EXPECTED_KEYS);
    expect(PERSONA_CATALOG).toHaveLength(7);
  });

  test("every persona has a known context and a valid, non-empty role list", () => {
    for (const persona of PERSONA_CATALOG) {
      expect(PERSONA_CONTEXTS).toContain(persona.context);
      expect(persona.allowedRoles.length).toBeGreaterThan(0);
      for (const role of persona.allowedRoles) {
        expect(PERSONA_BASELINE_ROLES).toContain(role);
      }
    }
  });

  test("every persona carries an i18n label key", () => {
    for (const persona of PERSONA_CATALOG) {
      expect(persona.labelKey.startsWith("engineering.permissions.")).toBe(true);
    }
  });

  test("the program/venture managers are staff-restricted; the member personas are member-restricted", () => {
    expect(getPersonaDefinition("program_manager").allowedRoles).toEqual(["staff"]);
    expect(getPersonaDefinition("venture_manager").allowedRoles).toEqual(["staff"]);
    expect(getPersonaDefinition("participant").allowedRoles).toEqual(["member"]);
    expect(getPersonaDefinition("founder").allowedRoles).toEqual(["member"]);
  });

  test("unknown keys are refused", () => {
    expect(getPersonaDefinition("ghost")).toBeNull();
    expect(isValidPersonaKey("ghost")).toBe(false);
    expect(isValidPersonaKey("founder")).toBe(true);
  });
});

describe("validatePersonaUpdate", () => {
  test("accepts a known key with known roles", () => {
    const result = validatePersonaUpdate({
      key: "founder",
      allowed_roles: ["member", "staff"],
      is_active: true,
    });
    expect(result.valid).toBe(true);
    expect(result.normalized.allowed_roles).toEqual(["member", "staff"]);
  });

  test("refuses an unknown persona", () => {
    const result = validatePersonaUpdate({ key: "ghost", allowed_roles: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown persona");
  });

  test("refuses an unknown role", () => {
    const result = validatePersonaUpdate({ key: "founder", allowed_roles: ["wizard"] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown roles");
  });

  test("[] is a real state — explicitly nobody, not 'not configured'", () => {
    const result = validatePersonaUpdate({ key: "founder", allowed_roles: [] });
    expect(result.valid).toBe(true);
    expect(result.normalized.allowed_roles).toEqual([]);
  });

  test("de-duplicates roles and defaults is_active to true", () => {
    const result = validatePersonaUpdate({
      key: "founder",
      allowed_roles: ["member", "member"],
    });
    expect(result.normalized.allowed_roles).toEqual(["member"]);
    expect(result.normalized.is_active).toBe(true);
  });

  test("keeps an explicit false", () => {
    const result = validatePersonaUpdate({ key: "founder", allowed_roles: [], is_active: false });
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

describe("personas store", () => {
  const loadStore = () => {
    jest.resetModules();
    return require("@/models/authorization/personasStore");
  };

  test("creates its table once per process, idempotently", async () => {
    const { ensurePersonasSchema } = loadStore();
    await ensurePersonasSchema();
    await ensurePersonasSchema();
    const ddl = callsMatching(/CREATE TABLE IF NOT EXISTS personas/i);
    expect(ddl).toHaveLength(1);
  });

  test("seeds the whole catalogue with ON CONFLICT DO NOTHING", async () => {
    const { seedPersonas } = loadStore();
    await seedPersonas();
    const inserts = callsMatching(/INSERT INTO personas/i);
    expect(inserts).toHaveLength(PERSONA_CATALOG.length);
    expect(inserts.every((call) => /ON CONFLICT \(key\) DO NOTHING/i.test(sqlOf(call)))).toBe(true);
    const keys = inserts.map((call) => call[0].args[0]);
    expect(keys).toEqual(EXPECTED_KEYS);
  });

  test("updatePersona writes allowed_roles, is_active and notes — never key/context", async () => {
    const { updatePersona } = loadStore();
    await updatePersona({
      key: "founder",
      allowedRoles: ["member"],
      isActive: false,
      notes: "note",
    });
    const update = callsMatching(/UPDATE personas/i)[0];
    const setClause = sqlOf(update).split(/WHERE/i)[0];
    expect(setClause).toContain("allowed_roles = ?");
    // key/context are identity columns — never in the SET clause.
    expect(setClause).not.toMatch(/\bkey\b/i);
    expect(setClause).not.toMatch(/\bcontext\b/i);
    expect(update[0].args).toEqual(['["member"]', 0, "note", "founder"]);
  });
});

// ── 3. Route contract ────────────────────────────────────────────────────────

describe("GET/PUT /api/engineering/permissions/personas", () => {
  const loadRoute = () => {
    jest.resetModules();
    return require("@/app/api/engineering/permissions/personas/route");
  };

  test("GET is gated on permissions.view_matrix and returns the catalogue", async () => {
    const route = loadRoute();
    const { requireAuthorization } = require("@/models/authorization/index");
    mockExecute.mockImplementation(async (arg) => {
      const sql = typeof arg === "string" ? arg : String(arg?.sql || "");
      if (/SELECT[\s\S]*FROM personas/i.test(sql)) {
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
    expect(body.contexts).toEqual(PERSONA_CONTEXTS);
    expect(body.personas[0]).toMatchObject({
      key: "founder",
      context: "venture",
      label_key: "engineering.permissions.personaFounder",
      allowed_roles: ["member"],
      is_active: 1,
    });
  });

  test("PUT is gated on permissions.configure_eligibility, edits and audits", async () => {
    const route = loadRoute();
    const { requireAuthorization } = require("@/models/authorization/index");
    const { logPermissionAudit } = require("@/models/authorization/accessQueries");

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
    expect(body.persona.allowed_roles).toEqual(["member", "staff"]);
    expect(callsMatching(/UPDATE personas/i)).toHaveLength(1);
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "persona_updated", targetName: "founder" }),
    );
  });

  test("PUT refuses an unknown persona before touching the database", async () => {
    const route = loadRoute();
    const res = await route.PUT({
      json: async () => ({ key: "ghost", allowed_roles: ["member"] }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(callsMatching(/UPDATE personas/i)).toHaveLength(0);
  });
});
