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
// C2 — rows the template-impact probe returns (role defaults still granting a
// feature's capabilities).
let mockTemplateImpacts = [];
// Prior-state probes used by the audit trail (read BEFORE each write).
let mockPriorGrantLevel = null;
let mockPriorBlockExists = false;
let mockPriorGroupLevel = null;

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql }) => {
      mockExecutedQueries.push(String(sql));
      if (String(sql).includes("FROM access_profiles WHERE id")) {
        return { rows: [{ id: 99, name: "Some Profile" }] };
      }
      if (String(sql).includes("JOIN profile_capabilities")) {
        return { rows: mockTemplateImpacts };
      }
      if (String(sql).includes("DELETE FROM role_access_profile_defaults")) {
        return { rows: [], rowsAffected: mockRoleDefaultRowsAffected };
      }
      // Audit-trail prior state — read before the write so the log can say what
      // the value was changed FROM.
      if (String(sql).includes("FROM user_capabilities WHERE user_cid")) {
        return { rows: mockPriorGrantLevel === null ? [] : [{ access_level: mockPriorGrantLevel }] };
      }
      if (String(sql).includes("FROM user_capability_restrictions WHERE user_cid")) {
        return { rows: mockPriorBlockExists ? [{ "?column?": 1 }] : [] };
      }
      if (String(sql).includes("FROM group_capabilities WHERE group_name")) {
        return { rows: mockPriorGroupLevel === null ? [] : [{ access_level: mockPriorGroupLevel }] };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "SA-1", name: "Super Admin" }),
}));
jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn().mockResolvedValue(true),
  getUserGroups: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/models/authorization/bootstrap", () => ({
  ensurePermissionsSchema: jest.fn().mockResolvedValue(true),
  seedDefaultRoleCapabilities: jest.fn().mockResolvedValue(true),
  ensureResponsibilitiesSchema: jest.fn().mockResolvedValue(true),
  seedDefaultResponsibilities: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/services/authorization/accessProfiles", () => ({
  getUserEffectiveProfile: jest.fn().mockResolvedValue(null),
}));

let mockAuthzDecision = null; // null = granted (route proceeds)
// The eligibility route's canConfigure decision moved into the service, which
// imports `authorize` from the context MODULE. Both mocks share one fn so the
// barrel mock and the module mock cannot disagree.
const mockAuthorize = jest.fn().mockReturnValue(true);
jest.mock("@/services/authorization/context", () => ({
  ...jest.requireActual("@/services/authorization/context"),
  authorize: mockAuthorize,
}));

jest.mock("@/services/authorization/eligibilityAdmin", () => ({
  ...jest.requireActual("@/services/authorization/eligibilityAdmin"),
  assertTemplateCapsEligible: jest.fn().mockResolvedValue({ valid: true, violations: [] }),
}));

const mockRealEligAdmin = jest.requireActual("@/services/authorization/eligibilityAdmin");
const mockRealEligibility = {
  ...jest.requireActual("@/models/authorization/eligibility"),
  ...jest.requireActual("@/services/authorization/eligibility"),
};
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
  invalidateAllAuthorizationContexts: jest.fn(),
  invalidateAuthorizationContext: jest.fn(),
  effectivePermissionsFromContext: jest.fn().mockReturnValue({}),
  buildPermissionExplanation: jest.fn().mockReturnValue(null),
  assertTemplateCapsEligible: jest.fn().mockResolvedValue({ valid: true, violations: [] }),
  getAuthorizationContext: jest.fn().mockResolvedValue({ isSuperAdmin: true, eligibility: {} }),
  authorize: mockAuthorize, // used by the eligibility route for the canConfigure flag
  FEATURE_KEYS: mockRealEligAdmin.FEATURE_KEYS,
  IDENTITY_TYPES: mockRealEligAdmin.IDENTITY_TYPES,
  ROLE_CATALOG: mockRealEligAdmin.ROLE_CATALOG,
  validateEligibilityChanges: mockRealEligAdmin.validateEligibilityChanges,
  findTemplatesGrantingFeature: mockRealEligAdmin.findTemplatesGrantingFeature,
  MODULE_TO_FEATURE: mockRealEligibility.MODULE_TO_FEATURE,
}));

