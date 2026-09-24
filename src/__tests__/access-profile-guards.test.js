/**
 * Guard tests for the access-profile lifecycle APIs:
 *  - getProfileImpactCounts reports context bindings separately from people
 *  - DELETE is blocked while a profile is still referenced (assigned users,
 *    context-role mappings) and still blocked by role defaults
 *  - PUT /api/access-profiles/assign refuses (409) to strip capabilities
 *    unless the caller confirms
 *
 * Mocks @/lib/db's `execute` and @/lib/auth, mirroring the mocking approach in
 * permissions-admin-api.test.js. SQL lives in @/models/authorization (not
 * mocked), so these tests also exercise the real queries.
 */

const mockExecuted = []; // { sql, args } — every statement the model layer ran

const mockState = {
  // GET/DELETE /api/access-profiles
  roleDefaults: [], // [{ role_name }] — getRoleDefaultsForProfile
  assignedCount: 0, // countProfileUsers
  assignedNames: [], // listProfileAssignedNames
  impactDirect: 0, // getProfileImpactCounts — direct
  impactRoleDefault: 0, // getProfileImpactCounts — roleDefault
  contextRoles: [], // getProfileImpactCounts — context_role_profiles rows
  profileName: "Some Profile",
  // PUT /api/access-profiles/assign
  contact: null, // { cid, name, role, access_profile_id }
  activeProfile: null, // { id, name } — the profile being assigned
  overrideProfile: null, // { id, name } — the contact's current override
  profileCaps: [], // caps of the profile being assigned
  currentProfileCaps: [], // caps of the contact's current override profile
  roleCaps: [], // legacy role_capabilities rows
};

function mockRows(sql, args) {
  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sql)) return { rows: [] };

  if (sql.includes("FROM context_role_profiles")) return { rows: mockState.contextRoles };

  // getProfileImpactCounts — people counts
  if (sql.includes("SELECT COUNT(*) AS n FROM contacts WHERE access_profile_id"))
    return { rows: [{ n: mockState.impactDirect }] };
  if (sql.includes("SELECT COUNT(*) AS n FROM contacts c"))
    return { rows: [{ n: mockState.impactRoleDefault }] };

  // countProfileUsers / listProfileAssignedNames (both scoped to live contacts)
  if (sql.includes("SELECT COUNT(*) as cnt FROM contacts"))
    return { rows: [{ cnt: mockState.assignedCount }] };
  if (sql.includes("SELECT name FROM contacts"))
    return { rows: mockState.assignedNames.map((name) => ({ name })) };

  if (sql.includes("FROM role_access_profile_defaults")) return { rows: mockState.roleDefaults };

  // getProfileCapabilities (the new profile) vs the override profile's caps
  if (sql.includes("FROM access_profile_capabilities WHERE profile_id")) {
    if (
      mockState.contact?.access_profile_id != null &&
      Number(args[0]) === Number(mockState.contact.access_profile_id)
    ) {
      return { rows: mockState.currentProfileCaps };
    }
    return { rows: mockState.profileCaps };
  }
  if (sql.includes("FROM role_capabilities WHERE role")) return { rows: mockState.roleCaps };

  if (sql.includes("FROM contacts WHERE cid"))
    return { rows: mockState.contact ? [mockState.contact] : [] };

  // Active-profile lookups: the assigned profile vs the contact's override.
  if (sql.includes("FROM access_profiles WHERE id = ? AND is_active = 1")) {
    if (
      mockState.contact?.access_profile_id != null &&
      Number(args[0]) === Number(mockState.contact.access_profile_id)
    ) {
      return { rows: mockState.overrideProfile ? [mockState.overrideProfile] : [] };
    }
    return { rows: mockState.activeProfile ? [mockState.activeProfile] : [] };
  }
  if (sql.includes("FROM access_profiles WHERE id = ?"))
    return { rows: [{ id: args[0], name: mockState.profileName }] };

  return { rows: [], rowsAffected: 1 };
}

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (query) => {
      const sql = String(typeof query === "string" ? query : query?.sql || "");
      const args = (typeof query === "string" ? [] : query?.args) || [];
      mockExecuted.push({ sql, args });
      return mockRows(sql, args);
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "SA-1", name: "Super Admin" }),
  logPermissionAudit: jest.fn().mockResolvedValue(true),
  PERMISSION_MODULES: {},
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
  assertTemplateCapsEligible: jest.fn().mockResolvedValue({ valid: true, violations: [] }),
  invalidateAllAuthorizationContexts: jest.fn(),
  invalidateAuthorizationContext: jest.fn(),
}));

