/**
 * Characterization tests for the eligibility configuration route's DECISIONS,
 * written BEFORE moving them out of `eligibility/route.js`.
 *
 * Why this file exists: `permissions-admin-api.test.js` covers the HTTP
 * boundary of this route (gate, upsert, unset, C2 409), but it mocks
 * `@/lib/authorization` WITHOUT `ELIGIBILITY_IDENTITIES` and
 * `ELIGIBILITY_IDENTITY_GROUPS`. Both are `undefined` there, so `roles`,
 * `identityGroups` and `extraRoles` have never been exercised — the three
 * GET decisions that this block extracts. Everything asserted here is read
 * from the REAL service constants so the derivation is pinned against them.
 *
 * The model layer is mocked (not the SQL) so the WHERE-free reads, the
 * previous-value read and the write choice are all observable as calls.
 */

const mockState = {
  rows: [],
  userGroups: [],
  contactGroups: [],
  eligibilityRoles: [],
  roleDefaults: [],
  priorRow: null,
  // Per-ROLE probe answers, because the probe is asked once per downgrade and
  // a global stub would make every role look impacted.
  templateImpactsByRole: {},
  fallbackTemplateImpacts: [],
};

const mockCalls = { findTemplatesGrantingFeature: [] };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn().mockResolvedValue({ rows: [] }) },
  initDb: jest.fn().mockResolvedValue(true),
}));

let mockSession = { cid: "SA-1", name: "Super Admin" };
let mockAuthzDecision = null; // null = granted
let mockContext = { isSuperAdmin: true, eligibility: {} };
let mockCanConfigure = true;

const mockRealEligibilityAdmin = jest.requireActual("@/services/authorization/eligibilityAdmin");
const mockRealEligibility = jest.requireActual("@/services/authorization/eligibility");

// The canConfigure decision now lives in services/authorization/eligibilityConfiguration,
// which imports `authorize` from the context MODULE (the convention of blocks
// a-d: a service never imports the barrel that re-exports it). So the barrel
// mock below no longer intercepts it — mock the context module too, sharing the
// same fn so both assertions point at one decision.
jest.mock("@/services/authorization/context", () => ({
  ...jest.requireActual("@/services/authorization/context"),
  authorize: jest.fn().mockImplementation(() => mockCanConfigure),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
  getAuthorizationContext: jest.fn().mockImplementation(async () => mockContext),
  authorize: jest.fn().mockImplementation(() => mockCanConfigure),
  invalidateAllAuthorizationContexts: jest.fn(),
  effectivePermissionsFromContext: jest.fn().mockReturnValue({}),
  buildPermissionExplanation: jest.fn().mockReturnValue(null),
  assertTemplateCapsEligible: jest.fn().mockResolvedValue({ valid: true, violations: [] }),
  FEATURE_KEYS: mockRealEligibilityAdmin.FEATURE_KEYS,
  IDENTITY_TYPES: mockRealEligibilityAdmin.IDENTITY_TYPES,
  ELIGIBILITY_IDENTITIES: mockRealEligibilityAdmin.ELIGIBILITY_IDENTITIES,
  ELIGIBILITY_IDENTITY_GROUPS: mockRealEligibilityAdmin.ELIGIBILITY_IDENTITY_GROUPS,
  ROLE_CATALOG: mockRealEligibilityAdmin.ROLE_CATALOG,
  MODULE_TO_FEATURE: mockRealEligibility.MODULE_TO_FEATURE,
  validateEligibilityChanges: mockRealEligibilityAdmin.validateEligibilityChanges,
  findTemplatesGrantingFeature: jest
    .fn()
    .mockImplementation(async (role, feature) => {
      mockCalls.findTemplatesGrantingFeature.push({ role, feature });
      const rows = Object.prototype.hasOwnProperty.call(mockState.templateImpactsByRole, role)
        ? mockState.templateImpactsByRole[role]
        : mockState.fallbackTemplateImpacts;
      return { rows };
    }),
}));

