/**
 * Characterisation net for the decisions that live inside
 * `src/app/api/access-profiles/route.js` today.
 *
 * These assertions pin the BEHAVIOUR before the logic moves to
 * `@/services/authorization/accessProfileWrites.js` (corridor L5, block a):
 * the capability normalisation, the role-default write gate, the eligibility
 * boundary and the three DELETE reference guards, including their ORDER.
 *
 * The real `@/models/authorization` SQL runs against a mocked `@/lib/db`, so the
 * statements asserted here are the ones the route actually causes.
 */

const mockExecuted = [];

const mockState = {
  roleDefaultRows: [], // getRoleDefaultRefs / getRoleDefaultRoles / getRoleDefaultsForProfile
  roleEligibilityRows: [], // getRoleEligibilityRows
  assignedCount: 0, // countProfileUsers
  assignedNames: [], // listProfileAssignedNames
  impactContext: 0, // getProfileImpactCounts.contextBindings
  contextRoles: [], // getProfileImpactCounts.contextRoles
  profileName: "Some Profile",
  profileMeta: [{ id: 2, name: "Some Profile" }],
};

function mockRows(sql) {
  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sql)) return { rows: [] };
  if (sql.includes("FROM context_role_profiles")) return { rows: mockState.contextRoles };
  if (sql.includes("SELECT COUNT(*) AS n FROM contacts WHERE access_profile_id"))
    return { rows: [{ n: 0 }] };
  if (sql.includes("SELECT COUNT(*) AS n FROM contacts c")) return { rows: [{ n: 0 }] };
  if (sql.includes("SELECT COUNT(*) as cnt FROM contacts"))
    return { rows: [{ cnt: mockState.assignedCount }] };
  if (sql.includes("SELECT name FROM contacts"))
    return { rows: mockState.assignedNames.map((name) => ({ name })) };
  if (sql.includes("FROM role_access_profile_defaults")) return { rows: mockState.roleDefaultRows };
  if (sql.includes("FROM feature_eligibility")) return { rows: mockState.roleEligibilityRows };
  if (/INSERT INTO access_profiles/i.test(sql)) return { rows: [{ id: 2 }], rowsAffected: 1 };
  if (sql.includes("FROM access_profiles WHERE id = ?"))
    return { rows: mockState.profileMeta };
  return { rows: [], rowsAffected: 1 };
}

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (query) => {
      const sql = String(typeof query === "string" ? query : query?.sql || "");
      const args = (typeof query === "string" ? [] : query?.args) || [];
      mockExecuted.push({ sql, args });
      return mockRows(sql);
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "SA-1", name: "Super Admin" }),
  logPermissionAudit: jest.fn().mockResolvedValue(true),
  // The production vocabulary, not a hand-written copy: the normalisation rule
  // reads it to decide whether a module carries `view`.
  PERMISSION_MODULES: jest.requireActual("@/server/authz/capabilities").PERMISSION_MODULES,
}));

jest.mock("@/server/authz/responses", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
  requireScopedAccess: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/services/authorization/context", () => ({
  // The real eligibility machinery (MODULE_TO_FEATURE, evaluateEligibility,
  // validateCapabilitiesWithinEligibility) is kept: the boundary being pinned
  // is a real decision, not a stub. Only the cache entry points are faked.
  ...jest.requireActual("@/services/authorization/context"),
  invalidateAllAuthorizationContexts: jest.fn(),
  invalidateAuthorizationContext: jest.fn(),
}));

const profilesRoute = require("@/app/api/access-profiles/route");

