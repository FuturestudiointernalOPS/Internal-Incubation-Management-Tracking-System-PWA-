/**
 * Tranche 3 — the resolver reads the PROFILE key
 * (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * Locks the switch: when a person resolves to a profile KEY (override or role
 * default), the BASE capabilities come from `profile_capabilities` through that
 * key; the legacy access-profile id remains a fallback for a template the
 * migration could not map. The reads are mocked, so the wiring is exercised.
 */

const mockState = {};

const mockReads = {
  getUserCapabilityGrants: jest.fn(async () => ({ rows: [] })),
  getUserCapabilityRestrictions: jest.fn(async () => ({ rows: [] })),
  getContactAccessProfileAndGroup: jest.fn(async () => ({ rows: [mockState.contact || {}] })),
  resolveContactBaseProfile: jest.fn(async (args) => {
    mockState.overrideArgs = args;
    return { rows: mockState.overrideRows || [] };
  }),
  resolveRoleDefaultBaseProfile: jest.fn(async (role) => {
    mockState.roleArg = role;
    return { rows: mockState.roleRows || [] };
  }),
  getBaseCapabilityRows: jest.fn(async (args) => {
    mockState.baseArgs = args;
    return { rows: mockState.baseRows || [] };
  }),
  getGroupCapabilityRows: jest.fn(async () => ({ rows: [] })),
  getFeatureEligibilityRows: jest.fn(async () => ({ rows: [] })),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));
jest.mock("@/models/authorization/contextReads", () => mockReads);
jest.mock("@/models/authorization/profileAssignmentsStore", () => ({
  listActiveProfileKeys: jest.fn(async () => ({ rows: [] })),
  ensureProfileAssignmentsSchema: jest.fn(async () => true),
}));
jest.mock("@/services/authorization/membership", () => ({
  getEffectiveGroupsForUser: jest.fn(async () => []),
}));
jest.mock("@/models/authorization/backfill", () => ({
  ensureCapabilityBackfills: jest.fn(async () => {}),
}));
jest.mock("@/services/authorization/contextBootstrap", () => ({
  ensureEligibilitySeeded: jest.fn(async () => {}),
}));

const { resolveAuthorizationContext } = require("@/services/authorization/context");

beforeEach(() => {
  for (const key of ["contact", "overrideRows", "roleRows", "overrideArgs", "roleArg", "baseArgs", "baseRows"]) {
    delete mockState[key];
  }
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("a contact override resolves through its PROFILE KEY", async () => {
  mockState.contact = { cid: "C1", profile_key: "founder", access_profile_id: 7 };
  mockState.overrideRows = [{ profile_key: "founder", label: "Founder" }];

  const ctx = await resolveAuthorizationContext({ cid: "C1", role: "member" });

  expect(mockReads.resolveContactBaseProfile).toHaveBeenCalledWith({
    profileKey: "founder",
    accessProfileId: 7,
  });
  expect(mockState.baseArgs).toEqual({ profileId: null, profileKey: "founder", role: "member" });
  expect(ctx.profile).toMatchObject({
    profileKey: "founder",
    profileName: "Founder",
    profileSource: "user",
  });
});

test("a role default resolves through its PROFILE KEY", async () => {
  mockState.contact = { cid: "C2" };
  mockState.roleRows = [{ profile_key: "staff_default", label: "Staff Default" }];

  const ctx = await resolveAuthorizationContext({ cid: "C2", role: "staff" });

  expect(mockState.baseArgs).toEqual({
    profileId: null,
    profileKey: "staff_default",
    role: "staff",
  });
  expect(ctx.profile).toMatchObject({
    profileKey: "staff_default",
    profileName: "Staff Default",
    profileSource: "role",
  });
});

test("a legacy-only override still resolves by access-profile id", async () => {
  mockState.contact = { cid: "C3", access_profile_id: 9 };
  mockState.overrideRows = [{ legacy_id: 9, legacy_name: "Custom Template" }];

  const ctx = await resolveAuthorizationContext({ cid: "C3", role: "member" });

  expect(mockState.baseArgs).toEqual({ profileId: 9, profileKey: null, role: "member" });
  expect(ctx.profile).toMatchObject({
    profileId: 9,
    profileName: "Custom Template",
    profileSource: "user",
  });
  expect(ctx.profile.profileKey).toBeNull();
});

test("a profile-less identity falls through to the legacy role capabilities", async () => {
  mockState.contact = { cid: "C4" };

  const ctx = await resolveAuthorizationContext({ cid: "C4", role: "member" });

  expect(mockState.baseArgs).toEqual({ profileId: null, profileKey: null, role: "member" });
  expect(ctx.profile.profileSource).toBe("legacy");
});
