/**
 * Tranche 4 — the profiles catalogue API gains capabilities + create/delete
 * (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * The stores are mocked, so the route's decisions are exercised: a profile's
 * capabilities are read/written by KEY, creation is dynamic, and deletion is
 * refused while a role default, a held assignment or a context row references
 * the profile.
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

jest.mock("@/models/authorization/profilesStore", () => ({
  ensureProfilesSchema: jest.fn(async () => true),
  seedProfiles: jest.fn(async () => ({ success: true })),
  listProfiles: jest.fn(async () => ({ rows: [] })),
  getProfileRow: jest.fn(async () => ({ rows: [] })),
  updateProfile: jest.fn(async () => ({})),
  insertProfile: jest.fn(async () => ({ rowsAffected: 1 })),
  deleteProfile: jest.fn(async () => ({})),
}));
jest.mock("@/models/authorization/profileAssignmentsStore", () => ({
  ensureProfileAssignmentsSchema: jest.fn(async () => true),
  countActiveAssignmentsForProfileKey: jest.fn(async () => ({ rows: [{ n: 0 }] })),
}));
jest.mock("@/models/authorization/contextRoleProfiles", () => ({
  countContextRoleProfilesByKey: jest.fn(async () => ({ rows: [{ n: 0 }] })),
}));
jest.mock("@/services/authorization/profileCapabilities", () => ({
  ensureProfileCapabilitiesSchema: jest.fn(async () => true),
  listProfileCapabilities: jest.fn(async () => ({})),
  listProfileCapabilityCounts: jest.fn(async () => ({})),
  replaceProfileCapabilities: jest.fn(async () => ({})),
  deleteProfileCapabilities: jest.fn(async () => ({})),
  assertCapsEligibleForProfileKey: jest.fn(async () => ({ valid: true, violations: [], role: null })),
  listRolesUsingProfileDefault: jest.fn(async () => ({ rows: [] })),
}));

const store = require("@/models/authorization/profilesStore");
const caps = require("@/services/authorization/profileCapabilities");
const assignStore = require("@/models/authorization/profileAssignmentsStore");
const contextRoles = require("@/models/authorization/contextRoleProfiles");
const route = require("@/app/api/engineering/permissions/profiles/route");

const req = (url) => ({ url });
const jsonReq = (body, url = "http://localhost/api") => ({
  url,
  json: async () => body,
});

beforeEach(() => {
  jest.clearAllMocks();
  store.ensureProfilesSchema.mockResolvedValue(true);
  store.seedProfiles.mockResolvedValue({ success: true });
  store.getProfileRow.mockResolvedValue({ rows: [] });
  store.listProfiles.mockResolvedValue({ rows: [] });
  caps.listProfileCapabilities.mockResolvedValue({});
  caps.listProfileCapabilityCounts.mockResolvedValue({});
  caps.assertCapsEligibleForProfileKey.mockResolvedValue({ valid: true, violations: [], role: null });
  caps.listRolesUsingProfileDefault.mockResolvedValue({ rows: [] });
  assignStore.countActiveAssignmentsForProfileKey.mockResolvedValue({ rows: [{ n: 0 }] });
  contextRoles.countContextRoleProfilesByKey.mockResolvedValue({ rows: [{ n: 0 }] });
});

const FOUNDER_ROW = {
  key: "founder",
  context: "venture",
  label: "Founder",
  allowed_roles: '["member"]',
  is_active: 1,
  notes: "",
};

test("GET ?key returns the profile with its capabilities", async () => {
  store.getProfileRow.mockResolvedValueOnce({ rows: [FOUNDER_ROW] });
  caps.listProfileCapabilities.mockResolvedValueOnce({ ventures: { view: 1 } });

  const body = await (await route.GET(req("http://x/api?key=founder"))).json();

  expect(body.success).toBe(true);
  expect(body.profile).toMatchObject({
    key: "founder",
    label: "Founder",
    label_key: "engineering.permissions.profileFounder",
    allowed_roles: ["member"],
    capabilities: { ventures: { view: 1 } },
  });
});

test("GET list carries a capability_count per profile", async () => {
  store.listProfiles.mockResolvedValueOnce({ rows: [FOUNDER_ROW] });
  caps.listProfileCapabilityCounts.mockResolvedValueOnce({ founder: 3 });

  const body = await (await route.GET(req("http://x/api"))).json();

  expect(body.profiles[0].capability_count).toBe(3);
});

test("PUT replaces capabilities through the key, after the eligibility ceiling", async () => {
  store.getProfileRow.mockResolvedValueOnce({ rows: [FOUNDER_ROW] });

  const res = await route.PUT(
    jsonReq({ key: "founder", allowed_roles: ["member"], capabilities: { ventures: { edit: 3 } } }),
  );
  const body = await res.json();

  expect(body.success).toBe(true);
  expect(caps.assertCapsEligibleForProfileKey).toHaveBeenCalledWith(
    { ventures: { edit: 3 } },
    "founder",
  );
  expect(caps.replaceProfileCapabilities).toHaveBeenCalledWith("founder", { ventures: { edit: 3 } });
});

test("PUT refuses capabilities that break the eligibility ceiling", async () => {
  store.getProfileRow.mockResolvedValueOnce({ rows: [FOUNDER_ROW] });
  caps.assertCapsEligibleForProfileKey.mockResolvedValueOnce({
    valid: false,
    violations: [{ module: "ventures", capability: "edit" }],
    role: "member",
  });

  const res = await route.PUT(
    jsonReq({ key: "founder", allowed_roles: ["member"], capabilities: { ventures: { edit: 3 } } }),
  );
  expect(res.status).toBe(400);
  expect(caps.replaceProfileCapabilities).not.toHaveBeenCalled();
});

test("POST creates a dynamic profile and its capabilities", async () => {
  const res = await route.POST(
    jsonReq({
      key: "auditor",
      label: "Auditor",
      context: "staff",
      allowed_roles: ["staff"],
      capabilities: { reports: { view: 1 } },
    }),
  );
  const body = await res.json();

  expect(body.success).toBe(true);
  expect(store.insertProfile).toHaveBeenCalledWith(
    expect.objectContaining({ key: "auditor", context: "staff", label: "Auditor" }),
  );
  expect(caps.replaceProfileCapabilities).toHaveBeenCalledWith("auditor", { reports: { view: 1 } });
});

test("POST refuses an existing key and a malformed context", async () => {
  store.getProfileRow.mockResolvedValueOnce({ rows: [FOUNDER_ROW] });
  const dup = await route.POST(jsonReq({ key: "founder", label: "F", context: "venture" }));
  expect(dup.status).toBe(409);
  expect(store.insertProfile).not.toHaveBeenCalled();

  const bad = await route.POST(jsonReq({ key: "auditor", label: "A", context: "nowhere" }));
  expect(bad.status).toBe(400);
});

test("DELETE is refused while referenced, then deletes caps + row", async () => {
  store.getProfileRow.mockResolvedValue({ rows: [FOUNDER_ROW] });

  caps.listRolesUsingProfileDefault.mockResolvedValueOnce({ rows: [{ role_name: "member" }] });
  expect((await route.DELETE(req("http://x/api?key=founder"))).status).toBe(400);

  caps.listRolesUsingProfileDefault.mockResolvedValue({ rows: [] });
  assignStore.countActiveAssignmentsForProfileKey.mockResolvedValueOnce({ rows: [{ n: 2 }] });
  expect((await route.DELETE(req("http://x/api?key=founder"))).status).toBe(400);

  assignStore.countActiveAssignmentsForProfileKey.mockResolvedValue({ rows: [{ n: 0 }] });
  contextRoles.countContextRoleProfilesByKey.mockResolvedValueOnce({ rows: [{ n: 1 }] });
  expect((await route.DELETE(req("http://x/api?key=founder"))).status).toBe(400);

  contextRoles.countContextRoleProfilesByKey.mockResolvedValue({ rows: [{ n: 0 }] });
  const ok = await route.DELETE(req("http://x/api?key=founder"));
  expect(ok.status).toBe(200);
  expect(caps.deleteProfileCapabilities).toHaveBeenCalledWith("founder");
  expect(store.deleteProfile).toHaveBeenCalledWith("founder");
});