const postReq = (body) =>
  new Request("http://localhost/api/access-profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const putReq = (body) =>
  new Request("http://localhost/api/access-profiles", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const delReq = (id) =>
  new Request(`http://localhost/api/access-profiles?id=${id}`, { method: "DELETE" });

const inserts = () =>
  mockExecuted
    .filter((entry) => /INSERT INTO access_profile_capabilities/i.test(entry.sql))
    .map((entry) => entry.args.map((value) => String(value)));

const saw = (fragment) => mockExecuted.some((entry) => entry.sql.includes(fragment));

beforeEach(() => {
  mockExecuted.length = 0;
  Object.assign(mockState, {
    roleDefaultRows: [],
    roleEligibilityRows: [],
    assignedCount: 0,
    assignedNames: [],
    impactContext: 0,
    contextRoles: [],
    profileName: "Some Profile",
    profileMeta: [{ id: 2, name: "Some Profile" }],
  });
  jest.clearAllMocks();
});

describe("capability normalisation — POST", () => {
  test("edit/create/delete imply view (level 1) in a module that carries view", async () => {
    const res = await profilesRoute.POST(
      postReq({ name: "P", capabilities: { projects: { edit: 2, create: 1 } } }),
    );
    expect(res.status).toBe(200);
    const rows = inserts();
    // The implied `view` is persisted alongside the requested capabilities.
    expect(rows).toEqual(
      expect.arrayContaining([["2", "projects", "create", "1"], ["2", "projects", "edit", "2"]]),
    );
    expect(rows.some((row) => row[1] === "projects" && row[2] === "view" && row[3] === "1")).toBe(true);
  });

  test("a module absent from the vocabulary is persisted as-is, WITHOUT an implied view", async () => {
    // Every real module carries `view`; the `supportsView === false` branch is
    // only reachable through a payload naming an unknown module — and it stays
    // reachable (the API does not reject unknown module names).
    await profilesRoute.POST(postReq({ name: "P", capabilities: { mystery_module: { edit: 2 } } }));
    const rows = inserts();
    expect(rows).toEqual([["2", "mystery_module", "edit", "2"]]);
    expect(rows.some((row) => row[2] === "view")).toBe(false);
  });

  test("zero rows are dropped — a module with only zeros writes nothing", async () => {
    await profilesRoute.POST(postReq({ name: "P", capabilities: { projects: { view: 0, edit: 0 } } }));
    expect(inserts()).toEqual([]);
  });

  test("a lone `view: 1` is kept as-is (no doubling, no drop)", async () => {
    await profilesRoute.POST(postReq({ name: "P", capabilities: { projects: { view: 1 } } }));
    expect(inserts()).toEqual([["2", "projects", "view", "1"]]);
  });
});

describe("role-default write gate — PUT is_active", () => {
  test("a profile that is a role default cannot be disabled → 400, no UPDATE", async () => {
    mockState.roleDefaultRows = [{ role_name: "staff" }];
    const res = await profilesRoute.PUT(putReq({ id: 2, is_active: 0 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(String(body.error)).toMatch(/staff/);
    expect(saw("UPDATE access_profiles SET is_active")).toBe(false);
  });

  test("enabling it again is allowed (the gate is on disabling only)", async () => {
    mockState.roleDefaultRows = [{ role_name: "staff" }];
    const res = await profilesRoute.PUT(putReq({ id: 2, is_active: 1 }));
    expect(res.status).toBe(200);
    expect(saw("UPDATE access_profiles SET is_active")).toBe(true);
  });
});

describe("eligibility boundary — PUT capabilities on a role-default profile", () => {
  test("a capability whose feature the default role is NOT eligible for → 400, nothing written", async () => {
    mockState.roleDefaultRows = [{ role_name: "staff" }];
    // No eligibility row for `projects` → fail closed → the edit is refused.
    mockState.roleEligibilityRows = [];

    const res = await profilesRoute.PUT(
      putReq({ id: 2, capabilities: { projects: { edit: 2 } } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("errors.ineligibleTemplateCaps");
    expect(body.role).toBe("staff");
    // The refusal happens BEFORE any write: no clear, no insert.
    expect(saw("DELETE FROM access_profile_capabilities")).toBe(false);
    expect(inserts()).toEqual([]);
  });

  test("eligible for the feature → 200, clear-then-replace in that order", async () => {
    mockState.roleDefaultRows = [{ role_name: "staff" }];
    // The boundary is per FEATURE, not per module: `projects` maps to the
    // `operations` dashboard feature.
    mockState.roleEligibilityRows = [{ feature_key: "operations", eligible: 1 }];

    const res = await profilesRoute.PUT(
      putReq({ id: 2, capabilities: { projects: { edit: 2 } } }),
    );
    expect(res.status).toBe(200);

    const clearIndex = mockExecuted.findIndex((entry) =>
      entry.sql.includes("DELETE FROM access_profile_capabilities"),
    );
    const firstInsertIndex = mockExecuted.findIndex((entry) =>
      /INSERT INTO access_profile_capabilities/i.test(entry.sql),
    );
    expect(clearIndex).toBeGreaterThanOrEqual(0);
    expect(firstInsertIndex).toBeGreaterThan(clearIndex); // replace AFTER the clear
    // The implied view is persisted here too — same rule as POST.
    expect(inserts().some((row) => row[1] === "projects" && row[2] === "view")).toBe(true);
  });

  test("no role default → the eligibility boundary does not apply", async () => {
    mockState.roleDefaultRows = [];
    mockState.roleEligibilityRows = [];

    const res = await profilesRoute.PUT(
      putReq({ id: 2, capabilities: { projects: { edit: 2 } } }),
    );
    expect(res.status).toBe(200);
    expect(inserts().length).toBeGreaterThan(0);
  });
});

describe("DELETE reference guards — order matters", () => {
  test("role default wins over the other two refs (checked first)", async () => {
    mockState.roleDefaultRows = [{ role_name: "staff" }];
    mockState.assignedCount = 5;
    mockState.contextRoles = [{ context: "program", role_key: "program_manager" }];

    const res = await profilesRoute.DELETE(delReq(2));
    const body = await res.json();
    expect(body.error).toBe("profile_in_use_role_default");
    // The people and context counts were not even consulted.
    expect(saw("SELECT COUNT(*) as cnt FROM contacts")).toBe(false);
    expect(saw("FROM context_role_profiles")).toBe(false);
  });

  test("assigned people win over context bindings", async () => {
    mockState.roleDefaultRows = [];
    mockState.assignedCount = 2;
    mockState.assignedNames = ["A B", "C D"];
    mockState.contextRoles = [{ context: "venture", role_key: "founder" }];

    const res = await profilesRoute.DELETE(delReq(2));
    const body = await res.json();
    expect(body.error).toBe("profile_in_use_assignments");
    expect(body.assignedCount).toBe(2);
    expect(body.assignedNames).toEqual(["A B", "C D"]);
  });

  test("nothing references it → deletes", async () => {
    mockState.roleDefaultRows = [];
    mockState.assignedCount = 0;
    mockState.contextRoles = [];

    const res = await profilesRoute.DELETE(delReq(2));
    expect(res.status).toBe(200);
    expect(saw("DELETE FROM access_profiles")).toBe(true);
  });
});