const profilesRoute = require("@/app/api/access-profiles/route");
const assignRoute = require("@/app/api/access-profiles/assign/route");
const { getProfileImpactCounts } = require("@/models/authorization");

const delReq = (id) =>
  new Request(`http://localhost/api/access-profiles?id=${id}`, { method: "DELETE" });

const assignReq = (body) =>
  new Request("http://localhost/api/access-profiles/assign", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const sawStatement = (fragment) =>
  mockExecuted.some((entry) => entry.sql.includes(fragment));

beforeEach(() => {
  mockExecuted.length = 0;
  Object.assign(mockState, {
    roleDefaults: [],
    assignedCount: 0,
    assignedNames: [],
    impactDirect: 0,
    impactRoleDefault: 0,
    contextRoles: [],
    profileName: "Some Profile",
    contact: null,
    activeProfile: null,
    overrideProfile: null,
    profileCaps: [],
    currentProfileCaps: [],
    roleCaps: [],
  });
  jest.clearAllMocks();
});

describe("getProfileImpactCounts — context bindings", () => {
  test("reports context bindings beside people counts, never folded into total", async () => {
    mockState.impactDirect = 2;
    mockState.impactRoleDefault = 3;
    mockState.contextRoles = [
      { context: "program", role_key: "program_manager" },
      { context: "venture", role_key: "founder" },
    ];

    const impact = await getProfileImpactCounts(42);

    expect(impact).toEqual({
      profile_id: 42,
      direct: 2,
      roleDefault: 3,
      total: 5, // people only
      contextBindings: 2, // mappings only
      contextRoles: ["program:program_manager", "venture:founder"],
    });
  });
});

describe("DELETE /api/access-profiles — reference guards", () => {
  test("blocked while users still reference the profile → 400, no delete", async () => {
    mockState.assignedCount = 3;
    mockState.assignedNames = ["Josias Hinnakou", "Alice Doe", "Bob Roe"];

    const res = await profilesRoute.DELETE(delReq(5));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("profile_in_use_assignments");
    expect(body.assignedCount).toBe(3);
    expect(body.assignedNames).toEqual(["Josias Hinnakou", "Alice Doe", "Bob Roe"]);
    expect(sawStatement("DELETE FROM access_profiles")).toBe(false);
  });

  test("blocked while context roles still map to the profile → 400, no delete", async () => {
    mockState.assignedCount = 0;
    mockState.contextRoles = [{ context: "program", role_key: "program_manager" }];

    const res = await profilesRoute.DELETE(delReq(5));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("profile_in_use_context");
    expect(body.contextCount).toBe(1);
    expect(body.contextRoles).toEqual(["program:program_manager"]);
    expect(sawStatement("DELETE FROM access_profiles")).toBe(false);
  });

  test("still blocked by role defaults (now a structured refusal)", async () => {
    mockState.roleDefaults = [{ role_name: "staff" }];

    const res = await profilesRoute.DELETE(delReq(5));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    // The three refusals share one shape: a machine key the UI localises, the
    // roles involved, and the human sentence for logs.
    expect(body.error).toBe("profile_in_use_role_default");
    expect(body.roles).toEqual(["staff"]);
    expect(String(body.message)).toMatch(/default for role/i);
    expect(sawStatement("DELETE FROM access_profiles")).toBe(false);
  });

  test("deletes when nothing references the profile", async () => {
    const res = await profilesRoute.DELETE(delReq(5));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(sawStatement("DELETE FROM access_profiles")).toBe(true);
  });
});

describe("PUT /api/access-profiles/assign — capability-loss guard", () => {
  // A profile-less role with 28 legacy capabilities — the "silent strip" case.
  const legacyCaps = Array.from({ length: 28 }, (_, i) => ({
    module: "reports",
    capability: `cap_${i}`,
    access_level: 1,
  }));

  test("empty profile without confirm → 409 requiresConfirmation, no UPDATE", async () => {
    mockState.contact = { cid: "U-1", name: "Dev Intern", role: "intern", access_profile_id: null };
    mockState.activeProfile = { id: 5, name: "Dev Interns" };
    mockState.roleCaps = legacyCaps;
    mockState.profileCaps = [];

    const res = await assignRoute.PUT(assignReq({ user_cid: "U-1", profile_id: 5 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.requiresConfirmation).toBe(true);
    expect(body.error).toBe("profile_assignment_empty_profile");
    expect(body.loss.currentSource).toBe("legacy");
    expect(body.loss.currentProfileName).toBeNull();
    expect(body.loss.currentCount).toBe(28);
    expect(body.loss.newProfileName).toBe("Dev Interns");
    expect(body.loss.newCount).toBe(0);
    expect(body.loss.removedCount).toBe(28);
    expect(body.loss.gainedCount).toBe(0);
    expect(body.loss.removed.length).toBe(25); // payload capped, count stays 28
    expect(sawStatement("UPDATE contacts SET access_profile_id")).toBe(false);
  });

  test("same empty profile WITH confirm:true → 200 and the UPDATE runs", async () => {
    mockState.contact = { cid: "U-1", name: "Dev Intern", role: "intern", access_profile_id: null };
    mockState.activeProfile = { id: 5, name: "Dev Interns" };
    mockState.roleCaps = legacyCaps;
    mockState.profileCaps = [];

    const res = await assignRoute.PUT(
      assignReq({ user_cid: "U-1", profile_id: 5, confirm: true }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(sawStatement("UPDATE contacts SET access_profile_id")).toBe(true);
  });

  test("a profile that only adds capabilities → 200, no confirmation", async () => {
    mockState.contact = { cid: "U-1", name: "Staffer", role: "staff", access_profile_id: null };
    mockState.activeProfile = { id: 6, name: "Staff Plus" };
    mockState.roleCaps = [{ module: "reports", capability: "view", access_level: 1 }];
    mockState.profileCaps = [
      { module: "reports", capability: "view", access_level: 1 },
      { module: "reports", capability: "export", access_level: 2 },
    ];

    const res = await assignRoute.PUT(assignReq({ user_cid: "U-1", profile_id: 6 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(sawStatement("UPDATE contacts SET access_profile_id")).toBe(true);
  });

  test("a narrower profile → 409 with the removed capabilities listed", async () => {
    mockState.contact = {
      cid: "U-2",
      name: "Program Manager",
      role: "program_manager",
      access_profile_id: 10,
    };
    mockState.overrideProfile = { id: 10, name: "PM Full" };
    mockState.currentProfileCaps = [
      { module: "projects", capability: "view", access_level: 1 },
      { module: "projects", capability: "edit", access_level: 2 },
    ];
    mockState.activeProfile = { id: 11, name: "PM Lite" };
    mockState.profileCaps = [{ module: "projects", capability: "view", access_level: 1 }];

    const res = await assignRoute.PUT(assignReq({ user_cid: "U-2", profile_id: 11 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("profile_assignment_removes_capabilities");
    expect(body.loss.currentSource).toBe("profile");
    expect(body.loss.currentProfileName).toBe("PM Full");
    expect(body.loss.currentCount).toBe(2);
    expect(body.loss.newCount).toBe(1);
    expect(body.loss.removedCount).toBe(1);
    expect(body.loss.gainedCount).toBe(0);
    expect(body.loss.removed).toEqual([
      { module: "projects", capability: "edit", level: 2 },
    ]);
    expect(sawStatement("UPDATE contacts SET access_profile_id")).toBe(false);
  });
});
