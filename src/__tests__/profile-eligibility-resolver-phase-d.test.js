/**
 * PHASE D — the resolver and the cache carry the active profiles
 * (docs/ROADMAP_ROLES_PROFILES_ACCESS.md).
 *
 * The resolver reads the person's ACTIVE profile keys and folds them into the
 * eligibility read; the cache keys on them, so a profile change is a DIFFERENT
 * identity; and every profile-assignment write invalidates the person's context.
 * The reads are mocked, so the wiring is exercised, not the SQL.
 */

const mockState = { activeKeys: [], eligibilityProfiles: [] };

const mockReads = {
  getUserCapabilityGrants: jest.fn(async () => ({ rows: [] })),
  getUserCapabilityRestrictions: jest.fn(async () => ({ rows: [] })),
  getContactAccessProfileAndGroup: jest.fn(async () => ({ rows: [{}] })),
  getActiveAccessProfileById: jest.fn(async () => ({ rows: [] })),
  getRoleDefaultAccessProfile: jest.fn(async () => ({ rows: [] })),
  resolveContactBaseProfile: jest.fn(async () => ({ rows: [] })),
  resolveRoleDefaultBaseProfile: jest.fn(async () => ({ rows: [] })),
  getBaseCapabilityRows: jest.fn(async () => ({ rows: [] })),
  getGroupCapabilityRows: jest.fn(async () => ({ rows: [] })),
  getFeatureEligibilityRows: jest.fn(async (role, groups, profiles) => {
    mockState.eligibilityProfiles.push(profiles);
    return { rows: [] };
  }),
};

const mockAssignments = {
  listActiveProfileKeys: jest.fn(async () =>
    ({ rows: mockState.activeKeys.map((key) => ({ profile_key: key })) }),
  ),
  ensureProfileAssignmentsSchema: jest.fn(async () => true),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));
jest.mock("@/models/authorization/contextReads", () => mockReads);
jest.mock("@/models/authorization/profileAssignmentsStore", () => mockAssignments);
jest.mock("@/services/authorization/membership", () => ({
  getEffectiveGroupsForUser: jest.fn(async () => []),
}));
jest.mock("@/models/authorization/backfill", () => ({
  ensureCapabilityBackfills: jest.fn(async () => {}),
}));
jest.mock("@/services/authorization/contextBootstrap", () => ({
  ensureEligibilitySeeded: jest.fn(async () => {}),
}));
jest.mock("@/lib/workspaceContextCache", () => ({
  dropWorkspaceContext: jest.fn(),
  dropAllWorkspaceContexts: jest.fn(),
}));

const {
  getAuthorizationContext,
  invalidateAuthorizationContext,
  invalidateAllAuthorizationContexts,
  resolveAuthorizationContext,
} = require("@/services/authorization/context");

beforeEach(() => {
  // The cache and the profile-key memo are module-level state — clear them so
  // one test's identity never leaks into the next.
  invalidateAllAuthorizationContexts();
  mockState.activeKeys = [];
  mockState.eligibilityProfiles = [];
  mockReads.getUserCapabilityGrants.mockClear();
  mockAssignments.listActiveProfileKeys.mockClear();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("resolveAuthorizationContext carries the active profiles", () => {
  test("reads them itself and folds them into the eligibility read", async () => {
    mockState.activeKeys = ["facilitator"];
    const ctx = await resolveAuthorizationContext({ cid: "C1", role: "member" });

    expect(ctx.profiles).toEqual(["facilitator"]);
    expect(mockAssignments.listActiveProfileKeys).toHaveBeenCalledWith("C1");
    expect(mockState.eligibilityProfiles[0]).toEqual(["facilitator"]);
  });

  test("a caller that already read them (the cache) is not re-read", async () => {
    const ctx = await resolveAuthorizationContext({
      cid: "C1",
      role: "member",
      profiles: ["founder"],
    });
    expect(ctx.profiles).toEqual(["founder"]);
    expect(mockAssignments.listActiveProfileKeys).not.toHaveBeenCalled();
  });

  test("Super Admin bypasses eligibility and carries no profile", async () => {
    mockState.activeKeys = ["founder"];
    const ctx = await resolveAuthorizationContext({ cid: "SA", role: "super_admin" });
    expect(ctx.profiles).toEqual([]);
    expect(mockAssignments.listActiveProfileKeys).not.toHaveBeenCalled();
  });
});

describe("the cache keys on the active profiles", () => {
  test("the same identity resolves once", async () => {
    mockState.activeKeys = ["founder"];
    const first = await getAuthorizationContext({ cid: "C1", role: "member" });
    mockReads.getUserCapabilityGrants.mockClear();
    const second = await getAuthorizationContext({ cid: "C1", role: "member" });

    expect(second).toBe(first);
    expect(mockReads.getUserCapabilityGrants).not.toHaveBeenCalled();
  });

  test("an assignment write invalidates the context, so a new profile applies", async () => {
    mockState.activeKeys = [];
    const before = await getAuthorizationContext({ cid: "C1", role: "member" });
    expect(before.profiles).toEqual([]);

    // A profile is assigned and the write invalidates the person's context.
    mockState.activeKeys = ["founder"];
    invalidateAuthorizationContext("C1");

    const after = await getAuthorizationContext({ cid: "C1", role: "member" });
    expect(after).not.toBe(before);
    expect(after.profiles).toEqual(["founder"]);
  });
});
