/**
 * Eligibility configuration route — the WRITE decisions.
 *
 * Characterization tests for the eligibility configuration route's DECISIONS,
 * written BEFORE moving them out of `eligibility/route.js`.
 *
 * The read side — the read gate, the roles/identityGroups list and the
 * extraRoles derivation — is in eligibility-queries-decisions.test.js; the HTTP
 * boundary itself is covered by `permissions-admin-api.test.js`.
 *
 * The model layer is mocked (not the SQL) so the previous-value read, the
 * write choice and the audit trail stay observable as calls. The wiring lives
 * in ./helpers/eligibilityRouteMocks.
 */

const mockElig = require("./helpers/eligibilityRouteMocks");

jest.mock("@/lib/db", () => mockElig.dbMock());
jest.mock("@/services/authorization/context", () => mockElig.authorizationContextMock());
jest.mock("@/server/authz/responses", () => mockElig.responsesMock());
jest.mock("@/services/authorization/eligibilityAdmin", () => mockElig.eligibilityAdminMock());
jest.mock("@/server/auth/session", () => ({ getSession: mockElig.authMock().getSession }));
jest.mock("@/models/authorization/accessQueries", () => {
  const m = mockElig.authMock();
  return { logPermissionAudit: m.logPermissionAudit, getUserGroups: m.getUserGroups };
});
jest.mock("@/models/authorization/bootstrap", () => {
  const m = mockElig.authMock();
  return {
    ensurePermissionsSchema: m.ensurePermissionsSchema,
    seedDefaultRoleCapabilities: m.seedDefaultRoleCapabilities,
    ensureResponsibilitiesSchema: m.ensureResponsibilitiesSchema,
    seedDefaultResponsibilities: m.seedDefaultResponsibilities,
  };
});
jest.mock("@/services/authorization/accessProfiles", () => ({ getUserEffectiveProfile: mockElig.authMock().getUserEffectiveProfile }));
jest.mock("@/models/authorization", () => mockElig.authorizationModelMock());

const {
  requireAuthorization,
} = require("@/server/authz/responses");
const {
  invalidateAllAuthorizationContexts,
} = require("@/services/authorization/context");
const { FEATURE_KEYS } = require("@/services/authorization/eligibilityAdmin");
const {
  listFeatureEligibilityRows,
} = require("@/models/authorization");
const {
  getEligibilityRow,
  deleteEligibilityRow,
  upsertEligibilityRow,
} = require("@/models/authorization");
const { getSession } = require("@/server/auth/session");
const route = require("@/app/api/engineering/permissions/eligibility/route");

const { mockState, resetState } = require("./helpers/eligibilityRouteMocks");

const FEATURE = FEATURE_KEYS[0];

beforeEach(() => {
  resetState();
  jest.clearAllMocks();
});

const jsonReq = (body) =>
  new Request("http://localhost/api/engineering/permissions/eligibility", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PUT — write gate", () => {
  test("requires permissions.configure_eligibility, the dedicated authority", async () => {
    await route.PUT(jsonReq({ changes: [] }));
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "configure_eligibility");
  });

  test("a denied write returns the gate error and touches nothing", async () => {
    mockState.authzDecision = new Response(JSON.stringify({ success: false }), { status: 403 });
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
    expect(mockState.auditEntries.map((e) => e.actorCid)).toEqual(["SA-1", "SA-1", "SA-1"]);
  });
});

describe("PUT — the audit trail says what the value became", () => {
  test("one audit entry per change, target system, action eligibility_changed", async () => {
    mockState.priorRow = { eligible: 0 };
    await route.PUT(jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: 1 }] }));

    expect(mockState.auditEntries).toHaveLength(1);
    const entry = mockState.auditEntries[0];
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
    expect(mockState.auditEntries[0].details).toBe(`${FEATURE} role:staff unset → unset`);
  });

  test("a group change is audited with its own identity_type", async () => {
    await route.PUT(jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "group", identity_value: "TEAM A", eligible: 0 }] }));
    expect(mockState.auditEntries[0].targetName).toBe("group:TEAM A");
    expect(mockState.auditEntries[0].details).toContain("group:TEAM A");
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
    expect(mockState.findTemplatesGrantingFeature).toEqual([{ role: "member", feature: FEATURE }]);
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
    expect(mockState.auditEntries).toHaveLength(0);
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
    expect(mockState.findTemplatesGrantingFeature).toHaveLength(0);
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

    mockState.findTemplatesGrantingFeature.length = 0;
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
    expect(mockState.findTemplatesGrantingFeature).toHaveLength(0);
  });

  test("an eligible NULL on a role is a downgrade and is probed like a 0", async () => {
    mockState.templateImpactsByRole = { staff: [{ id: 7, name: "Staff Default", module: "crm", capability: "view" }] };
    const res = await route.PUT(
      jsonReq({ changes: [{ feature_key: FEATURE, identity_type: "role", identity_value: "staff", eligible: null }] }),
    );
    expect(res.status).toBe(409);
    expect(mockState.findTemplatesGrantingFeature).toEqual([{ role: "staff", feature: FEATURE }]);
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
    expect(mockState.findTemplatesGrantingFeature).toHaveLength(3);
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
    expect(mockState.findTemplatesGrantingFeature).toEqual([
      { role: "staff", feature: FEATURE },
      { role: "member", feature: FEATURE },
    ]);
    expect(upsertEligibilityRow).not.toHaveBeenCalled();
  });
});
