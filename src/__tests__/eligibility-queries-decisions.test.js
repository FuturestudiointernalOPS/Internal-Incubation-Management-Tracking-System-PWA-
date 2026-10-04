/**
 * Eligibility configuration route — the READ decisions.
 *
 * Characterization tests for the eligibility configuration route's DECISIONS,
 * written BEFORE moving them out of `eligibility/route.js`.
 *
 * Why this file exists: `permissions-admin-api.test.js` covers the HTTP
 * boundary of this route (gate, upsert, unset, C2 409), but it mocks
 * `@/lib/authorization` WITHOUT `ELIGIBILITY_IDENTITIES` and
 * `ELIGIBILITY_IDENTITY_GROUPS`. Both are `undefined` there, so `roles`,
 * `identityGroups` and `extraRoles` have never been exercised — the three GET
 * decisions extracted here. Everything asserted is read from the REAL service
 * constants so the derivation is pinned against them.
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
jest.mock("@/lib/auth", () => mockElig.authMock());
jest.mock("@/models/authorization", () => mockElig.authorizationModelMock());

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
  listEligibilityRoleIdentities,
  listRoleAccessProfileDefaults,
} = require("@/models/authorization");
const { getSession } = require("@/lib/auth");
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