const mockAuditEntries = [];
jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockImplementation(async () => mockSession),
  logPermissionAudit: jest.fn().mockImplementation(async (entry) => {
    mockAuditEntries.push(entry);
    return true;
  }),
  ensurePermissionsSchema: jest.fn().mockResolvedValue(true),
  getUserGroups: jest.fn().mockResolvedValue([]),
  getUserEffectiveProfile: jest.fn().mockResolvedValue(null),
  seedDefaultRoleCapabilities: jest.fn().mockResolvedValue(true),
  ensureResponsibilitiesSchema: jest.fn().mockResolvedValue(true),
  seedDefaultResponsibilities: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/authorization", () => ({
  listFeatureEligibilityRows: jest.fn().mockImplementation(async () => ({ rows: mockState.rows })),
  listDistinctUserGroupNames: jest.fn().mockImplementation(async () => ({ rows: mockState.userGroups })),
  listDistinctContactGroupNames: jest.fn().mockImplementation(async () => ({ rows: mockState.contactGroups })),
  listEligibilityRoleIdentities: jest.fn().mockImplementation(async () => ({
    rows: mockState.eligibilityRoles,
  })),
  listRoleAccessProfileDefaults: jest.fn().mockImplementation(async () => ({
    rows: mockState.roleDefaults,
  })),
  getEligibilityRow: jest.fn().mockImplementation(async () => ({
    rows: mockState.priorRow ? [mockState.priorRow] : [],
  })),
  deleteEligibilityRow: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
  upsertEligibilityRow: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
}));

const { authorize: authorizeContextModule } = require("@/services/authorization/context");
const {
  requireAuthorization,
  getAuthorizationContext,
  invalidateAllAuthorizationContexts,
  ELIGIBILITY_IDENTITIES,
  ELIGIBILITY_IDENTITY_GROUPS,
  FEATURE_KEYS,
  IDENTITY_TYPES,
} = require("@/lib/authorization");
const {
  listFeatureEligibilityRows,
  listEligibilityRoleIdentities,
  listRoleAccessProfileDefaults,
  getEligibilityRow,
  deleteEligibilityRow,
  upsertEligibilityRow,
} = require("@/models/authorization");
const { getSession } = require("@/lib/auth");
const route = require("@/app/api/engineering/permissions/eligibility/route");

const jsonReq = (body) =>
  new Request("http://localhost/api/engineering/permissions/eligibility", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const FEATURE = FEATURE_KEYS[0];

beforeEach(() => {
  mockState.rows = [];
  mockState.userGroups = [];
  mockState.contactGroups = [];
  mockState.eligibilityRoles = [];
  mockState.roleDefaults = [];
  mockState.priorRow = null;
  mockState.templateImpactsByRole = {};
  mockState.fallbackTemplateImpacts = [];
  mockCalls.findTemplatesGrantingFeature.length = 0;
  mockAuditEntries.length = 0;
  mockSession = { cid: "SA-1", name: "Super Admin" };
  mockAuthzDecision = null;
  mockContext = { isSuperAdmin: true, eligibility: {} };
  mockCanConfigure = true;
  jest.clearAllMocks();
});

describe("GET — read gate and the canConfigure flag", () => {
  test("requires permissions.view_matrix (not configure_eligibility)", async () => {
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  });

  test("canConfigure is a SOFT flag: authorize() is asked, the read still succeeds", async () => {
    mockCanConfigure = false;
    const res = await route.GET();
    // The weak gate: a viewer without configure_eligibility still gets the
    // whole catalog — only the flag flips, so the UI can grey out the writes.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canConfigure).toBe(false);
    expect(body.features.length).toBeGreaterThan(0);
  });

  test("canConfigure is coerced to a real boolean, never null/undefined", async () => {
    mockCanConfigure = undefined;
    const body = await (await route.GET()).json();
    expect(body.canConfigure).toBe(false);
    expect(typeof body.canConfigure).toBe("boolean");
  });

  test("the gate is evaluated against the CONTEXT derived from the session", async () => {
    mockSession = { cid: "STAFF-9", name: "Staff Nine" };
    mockContext = { isSuperAdmin: false, eligibility: { crm: true } };
    mockCanConfigure = true;

    await route.GET();

    expect(getSession).toHaveBeenCalled();
    expect(getAuthorizationContext).toHaveBeenCalledWith(mockSession);
    // The service resolves `authorize` from ./context, so assert on THAT
    // module's spy — the barrel mock is bypassed by design.
    expect(authorizeContextModule).toHaveBeenCalledWith(
      mockContext,
      "permissions",
      "configure_eligibility",
    );
  });

  test("a denied read returns the gate error verbatim and reads nothing", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false }), { status: 403 });
    const res = await route.GET();
    expect(res.status).toBe(403);
    expect(listFeatureEligibilityRows).not.toHaveBeenCalled();
    expect(getAuthorizationContext).not.toHaveBeenCalled();
  });

  test("a failure while reading is a 500, never a partial 200", async () => {
    listFeatureEligibilityRows.mockRejectedValueOnce(new Error("db down"));
    const res = await route.GET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("errors.somethingWrong");
  });
});

