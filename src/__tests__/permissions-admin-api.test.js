/**
 * Route-level tests for the Permission Control Center admin APIs
 * (Phase 6 §24): eligibility read/write + unset, profile role-default
 * eligibility enforcement, and individual grant eligibility rejection.
 *
 * The resolver semantics (deny wins, restriction > grant, SA bypass) are
 * unit-tested in authorization-resolver.test.js — these tests cover the
 * HTTP boundary and the server-side validation wiring.
 */

const mockExecutedQueries = [];
// Rows affected by the role-default DELETE (0 = no matching mapping).
let mockRoleDefaultRowsAffected = 1;

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql }) => {
      mockExecutedQueries.push(String(sql));
      if (String(sql).includes("FROM access_profiles WHERE id")) {
        return { rows: [{ id: 99, name: "Some Profile" }] };
      }
      if (String(sql).includes("DELETE FROM role_access_profile_defaults")) {
        return { rows: [], rowsAffected: mockRoleDefaultRowsAffected };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "SA-1", name: "Super Admin" }),
  logPermissionAudit: jest.fn().mockResolvedValue(true),
  ensurePermissionsSchema: jest.fn().mockResolvedValue(true),
  getUserGroups: jest.fn().mockResolvedValue([]),
  getUserEffectiveProfile: jest.fn().mockResolvedValue(null),
  seedDefaultRoleCapabilities: jest.fn().mockResolvedValue(true),
  ensureResponsibilitiesSchema: jest.fn().mockResolvedValue(true),
  seedDefaultResponsibilities: jest.fn().mockResolvedValue(true),
}));

let mockAuthzDecision = null; // null = granted (route proceeds)
const mockRealEligAdmin = jest.requireActual("@/lib/authorization/eligibility-admin");
const mockRealEligibility = jest.requireActual("@/lib/authorization/eligibility");
jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
  invalidateAllAuthorizationContexts: jest.fn(),
  invalidateAuthorizationContext: jest.fn(),
  effectivePermissionsFromContext: jest.fn().mockReturnValue({}),
  buildPermissionExplanation: jest.fn().mockReturnValue(null),
  assertTemplateCapsEligible: jest.fn().mockResolvedValue({ valid: true, violations: [] }),
  getAuthorizationContext: jest.fn().mockResolvedValue({ isSuperAdmin: true, eligibility: {} }),
  authorize: jest.fn().mockReturnValue(true), // used by the eligibility route for the canConfigure flag
  FEATURE_KEYS: mockRealEligAdmin.FEATURE_KEYS,
  IDENTITY_TYPES: mockRealEligAdmin.IDENTITY_TYPES,
  ROLE_CATALOG: mockRealEligAdmin.ROLE_CATALOG,
  validateEligibilityChanges: mockRealEligAdmin.validateEligibilityChanges,
  MODULE_TO_FEATURE: mockRealEligibility.MODULE_TO_FEATURE,
}));

const { requireAuthorization, invalidateAllAuthorizationContexts, assertTemplateCapsEligible, getAuthorizationContext } =
  require("@/lib/authorization");
const { logPermissionAudit } = require("@/lib/auth");
const eligibilityRoute = require("@/app/api/engineering/permissions/eligibility/route");
const roleDefaultsRoute = require("@/app/api/access-profiles/role-defaults/route");
const permissionsRoute = require("@/app/api/engineering/permissions/route");

const jsonReq = (body, method = "PUT", url = "http://localhost/api/x") =>
  new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  mockExecutedQueries.length = 0;
  mockAuthzDecision = null;
  mockRoleDefaultRowsAffected = 1;
  jest.clearAllMocks();
});

describe("GET /api/engineering/permissions/eligibility — read gate", () => {
  test("requires permissions.view_matrix", async () => {
    await eligibilityRoute.GET();
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  });

  test("unauthorized read → 403", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false, error: "x" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const res = await eligibilityRoute.GET();
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/engineering/permissions/eligibility — write", () => {
  test("requires permissions.configure_eligibility (dedicated authority)", async () => {
    await eligibilityRoute.PUT(jsonReq({ changes: [] }));
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "configure_eligibility");
  });

  test("unauthorized write → 403 and no persistence", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false, error: "x" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const res = await eligibilityRoute.PUT(
      jsonReq({ changes: [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 1 }] }),
    );
    expect(res.status).toBe(403);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO feature_eligibility"))).toBe(false);
  });

  test("valid change upserts the row, audits, and invalidates the cache", async () => {
    const res = await eligibilityRoute.PUT(
      jsonReq({ changes: [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 1 }] }),
    );
    expect(res.status).toBe(200);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO feature_eligibility"))).toBe(true);
    expect(invalidateAllAuthorizationContexts).toHaveBeenCalled();
  });

  test("unset (eligible=null) deletes the row — fail-closed removal", async () => {
    const res = await eligibilityRoute.PUT(
      jsonReq({ changes: [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: null }] }),
    );
    expect(res.status).toBe(200);
    expect(mockExecutedQueries.some((q) => q.includes("DELETE FROM feature_eligibility"))).toBe(true);
  });

  test("invalid changes → 400 (unknown feature / bad value / bad type / empty)", async () => {
    for (const changes of [
      [{ feature_key: "nope", identity_type: "role", identity_value: "staff", eligible: 1 }],
      [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 2 }],
      [{ feature_key: "finance", identity_type: "planet", identity_value: "staff", eligible: 1 }],
      [],
    ]) {
      const res = await eligibilityRoute.PUT(jsonReq({ changes }));
      expect(res.status).toBe(400);
    }
  });
});

