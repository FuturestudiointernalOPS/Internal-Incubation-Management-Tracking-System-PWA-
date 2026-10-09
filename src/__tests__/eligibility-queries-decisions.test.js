/**
 * Eligibility configuration route — the READ decisions.
 *
 * Characterization tests for the eligibility configuration route's DECISIONS,
 * written BEFORE moving them out of `eligibility/route.js`.
 *
 * Why this file exists: `permissions-admin-api.test.js` covers the HTTP
 * boundary of this route (gate, upsert, unset, C2 409), but it mocks
 * `@/lib/authorization` WITHOUT `ELIGIBILITY_IDENTITIES` and
 * `ELIGIBILITY_IDENTITY_GROUPS`. Both are `undefined` there, so `roles` and
 * `identityGroups` have never been exercised — the GET decisions extracted
 * here. Everything asserted is read from the REAL service constants so the
 * passthrough is pinned against them.
 *
 * The model layer is mocked (not the SQL) so the WHERE-free reads and the
 * previous-value read stay observable as calls. The wiring lives in
 * ./helpers/eligibilityRouteMocks; the write side is in
 * eligibility-queries-decisions.writes.test.js.
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
jest.mock("@/models/authorization/profileCapabilitiesStore", () => mockElig.profileCapabilitiesStoreMock());

const { authorize: authorizeContextModule } = require("@/services/authorization/context");
const { requireAuthorization } = require("@/server/authz/responses");
const {
  getAuthorizationContext,
} = require("@/services/authorization/context");
const {
  ELIGIBILITY_IDENTITIES,
  ELIGIBILITY_IDENTITY_GROUPS,
  FEATURE_KEYS,
  IDENTITY_TYPES,
} = require("@/services/authorization/eligibilityAdmin");
const {
  listFeatureEligibilityRows,
} = require("@/models/authorization");
const { getSession } = require("@/server/auth/session");
const route = require("@/app/api/engineering/permissions/eligibility/route");

const { mockState, resetState, realEligibility } = require("./helpers/eligibilityRouteMocks");

const FEATURE = FEATURE_KEYS[0];

beforeEach(() => {
  resetState();
  jest.clearAllMocks();
});

describe("GET — read gate and the canConfigure flag", () => {
  test("requires permissions.view_matrix (not configure_eligibility)", async () => {
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  });

  test("canConfigure is a SOFT flag: authorize() is asked, the read still succeeds", async () => {
    mockState.canConfigure = false;
    const res = await route.GET();
    // The weak gate: a viewer without configure_eligibility still gets the
    // whole catalog — only the flag flips, so the UI can grey out the writes.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canConfigure).toBe(false);
    expect(body.features.length).toBeGreaterThan(0);
  });

  test("canConfigure is coerced to a real boolean, never null/undefined", async () => {
    mockState.canConfigure = undefined;
    const body = await (await route.GET()).json();
    expect(body.canConfigure).toBe(false);
    expect(typeof body.canConfigure).toBe("boolean");
  });

  test("the gate is evaluated against the CONTEXT derived from the session", async () => {
    mockState.session = { cid: "STAFF-9", name: "Staff Nine" };
    mockState.context = { isSuperAdmin: false, eligibility: { crm: true } };
    mockState.canConfigure = true;

    await route.GET();

    expect(getSession).toHaveBeenCalled();
    expect(getAuthorizationContext).toHaveBeenCalledWith(mockState.session);
    // The service resolves `authorize` from ./context, so assert on THAT
    // module's spy — the barrel mock is bypassed by design.
    expect(authorizeContextModule).toHaveBeenCalledWith(
      mockState.context,
      "permissions",
      "configure_eligibility",
    );
  });

  test("a denied read returns the gate error verbatim and reads nothing", async () => {
    mockState.authzDecision = new Response(JSON.stringify({ success: false }), { status: 403 });
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

  test("identityGroups carries the baseline identities", async () => {
    const body = await (await route.GET()).json();
    expect(body.identityGroups).toEqual(ELIGIBILITY_IDENTITY_GROUPS);
    expect(body.identityGroups.identities).toContain("staff");
    // Contextual functions are profiles now, never role identities.
    expect(body.identityGroups.contextRoles).toBeUndefined();
  });

  test("features / identityTypes / moduleToFeature are the engine's own vocabulary", async () => {
    const body = await (await route.GET()).json();
    expect(body.features).toEqual(FEATURE_KEYS);
    expect(body.identityTypes).toEqual(IDENTITY_TYPES);
    expect(body.moduleToFeature).toEqual(realEligibility().MODULE_TO_FEATURE);
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

describe("GET — the identity vocabulary is baseline roles + profiles only", () => {
  test("roles is exactly the three baseline identities", async () => {
    const body = await (await route.GET()).json();
    expect(body.roles).toEqual(["super_admin", "staff", "member"]);
    expect(body.roles).toEqual(ELIGIBILITY_IDENTITIES);
  });

  test("no roles-from-the-database are surfaced any more", async () => {
    const body = await (await route.GET()).json();
    expect(body.extraRoles).toBeUndefined();
    expect(body.groups).toBeUndefined();
  });

  test("the identity kinds are role and profile", async () => {
    const body = await (await route.GET()).json();
    expect(body.identityTypes).toEqual(["role", "profile"]);
  });
});