describe("GET — roles / identityGroups: the agreed list is passed through, not rebuilt", () => {
  test("roles is exactly ELIGIBILITY_IDENTITIES (functions excluded)", async () => {
    const body = await (await route.GET()).json();
    expect(body.roles).toEqual(ELIGIBILITY_IDENTITIES);
    // The documented contract: program_manager is a profile, never an
    // eligibility identity.
    expect(body.roles).not.toContain("program_manager");
  });

  test("identityGroups is passed through so the UI can label baseline vs context", async () => {
    const body = await (await route.GET()).json();
    expect(body.identityGroups).toEqual(ELIGIBILITY_IDENTITY_GROUPS);
    expect(body.identityGroups.identities).toContain("staff");
    expect(body.identityGroups.contextRoles).toContain("founder");
  });

  test("features / identityTypes / moduleToFeature are the engine's own vocabulary", async () => {
    const body = await (await route.GET()).json();
    expect(body.features).toEqual(FEATURE_KEYS);
    expect(body.identityTypes).toEqual(IDENTITY_TYPES);
    expect(body.moduleToFeature).toEqual(mockRealEligibility.MODULE_TO_FEATURE);
  });

  test("rows are returned as read, one unfiltered statement", async () => {
    mockState.rows = [
      { feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: 1 },
    ];
    const body = await (await route.GET()).json();
    expect(body.rows).toEqual(mockState.rows);
    expect(listFeatureEligibilityRows).toHaveBeenCalledTimes(1);
  });
});

describe("GET — extraRoles: derived from the DATA, never a new allowlist", () => {
  test("roles found in the DB but absent from the agreed list are surfaced", async () => {
    mockState.eligibilityRoles = [
      { identity_value: "program_manager" },
      { identity_value: "mentor" },
    ];
    mockState.roleDefaults = [{ role_name: "teacher" }];

    const body = await (await route.GET()).json();
    expect(body.extraRoles).toEqual(["mentor", "program_manager", "teacher"]);
  });

  test("an agreed identity is never re-listed as an extra role", async () => {
    mockState.eligibilityRoles = [{ identity_value: "staff" }, { identity_value: "mentor" }];
    mockState.roleDefaults = [{ role_name: "super_admin" }, { role_name: "teacher" }];

    const body = await (await route.GET()).json();
    expect(body.extraRoles).toEqual(["mentor", "teacher"]);
    for (const identity of body.extraRoles) {
      expect(ELIGIBILITY_IDENTITIES).not.toContain(identity);
    }
  });

  test("both sources are unioned and deduplicated, not concatenated", async () => {
    mockState.eligibilityRoles = [{ identity_value: "mentor" }, { identity_value: "teacher" }];
    mockState.roleDefaults = [{ role_name: "mentor" }, { role_name: "teacher" }];

    const body = await (await route.GET()).json();
    expect(body.extraRoles).toEqual(["mentor", "teacher"]);
  });

  test("blank identities are dropped and the result is sorted", async () => {
    mockState.eligibilityRoles = [{ identity_value: null }, { identity_value: "" }, { identity_value: "zebra" }];
    mockState.roleDefaults = [{ role_name: "Alpha" }, { role_name: null }, { role_name: "mentor" }];

    const body = await (await route.GET()).json();
    expect(body.extraRoles).toEqual(["Alpha", "mentor", "zebra"]);
  });

  test("an empty database yields no extra roles", async () => {
    const body = await (await route.GET()).json();
    expect(body.extraRoles).toEqual([]);
  });

  test("extraRoles only reflects what the engine enforces: both reads always run", async () => {
    mockState.eligibilityRoles = [{ identity_value: "mentor" }];
    await route.GET();
    // Both sources are read even when the first is empty: the union is the
    // point, so a role granted only by a template still shows up.
    expect(listEligibilityRoleIdentities).toHaveBeenCalledTimes(1);
    expect(listRoleAccessProfileDefaults).toHaveBeenCalledTimes(1);
  });
});

