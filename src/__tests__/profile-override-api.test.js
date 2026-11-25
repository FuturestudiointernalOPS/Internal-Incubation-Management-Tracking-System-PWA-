/**
 * A1 — per-person profile override API (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * The on-person "replace profile" action, now by PROFILE KEY. The real model SQL
 * runs against a mocked database, so the statements asserted are the ones the
 * route actually causes.
 */

const mockExecuted = [];

const mockState = {
  session: { cid: "SA-1", name: "Super Admin" },
  contact: null, // { cid, name, role, profile_key }
  profile: null, // { key, label } — the profile being assigned
  profileRow: null, // { key, allowed_roles, is_active } — for the role gate
  currentProfileKey: null,
  currentCaps: [],
  newCaps: [],
  eligibility: { valid: true, violations: [] },
  roleDefaultRow: null,
  // Optional per-role stubs for the GET path: a role with no entry here reads
  // as "no default", exactly like an unmapped stored label.
  roleDefaultByRole: null,
  roleMappingByRole: null,
};

function mockRows(sql, args = []) {
  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sql)) return { rows: [] };
  // getProfileRow — the profile's allowed_roles, read by the profile ↔ role gate.
  if (sql.includes("allowed_roles") && sql.includes("FROM profiles"))
    return { rows: mockState.profileRow ? [mockState.profileRow] : [] };
  if (sql.includes("SELECT cid, name, role, profile_key FROM contacts"))
    return { rows: mockState.contact ? [mockState.contact] : [] };
  if (sql.includes("SELECT role, profile_key FROM contacts"))
    return { rows: mockState.contact ? [mockState.contact] : [] };
  if (sql.includes("FROM profiles WHERE key = ? AND is_active = 1"))
    return { rows: mockState.profile ? [{ key: mockState.profile.key, label: mockState.profile.label }] : [] };
  if (sql.includes("SELECT key, label FROM profiles WHERE key = ?"))
    return { rows: mockState.profile ? [{ key: mockState.profile.key, label: mockState.profile.label }] : [] };
  if (sql.includes("SELECT group_name FROM user_groups")) return { rows: [] };
  // base-capability resolution (UNION queries come FIRST).
  if (sql.includes("FROM role_profile_defaults rpd") && sql.includes("UNION ALL"))
    return { rows: [] };
  if (sql.includes("FROM profiles p") && sql.includes("UNION ALL")) return { rows: [] };
  if (sql.includes("FROM role_profile_defaults rpd")) {
    if (mockState.roleDefaultByRole) {
      const row = mockState.roleDefaultByRole[args[0]];
      return { rows: row ? [row] : [] };
    }
    return { rows: mockState.roleDefaultRow ? [mockState.roleDefaultRow] : [] };
  }
  // getRoleProfileDefault — the RAW mapping, before the active-profile join.
  // Used to tell "no mapping at all" (fall back to member) apart from "mapped
  // but deactivated" (a real configuration gap).
  if (sql.includes("FROM role_profile_defaults WHERE role_name = ?")) {
    const row = mockState.roleMappingByRole?.[args[0]];
    return { rows: row ? [row] : [] };
  }
  if (sql.includes("FROM profile_capabilities WHERE profile_key")) {
    return {
      rows:
        mockState.currentProfileKey && args[0] === mockState.currentProfileKey
          ? mockState.currentCaps
          : mockState.newCaps,
    };
  }
  if (sql.includes("FROM access_profile_capabilities WHERE profile_id")) return { rows: [] };
  return { rows: [], rowsAffected: 1 };
}

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (query) => {
      const sql = String(typeof query === "string" ? query : query?.sql || "");
      const args = typeof query === "string" ? [] : query?.args || [];
      mockExecuted.push(sql);
      return mockRows(sql, args);
    }),
  },
  initDb: jest.fn(async () => true),
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => mockState.session),
}));
jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn(async () => true),
}));
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
  invalidateAuthorizationContext: jest.fn(),
  invalidateAllAuthorizationContexts: jest.fn(),
}));
jest.mock("@/services/authorization/eligibilityAdmin", () => ({
  ...jest.requireActual("@/services/authorization/eligibilityAdmin"),
  assertTemplateCapsEligible: jest.fn(async () => mockState.eligibility),
}));

const route = require("@/app/api/engineering/permissions/profile-override/route");

const putReq = (body) => ({ json: async () => body });
const sawAssign = () => mockExecuted.some((sql) => sql.includes("UPDATE contacts SET profile_key = ?"));
const sawClear = () => mockExecuted.some((sql) => sql.includes("UPDATE contacts SET profile_key = NULL"));

beforeEach(() => {
  mockExecuted.length = 0;
  Object.assign(mockState, {
    session: { cid: "SA-1", name: "Super Admin" },
    contact: { cid: "U-2", name: "Target", role: "member", profile_key: null },
    profile: { key: "founder", label: "Founder" },
    profileRow: { key: "founder", allowed_roles: ["member"], is_active: 1 },
    currentProfileKey: null,
    currentCaps: [],
    newCaps: [],
    eligibility: { valid: true, violations: [] },
    roleDefaultRow: null,
  });
});

test("nobody changes their own profile, not even a Super Admin → 403", async () => {
  mockState.session = { cid: "U-2", name: "Target" };
  const res = await route.PUT(putReq({ user_cid: "U-2", profile_key: "founder" }));
  expect(res.status).toBe(403);
  expect(sawAssign()).toBe(false);
});