const { requireAuthorization, invalidateAllAuthorizationContexts, getAuthorizationContext } =
  require("@/models/authorization/index");
// The role-defaults eligibility boundary moved to its own route suite
// (profile-role-defaults-api.test.js) when the access-profile routes were
// retired; this suite keeps the eligibility + permissions matrix contracts.
const { logPermissionAudit } = require("@/models/authorization/accessQueries");
const eligibilityRoute = require("@/app/api/engineering/permissions/eligibility/route");
const permissionsRoute = require("@/app/api/engineering/permissions/route");

const jsonReq = (body, method = "PUT", url = "http://localhost/api/x") =>
  new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  mockExecutedQueries.length = 0;
  mockAuthzDecision = null;
  mockRoleDefaultRowsAffected = 1;
  mockTemplateImpacts = [];
  mockPriorGrantLevel = null;
  mockPriorBlockExists = false;
  mockPriorGroupLevel = null;
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
    expect(mockExecutedQueries.some((query) => query.includes("INSERT INTO feature_eligibility"))).toBe(false);
  });

  test("valid change upserts the row, audits, and invalidates the cache", async () => {
    const res = await eligibilityRoute.PUT(
      jsonReq({ changes: [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 1 }] }),
    );
    expect(res.status).toBe(200);
    expect(mockExecutedQueries.some((query) => query.includes("INSERT INTO feature_eligibility"))).toBe(true);
    expect(invalidateAllAuthorizationContexts).toHaveBeenCalled();
  });

  test("unset (eligible=null) deletes the row — fail-closed removal", async () => {
    const res = await eligibilityRoute.PUT(
      jsonReq({ changes: [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: null }] }),
    );
    expect(res.status).toBe(200);
    expect(mockExecutedQueries.some((query) => query.includes("DELETE FROM feature_eligibility"))).toBe(true);
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

describe("PUT eligibility — C2 template impact confirmation", () => {
  const TEMPLATE_ROW = {
    id: 7,
    name: "Staff default",
    module: "finance",
    capability: "view",
  };

  test("a downgrade that strands template capabilities → 409, nothing persisted", async () => {
    mockTemplateImpacts = [TEMPLATE_ROW];
    const res = await eligibilityRoute.PUT(
      jsonReq({ changes: [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 0 }] }),
    );
    expect(res.status).toBe(409);
    const payload = await res.json();
    expect(payload.requiresConfirmation).toBe(true);
    expect(payload.impacts).toEqual([
      {
        role: "staff",
        feature: "finance",
        templates: [{ id: 7, name: "Staff default", capabilities: ["finance.view"] }],
      },
    ]);
    expect(mockExecutedQueries.some((query) => query.includes("INSERT INTO feature_eligibility"))).toBe(false);
    expect(mockExecutedQueries.some((query) => query.includes("DELETE FROM feature_eligibility"))).toBe(false);
  });

  test("unset (eligible=null) is also a downgrade and asks first", async () => {
    mockTemplateImpacts = [TEMPLATE_ROW];
    const res = await eligibilityRoute.PUT(
      jsonReq({ changes: [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: null }] }),
    );
    expect(res.status).toBe(409);
  });

  test("confirm:true applies the downgrade", async () => {
    mockTemplateImpacts = [TEMPLATE_ROW];
    const res = await eligibilityRoute.PUT(
      jsonReq({
        changes: [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 0 }],
        confirm: true,
      }),
    );
    expect(res.status).toBe(200);
    expect(mockExecutedQueries.some((query) => query.includes("INSERT INTO feature_eligibility"))).toBe(true);
  });

  test("an upgrade (eligible=1) never asks for confirmation", async () => {
    mockTemplateImpacts = [TEMPLATE_ROW];
    const res = await eligibilityRoute.PUT(
      jsonReq({ changes: [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 1 }] }),
    );
    expect(res.status).toBe(200);
  });

  test("a downgrade with no impacted template applies directly", async () => {
    mockTemplateImpacts = [];
    const res = await eligibilityRoute.PUT(
      jsonReq({ changes: [{ feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 0 }] }),
    );
    expect(res.status).toBe(200);
  });

  test("group downgrades are not template-bound — no confirmation", async () => {
    mockTemplateImpacts = [TEMPLATE_ROW];
    const res = await eligibilityRoute.PUT(
      jsonReq({ changes: [{ feature_key: "finance", identity_type: "group", identity_value: "Future Studio", eligible: 0 }] }),
    );
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/engineering/permissions — the matrix route is still wired", () => {
  test("the route module exports its handlers", () => {
    expect(typeof permissionsRoute.GET).toBe("function");
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
    expect(mockExecutedQueries.some((query) => query.includes("INSERT INTO user_capabilities"))).toBe(false);
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
    expect(mockExecutedQueries.some((query) => query.includes("INSERT INTO user_capabilities"))).toBe(true);
  });
});