describe("GET — groups: user_groups + contacts.group_name fallback, deduplicated", () => {
  test("both sources are merged, deduplicated and sorted", async () => {
    mockState.userGroups = [{ group_name: "TEAM A" }, { group_name: "TEAM B" }];
    mockState.contactGroups = [{ group_name: "TEAM B" }, { group_name: "TEAM C" }];

    const body = await (await route.GET()).json();
    expect(body.groups).toEqual(["TEAM A", "TEAM B", "TEAM C"]);
  });

  test("a group present only on a contact is still offered (the fallback)", async () => {
    mockState.userGroups = [];
    mockState.contactGroups = [{ group_name: "ORPHAN GROUP" }];
    const body = await (await route.GET()).json();
    expect(body.groups).toEqual(["ORPHAN GROUP"]);
  });

  test("no group sources yields an empty list, never undefined", async () => {
    const body = await (await route.GET()).json();
    expect(body.groups).toEqual([]);
  });
});

describe("PUT — write gate", () => {
  test("requires permissions.configure_eligibility, the dedicated authority", async () => {
    await route.PUT(jsonReq({ changes: [] }));
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "configure_eligibility");
  });

  test("a denied write returns the gate error and touches nothing", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false }), { status: 403 });
    const res = await route.PUT(jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: 1 }] }));
    expect(res.status).toBe(403);
    expect(upsertEligibilityRow).not.toHaveBeenCalled();
    expect(deleteEligibilityRow).not.toHaveBeenCalled();
  });

  test("invalid changes are rejected with the detail list, before any write", async () => {
    const res = await route.PUT(jsonReq({ changes: [{ feature_key: "nope", identity_type: "role", identity_value: "staff", eligible: 1 }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).detail.length).toBeGreaterThan(0);
    expect(upsertEligibilityRow).not.toHaveBeenCalled();
  });

  test("an unparseable body is a 400, not a 500", async () => {
    const req = new Request("http://localhost/x", { method: "PUT", body: "not json" });
    const res = await route.PUT(req);
    expect(res.status).toBe(400);
  });
});

describe("PUT — the write itself: 1 upserts, null deletes", () => {
  test("eligible 1 upserts and eligible 0 upserts (0 is an explicit DENY, a row)", async () => {
    const res = await route.PUT(
      jsonReq({
        changes: [
          { feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: 1 },
          { feature_key: FEATURE, identity_type: "role", identity_value: "member", eligible: 0 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertEligibilityRow).toHaveBeenCalledTimes(2);
    expect(upsertEligibilityRow).toHaveBeenCalledWith(FEATURE, "role", "staff", 1);
    expect(upsertEligibilityRow).toHaveBeenCalledWith(FEATURE, "role", "member", 0);
    expect(deleteEligibilityRow).not.toHaveBeenCalled();
  });

  test("eligible null DELETES the row (fail-closed unset), it is not upserted", async () => {
    await route.PUT(jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: null }] }));
    expect(deleteEligibilityRow).toHaveBeenCalledWith(FEATURE, "role", "staff");
    expect(upsertEligibilityRow).not.toHaveBeenCalled();
  });

  test("the previous value is read per change, before its write", async () => {
    mockState.priorRow = { eligible: 1 };
    await route.PUT(jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: 0 }] }));
    expect(getEligibilityRow).toHaveBeenCalledWith(FEATURE, "role", "staff");
    const readOrder = getEligibilityRow.mock.invocationCallOrder[0];
    const writeOrder = upsertEligibilityRow.mock.invocationCallOrder[0];
    expect(readOrder).toBeLessThan(writeOrder);
  });

  test("the cache is invalidated once, after every write", async () => {
    await route.PUT(
      jsonReq({
        changes: [
          { feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: 1 },
          { feature_key: FEATURE, identity_type: "role", identity_value: "member", eligible: 0 },
        ],
      }),
    );
    expect(invalidateAllAuthorizationContexts).toHaveBeenCalledTimes(1);
    expect(invalidateAllAuthorizationContexts.mock.invocationCallOrder[0]).toBeGreaterThan(
      upsertEligibilityRow.mock.invocationCallOrder[1],
    );
  });

  test("the response carries the configuration re-read AFTER the write", async () => {
    const res = await route.PUT(jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: 1 }] }));
    expect(listFeatureEligibilityRows).toHaveBeenCalledTimes(1);
    expect(listFeatureEligibilityRows.mock.invocationCallOrder[0]).toBeGreaterThan(
      upsertEligibilityRow.mock.invocationCallOrder[0],
    );
    expect(res.status).toBe(200);
  });

  test("the session is read ONCE for the whole batch, not once per change", async () => {
    await route.PUT(
      jsonReq({
        changes: [
          { feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: 1 },
          { feature_key: FEATURE, identity_type: "role", identity_value: "member", eligible: 0 },
          { feature_key: FEATURE, identity_type: "group", identity_value: "TEAM A", eligible: null },
        ],
      }),
    );
    // getSession() resolves the session token against the DB, so the batch
    // reads it once and every audit entry reuses that actor.
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(mockAuditEntries.map((e) => e.actorCid)).toEqual(["SA-1", "SA-1", "SA-1"]);
  });
});