test("an unknown user is 404 and an unknown profile is 404", async () => {
  mockState.contact = null;
  expect((await route.PUT(putReq({ user_cid: "GHOST", profile_key: "founder" }))).status).toBe(404);

  mockState.contact = { cid: "U-2", name: "Target", role: "member", profile_key: null };
  mockState.profile = null;
  expect((await route.PUT(putReq({ user_cid: "U-2", profile_key: "ghost" }))).status).toBe(404);
  expect(sawAssign()).toBe(false);
});

test("eligibility refusal → 400 with the violations, no write", async () => {
  mockState.eligibility = { valid: false, violations: [{ module: "ventures", capability: "edit" }] };
  const res = await route.PUT(putReq({ user_cid: "U-2", profile_key: "founder" }));
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toBe("errors.ineligibleTemplateCaps");
  expect(sawAssign()).toBe(false);
});

test("a narrower profile → 409 loss, and confirm applies it", async () => {
  mockState.profile = { key: "founder", label: "Founder" };
  // The person currently resolves a WIDE default profile; the assigned one is
  // narrower, so the loss guard must ask for confirmation.
  mockState.roleDefaultRow = { profile_key: "wide_default", label: "Wide Default" };
  mockState.currentProfileKey = "wide_default";
  mockState.currentCaps = [
    { module: "ventures", capability: "view", access_level: 1 },
    { module: "projects", capability: "view", access_level: 1 },
  ];
  mockState.newCaps = [{ module: "ventures", capability: "view", access_level: 1 }];

  const res = await route.PUT(putReq({ user_cid: "U-2", profile_key: "founder" }));
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.requiresConfirmation).toBe(true);
  expect(sawAssign()).toBe(false);

  const ok = await route.PUT(putReq({ user_cid: "U-2", profile_key: "founder", confirm: true }));
  expect(ok.status).toBe(200);
  expect(sawAssign()).toBe(true);
});

test("a wider profile applies without confirmation", async () => {
  mockState.currentCaps = [];
  mockState.newCaps = [{ module: "ventures", capability: "view", access_level: 1 }];
  const res = await route.PUT(putReq({ user_cid: "U-2", profile_key: "founder" }));
  expect(res.status).toBe(200);
  expect(sawAssign()).toBe(true);
});

test("a profile the target's role is not allowed to hold → 409, no write (§3.3)", async () => {
  mockState.contact = { cid: "U-2", name: "Target", role: "staff", profile_key: null };
  mockState.profileRow = { key: "founder", allowed_roles: ["member"], is_active: 1 };

  const res = await route.PUT(putReq({ user_cid: "U-2", profile_key: "founder" }));
  const body = await res.json();

  expect(res.status).toBe(409);
  expect(body.profile_role_gap).toMatchObject({ profile: "founder", role: "staff" });
  expect(sawAssign()).toBe(false);
});

test("a profile open to the target's role passes the gate and applies", async () => {
  mockState.contact = { cid: "U-2", name: "Target", role: "member", profile_key: null };
  mockState.profileRow = { key: "founder", allowed_roles: ["member"], is_active: 1 };
  mockState.newCaps = [{ module: "ventures", capability: "view", access_level: 1 }];

  const res = await route.PUT(putReq({ user_cid: "U-2", profile_key: "founder" }));

  expect(res.status).toBe(200);
  expect(sawAssign()).toBe(true);
});

test("a null profile removes the override and reports the fallback", async () => {
  mockState.roleDefaultRow = { label: "Staff Default" };
  const res = await route.PUT(putReq({ user_cid: "U-2", profile_key: null }));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.roleDefaultName).toBe("Staff Default");
  expect(sawClear()).toBe(true);
});

// ── GET — the profile the screen shows for a person ──────────────────────────

const getReq = (cid) => ({
  url: `http://localhost/api/engineering/permissions/profile-override?user_cid=${cid}`,
});

test("the GET reports the mapped default profile of the stored role", async () => {
  mockState.contact = { cid: "U-2", name: "Target", role: "member", profile_key: null };
  mockState.roleDefaultByRole = { member: { key: "venture_member", label: "Venture Member" } };

  const res = await route.GET(getReq("U-2"));
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.roleDefault).toEqual({ key: "venture_member", name: "Venture Member" });
  expect(body.effectiveSource).toBe("role");
});

test("a stored label with NO mapping falls back to the member default", async () => {
  // `applicant` is what the public join form writes; sign-in resolves it to the
  // member baseline, so the screen must show the member default rather than
  // reporting that the person has no profile at all.
  mockState.contact = { cid: "U-9", name: "Applicant", role: "applicant", profile_key: null };
  mockState.roleDefaultByRole = { member: { key: "venture_member", label: "Venture Member" } };
  mockState.roleMappingByRole = {}; // no mapping for `applicant`

  const res = await route.GET(getReq("U-9"));
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.roleDefault).toEqual({ key: "venture_member", name: "Venture Member" });
  expect(body.effectiveSource).toBe("role");
});

test("a mapped but deactivated default stays absent (no silent fallback)", async () => {
  // The role HAS a default; its profile was deactivated. That is a real
  // configuration gap and must not be masked by the member default.
  mockState.contact = { cid: "U-9", name: "Applicant", role: "applicant", profile_key: null };
  mockState.roleDefaultByRole = { member: { key: "venture_member", label: "Venture Member" } };
  mockState.roleMappingByRole = { applicant: { role_name: "applicant", profile_key: "legacy" } };

  const res = await route.GET(getReq("U-9"));
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.roleDefault).toBeNull();
  expect(body.effectiveSource).toBe("none");
});