/**
 * The permission audit trail must answer "what changed", not just "who
 * changed what". Every individual/role/group write now reads the prior state
 * before mutating and records both sides of the change.
 */
describe("PUT /api/engineering/permissions — audit trail records the change", () => {
  test("a grant records the level it replaced", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true, eligibility: {} });
    mockPriorGrantLevel = 1;
    const res = await permissionsRoute.PUT(
      jsonReq({
        action: "grant",
        user_cid: "USER_X",
        module: "finance",
        capability: "view",
        access_level: 3,
      }),
    );
    expect(res.status).toBe(200);
    expect(logPermissionAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "granted", previousValue: "1", newValue: "3" }),
    );
  });

  test("a first-ever grant records 'none' as the previous value", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true, eligibility: {} });
    mockPriorGrantLevel = null;
    await permissionsRoute.PUT(
      jsonReq({
        action: "grant",
        user_cid: "USER_X",
        module: "finance",
        capability: "view",
        access_level: 1,
      }),
    );
    expect(logPermissionAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "granted", previousValue: "none", newValue: "1" }),
    );
  });

  test("a revoke records the level that was removed", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true, eligibility: {} });
    mockPriorGrantLevel = 2;
    await permissionsRoute.PUT(
      jsonReq({ action: "revoke", user_cid: "USER_X", module: "finance", capability: "view" }),
    );
    expect(logPermissionAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "revoked", previousValue: "2", newValue: "none" }),
    );
  });

  test("a restrict records the transition into a block", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true, eligibility: {} });
    mockPriorBlockExists = false;
    await permissionsRoute.PUT(
      jsonReq({ action: "restrict", user_cid: "USER_X", module: "finance", capability: "view" }),
    );
    expect(logPermissionAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "restricted", previousValue: "none", newValue: "blocked" }),
    );
  });

  test("re-blocking an already blocked capability is recorded as such", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true, eligibility: {} });
    mockPriorBlockExists = true;
    await permissionsRoute.PUT(
      jsonReq({ action: "restrict", user_cid: "USER_X", module: "finance", capability: "view" }),
    );
    expect(logPermissionAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "restricted", previousValue: "blocked", newValue: "blocked" }),
    );
  });

  test("a group-default change is audited (it used to write no record at all)", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true, eligibility: {} });
    mockPriorGroupLevel = null;
    const res = await permissionsRoute.PUT(
      jsonReq({
        action: "set_group_default",
        user_cid: "USER_X",
        group_name: "Development",
        module: "finance",
        capability: "view",
        access_level: 2,
      }),
    );
    expect(res.status).toBe(200);
    expect(mockExecutedQueries.some((query) => query.includes("INSERT INTO group_capabilities"))).toBe(true);
    expect(logPermissionAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "group_changed",
        previousValue: "none",
        newValue: "2",
        details: "Group: Development",
      }),
    );
  });
});