describe("PUT /api/access-profiles/role-defaults — eligibility boundary", () => {
  test("requires permissions.assign_capabilities", async () => {
    await roleDefaultsRoute.PUT(jsonReq({ role_name: "staff", profile_id: 2 }));
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "assign_capabilities");
  });

  test("rejects a default profile that grants ineligible capabilities", async () => {
    assertTemplateCapsEligible.mockResolvedValueOnce({
      valid: false,
      violations: [{ module: "finance", capability: "view", feature: "finance" }],
    });
    const res = await roleDefaultsRoute.PUT(jsonReq({ role_name: "mentor", profile_id: 99 }));
    expect([400, 403]).toContain(res.status);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO role_access_profile_defaults"))).toBe(false);
  });
});

describe("DELETE /api/access-profiles/role-defaults — remove a role default", () => {
  const delReq = (query) =>
    new Request(`http://localhost/api/access-profiles/role-defaults?${query}`, {
      method: "DELETE",
    });
  const deleteSql = () =>
    mockExecutedQueries.find((q) =>
      q.includes("DELETE FROM role_access_profile_defaults"),
    );

  test("requires permissions.assign_capabilities (no removal when unauthorized)", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false, error: "x" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const res = await roleDefaultsRoute.DELETE(delReq("role_name=staff&profile_id=2"));
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "assign_capabilities");
    expect(res.status).toBe(403);
    expect(deleteSql()).toBeUndefined();
  });

  test("removes the mapping, scoped to role_name AND profile_id", async () => {
    const res = await roleDefaultsRoute.DELETE(delReq("role_name=staff&profile_id=2"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, removed: 1 });
    // The DELETE is scoped, so a stale UI can never drop another profile's default.
    expect(deleteSql()).toContain("role_name = ?");
    expect(deleteSql()).toContain("access_profile_id = ?");
  });

  test("a real removal is audited and invalidates the authorization cache", async () => {
    await roleDefaultsRoute.DELETE(delReq("role_name=staff&profile_id=2"));
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "role_default_changed",
        targetName: "role:staff",
      }),
    );
    expect(invalidateAllAuthorizationContexts).toHaveBeenCalled();
  });

  test("no matching mapping → success but no audit and no cache invalidation", async () => {
    mockRoleDefaultRowsAffected = 0;
    const res = await roleDefaultsRoute.DELETE(delReq("role_name=ghost&profile_id=2"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, removed: 0 });
    expect(logPermissionAudit).not.toHaveBeenCalled();
    expect(invalidateAllAuthorizationContexts).not.toHaveBeenCalled();
  });

  test("missing role_name or profile_id → 400 with no query", async () => {
    for (const query of ["role_name=staff", "profile_id=2", ""]) {
      const res = await roleDefaultsRoute.DELETE(delReq(query));
      expect(res.status).toBe(400);
    }
    expect(deleteSql()).toBeUndefined();
  });
});

describe("PUT /api/engineering/permissions — individual grants respect eligibility", () => {
  test("grant to an ineligible target is rejected (403) before any write", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: false, eligibility: { finance: false } });
    const res = await permissionsRoute.PUT(
      jsonReq({
        action: "grant",
        user_cid: "USER_X",
        module: "finance",
        capability: "view",
        access_level: 1,
      }),
    );
    expect(res.status).toBe(403);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO user_capabilities"))).toBe(false);
  });

  test("grant to an eligible target writes the capability", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: false, eligibility: { finance: true } });
    const res = await permissionsRoute.PUT(
      jsonReq({
        action: "grant",
        user_cid: "USER_X",
        module: "finance",
        capability: "view",
        access_level: 1,
      }),
    );
    expect(res.status).toBe(200);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO user_capabilities"))).toBe(true);
  });
});
