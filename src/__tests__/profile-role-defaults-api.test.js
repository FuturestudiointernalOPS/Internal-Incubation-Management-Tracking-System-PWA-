/**
 * B1 — role → profile defaults API (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * The "Default for" control: which profile a baseline role receives by default.
 * The stores are mocked, so the route's decisions are exercised.
 */

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
  invalidateAllAuthorizationContexts: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "U-ADMIN", name: "Admin" })),
}));
jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn(async () => {}),
}));
jest.mock("@/lib/requestOrigin", () => ({ requireSameOrigin: jest.fn(() => null) }));
jest.mock("@/models/authorization/profileCapabilitiesStore", () => ({
  ensureProfileCapabilitiesSchema: jest.fn(async () => true),
  listRoleProfileDefaults: jest.fn(async () => ({ rows: [] })),
  upsertRoleProfileDefault: jest.fn(async () => ({})),
  deleteRoleProfileDefault: jest.fn(async () => ({})),
}));
jest.mock("@/models/authorization/profilesStore", () => ({
  getProfileRow: jest.fn(async () => ({ rows: [] })),
}));
jest.mock("@/services/authorization/eligibilityAdmin", () => ({
  assertTemplateCapsEligible: jest.fn(async () => ({ valid: true, violations: [] })),
}));

const store = require("@/models/authorization/profileCapabilitiesStore");
const profiles = require("@/models/authorization/profilesStore");
const eligibility = require("@/services/authorization/eligibilityAdmin");
const route = require("@/app/api/engineering/permissions/profile-role-defaults/route");

const jsonReq = (body) => ({ url: "http://x/api", json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  store.listRoleProfileDefaults.mockResolvedValue({ rows: [] });
  store.upsertRoleProfileDefault.mockResolvedValue({});
  store.deleteRoleProfileDefault.mockResolvedValue({});
  profiles.getProfileRow.mockResolvedValue({ rows: [] });
  eligibility.assertTemplateCapsEligible.mockResolvedValue({ valid: true, violations: [] });
});

test("GET returns the mappings and the baseline roles", async () => {
  store.listRoleProfileDefaults.mockResolvedValueOnce({
    rows: [{ role_name: "staff", profile_key: "staff_default" }],
  });
  const body = await (await route.GET({ url: "http://x/api" })).json();
  expect(body.success).toBe(true);
  expect(body.roles).toContain("staff");
  expect(body.defaults).toEqual([{ role_name: "staff", profile_key: "staff_default" }]);
});

test("PUT sets a role default behind the eligibility ceiling", async () => {
  profiles.getProfileRow.mockResolvedValueOnce({ rows: [{ key: "staff_default" }] });
  const body = await (await route.PUT(jsonReq({ role_name: "staff", profile_key: "staff_default" }))).json();
  expect(body.success).toBe(true);
  expect(eligibility.assertTemplateCapsEligible).toHaveBeenCalledWith({
    role: "staff",
    profileKey: "staff_default",
  });
  expect(store.upsertRoleProfileDefault).toHaveBeenCalledWith({
    roleName: "staff",
    profileKey: "staff_default",
  });
});

test("PUT refuses a profile that breaks the ceiling, writing nothing", async () => {
  profiles.getProfileRow.mockResolvedValueOnce({ rows: [{ key: "ops" }] });
  eligibility.assertTemplateCapsEligible.mockResolvedValueOnce({
    valid: false,
    violations: [{ module: "finance", capability: "edit" }],
  });
  const res = await route.PUT(jsonReq({ role_name: "member", profile_key: "ops" }));
  expect(res.status).toBe(400);
  expect(store.upsertRoleProfileDefault).not.toHaveBeenCalled();
});

test("PUT with a null profile removes the default", async () => {
  const body = await (await route.PUT(jsonReq({ role_name: "staff", profile_key: null }))).json();
  expect(body.success).toBe(true);
  expect(store.deleteRoleProfileDefault).toHaveBeenCalledWith("staff");
  expect(store.upsertRoleProfileDefault).not.toHaveBeenCalled();
});

test("PUT refuses an unknown role before touching the stores", async () => {
  const res = await route.PUT(jsonReq({ role_name: "wizard", profile_key: "x" }));
  expect(res.status).toBe(400);
  expect(store.upsertRoleProfileDefault).not.toHaveBeenCalled();
});

test("PUT refuses an unknown profile", async () => {
  profiles.getProfileRow.mockResolvedValueOnce({ rows: [] });
  const res = await route.PUT(jsonReq({ role_name: "staff", profile_key: "ghost" }));
  expect(res.status).toBe(404);
});