describe("PUT — the audit trail says what the value became", () => {
  test("one audit entry per change, target system, action eligibility_changed", async () => {
    mockState.priorRow = { eligible: 0 };
    await route.PUT(jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: 1 }] }));

    expect(mockAuditEntries).toHaveLength(1);
    const entry = mockAuditEntries[0];
    expect(entry.actorCid).toBe("SA-1");
    expect(entry.actorName).toBe("Super Admin");
    expect(entry.targetCid).toBe("system");
    expect(entry.targetName).toBe("role:staff");
    expect(entry.action).toBe("eligibility_changed");
    expect(entry.details).toBe(`${FEATURE} role:staff 0 → 1`);
  });

  test("an unset previous value reads as 'unset', and a delete reads as 'unset' too", async () => {
    mockState.priorRow = null;
    await route.PUT(jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: null }] }));
    expect(mockAuditEntries[0].details).toBe(`${FEATURE} role:staff unset → unset`);
  });

  test("a group change is audited with its own identity_type", async () => {
    await route.PUT(jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "group", identity_value: "TEAM A", eligible: 0 }] }));
    expect(mockAuditEntries[0].targetName).toBe("group:TEAM A");
    expect(mockAuditEntries[0].details).toContain("group:TEAM A");
  });
});

describe("PUT — C2: a DOWNGRADE that templates still grant is reported, never auto-applied", () => {
  const downgrade = (identityValue = "staff", identityType = "role") => ({
    feature_key: FEATURE,
    identity_type: identityType,
    identity_value: identityValue,
    eligible: 0,
  });

  test("the probe hits only role downgrades (eligible 0 or null)", async () => {
    mockState.templateImpactsByRole = {};
  mockState.fallbackTemplateImpacts = [];
    await route.PUT(
      jsonReq({
        changes: [
          { feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: 1 },
          downgrade("member"),
          downgrade("TEAM A", "group"),
        ],
      }),
    );
    expect(mockCalls.findTemplatesGrantingFeature).toEqual([{ role: "member", feature: FEATURE }]);
  });

  test("impacted templates produce a 409 asking for confirmation, and NOTHING is written", async () => {
    mockState.templateImpactsByRole = {
      staff: [
        { id: 7, name: "Staff Default", module: "crm", capability: "view" },
        { id: 7, name: "Staff Default", module: "crm", capability: "edit" },
      ],
    };

    const res = await route.PUT(jsonReq({ changes: [downgrade()] }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("errors.eligibilityImpactsTemplates");
    expect(body.requiresConfirmation).toBe(true);
    expect(body.impacts).toEqual([
      {
        role: "staff",
        feature: FEATURE,
        templates: [
          { id: 7, name: "Staff Default", capabilities: ["crm.view", "crm.edit"] },
        ],
      },
    ]);
    expect(upsertEligibilityRow).not.toHaveBeenCalled();
    expect(deleteEligibilityRow).not.toHaveBeenCalled();
    expect(mockAuditEntries).toHaveLength(0);
    expect(invalidateAllAuthorizationContexts).not.toHaveBeenCalled();
  });

  test("rows of the same template are folded into one entry, named once", async () => {
    mockState.templateImpactsByRole = {
      staff: [
        { id: 7, name: "Staff Default", module: "crm", capability: "view" },
        { id: 9, name: "Mentor Base", module: "lms", capability: "view" },
        { id: 7, name: "Staff Default", module: "crm", capability: "create" },
      ],
    };
    const body = await (await route.PUT(jsonReq({ changes: [downgrade()] }))).json();
    const templates = body.impacts[0].templates;
    expect(templates.map((t) => t.id)).toEqual([7, 9]);
    expect(templates[0]).toEqual({ id: 7, name: "Staff Default", capabilities: ["crm.view", "crm.create"] });
  });

  test("capabilities are reported as module.capability, in the order the probe returned", async () => {
    mockState.templateImpactsByRole = {
      staff: [
        { id: 7, name: "Staff Default", module: "finance", capability: "export" },
        { id: 7, name: "Staff Default", module: "crm", capability: "view" },
      ],
    };
    const body = await (await route.PUT(jsonReq({ changes: [downgrade()] }))).json();
    expect(body.impacts[0].templates[0].capabilities).toEqual(["finance.export", "crm.view"]);
  });

  test("confirm: true is the explicit decision — the downgrade then applies", async () => {
    mockState.templateImpactsByRole = { staff: [{ id: 7, name: "Staff Default", module: "crm", capability: "view" }] };
    const res = await route.PUT(jsonReq({ changes: [downgrade()], confirm: true }));
    expect(res.status).toBe(200);
    expect(upsertEligibilityRow).toHaveBeenCalledWith(FEATURE, "role", "staff", 0);
    // Confirming skips the probe entirely: the admin already decided.
    expect(mockCalls.findTemplatesGrantingFeature).toHaveLength(0);
  });

  test("confirm is read strictly as true, so a truthy string does NOT confirm", async () => {
    mockState.templateImpactsByRole = { staff: [{ id: 7, name: "Staff Default", module: "crm", capability: "view" }] };
    const res = await route.PUT(jsonReq({ changes: [downgrade()], confirm: "true" }));
    expect(res.status).toBe(409);
  });

  test("a downgrade with NO impacted template applies without asking", async () => {
    mockState.templateImpactsByRole = {};
  mockState.fallbackTemplateImpacts = [];
    const res = await route.PUT(jsonReq({ changes: [downgrade()] }));
    expect(res.status).toBe(200);
    expect(upsertEligibilityRow).toHaveBeenCalledWith(FEATURE, "role", "staff", 0);
    expect(invalidateAllAuthorizationContexts).toHaveBeenCalledTimes(1);
  });

  test("only the downgrades WITH impacts are reported, the others apply freely", async () => {
    mockState.templateImpactsByRole = {};
  mockState.fallbackTemplateImpacts = [];
    await route.PUT(jsonReq({ changes: [downgrade("member")] }));

    mockCalls.findTemplatesGrantingFeature.length = 0;
    mockState.templateImpactsByRole = { staff: [{ id: 7, name: "Staff Default", module: "crm", capability: "view" }] };

    const res = await route.PUT(
      jsonReq({ changes: [downgrade("staff"), downgrade("mentor", "role")] }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.impacts).toHaveLength(1);
    expect(body.impacts[0].role).toBe("staff");
  });

  test("a group downgrade is never probed (templates are role defaults)", async () => {
    mockState.templateImpactsByRole = { staff: [{ id: 7, name: "Staff Default", module: "crm", capability: "view" }] };
    const res = await route.PUT(jsonReq({ changes: [downgrade("TEAM A", "group")] }));
    expect(res.status).toBe(200);
    expect(mockCalls.findTemplatesGrantingFeature).toHaveLength(0);
  });

  test("an eligible NULL on a role is a downgrade and is probed like a 0", async () => {
    mockState.templateImpactsByRole = { staff: [{ id: 7, name: "Staff Default", module: "crm", capability: "view" }] };
    const res = await route.PUT(
      jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: null }] }),
    );
    expect(res.status).toBe(409);
    expect(mockCalls.findTemplatesGrantingFeature).toEqual([{ role: "staff", feature: FEATURE }]);
  });

  test("one probe per downgrade — the loop is per change, not per template", async () => {
    mockState.templateImpactsByRole = {};
  mockState.fallbackTemplateImpacts = [];
    await route.PUT(
      jsonReq({
        changes: [downgrade("staff"), downgrade("member"), downgrade("mentor", "role")],
        confirm: false,
      }),
    );
    expect(mockCalls.findTemplatesGrantingFeature).toHaveLength(3);
  });

  test("EVERY downgrade is probed — no short-circuit once one impact is found", async () => {
    mockState.templateImpactsByRole = {
      staff: [{ id: 7, name: "Staff Default", module: "crm", capability: "view" }],
    };
    const res = await route.PUT(
      jsonReq({ changes: [downgrade("staff"), downgrade("member")] }),
    );
    expect(res.status).toBe(409);
    // Current shape: the loop does NOT break on the first impact, so it pays a
    // probe per downgrade and reports every impacted one in one round trip.
    // Pinned so the block-f extraction cannot silently change it.
    expect(mockCalls.findTemplatesGrantingFeature).toEqual([
      { role: "staff", feature: FEATURE },
      { role: "member", feature: FEATURE },
    ]);
    expect(upsertEligibilityRow).not.toHaveBeenCalled();
  });
});