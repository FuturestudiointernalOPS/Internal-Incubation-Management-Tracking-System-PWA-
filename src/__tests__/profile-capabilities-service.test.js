/**
 * Tranche 1 — profile-capability SERVICE (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * The replacement rule: clear, then insert the NORMALIZED payload, with the SAME
 * "view is implied" normalization the access-profile editor uses. The store is
 * mocked so the test pins the service's decisions, not SQL.
 */

const mockClearProfileCapabilities = jest.fn(async () => {});
const mockUpsertProfileCapability = jest.fn(async () => {});
const mockListProfileCapabilities = jest.fn(async () => ({ rows: [] }));
const mockListProfileCapabilityCounts = jest.fn(async () => ({ rows: [] }));
const mockGetProfileEligibilityRows = jest.fn(async () => ({ rows: [] }));
const mockGetRoleEligibilityRows = jest.fn(async () => ({ rows: [] }));

jest.mock("@/models/authorization/profileCapabilitiesStore", () => ({
  ensureProfileCapabilitiesSchema: jest.fn(async () => true),
  listProfileCapabilities: (...args) => mockListProfileCapabilities(...args),
  listProfileCapabilityCounts: (...args) => mockListProfileCapabilityCounts(...args),
  clearProfileCapabilities: (...args) => mockClearProfileCapabilities(...args),
  upsertProfileCapability: (...args) => mockUpsertProfileCapability(...args),
  getRoleProfileDefault: jest.fn(),
  upsertRoleProfileDefault: jest.fn(),
  deleteRoleProfileDefault: jest.fn(),
  listRolesUsingProfileDefault: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/authorization", () => ({
  ...jest.requireActual("@/models/authorization"),
  getProfileEligibilityRows: (...args) => mockGetProfileEligibilityRows(...args),
  getRoleEligibilityRows: (...args) => mockGetRoleEligibilityRows(...args),
}));

const {
  replaceProfileCapabilities,
  listProfileCapabilities,
  assertCapsEligibleForProfileKey,
} = require("@/services/authorization/profileCapabilities");
const {
  listRolesUsingProfileDefault,
} = require("@/models/authorization/profileCapabilitiesStore");

beforeEach(() => {
  mockClearProfileCapabilities.mockClear();
  mockUpsertProfileCapability.mockClear();
  mockListProfileCapabilities.mockReset();
  mockListProfileCapabilities.mockResolvedValue({ rows: [] });
  mockGetProfileEligibilityRows.mockReset();
  mockGetProfileEligibilityRows.mockResolvedValue({ rows: [] });
  mockGetRoleEligibilityRows.mockReset();
  mockGetRoleEligibilityRows.mockResolvedValue({ rows: [] });
  listRolesUsingProfileDefault.mockReset();
  listRolesUsingProfileDefault.mockResolvedValue({ rows: [] });
});

test("clears then upserts every normalized row, in order", async () => {
  await replaceProfileCapabilities("founder", { ventures: { edit: 3 } });

  expect(mockClearProfileCapabilities).toHaveBeenCalledWith("founder");
  // `edit` implies `view` at level 1 — the shared normalization rule (view is
  // folded in after the payload's own keys).
  expect(mockUpsertProfileCapability.mock.calls).toEqual([
    ["founder", "ventures", "edit", 3],
    ["founder", "ventures", "view", 1],
  ]);
});

test("drops zero rows (absence already means level 0)", async () => {
  await replaceProfileCapabilities("founder", { ventures: { view: 0, edit: 0 } });
  expect(mockUpsertProfileCapability).not.toHaveBeenCalled();
  expect(mockClearProfileCapabilities).toHaveBeenCalledWith("founder");
});

test("listProfileCapabilities folds rows into { module: { capability: level } }", async () => {
  mockListProfileCapabilities.mockResolvedValueOnce({
    rows: [
      { module: "ventures", capability: "view", access_level: 1 },
      { module: "ventures", capability: "edit", access_level: 3 },
    ],
  });
  await expect(listProfileCapabilities("founder")).resolves.toEqual({
    ventures: { view: 1, edit: 3 },
  });
});

// ── assertCapsEligibleForProfileKey — profiles are the ceiling ────────────────

describe("assertCapsEligibleForProfileKey", () => {
  test("a profile's OWN ceiling is authoritative", async () => {
    mockGetProfileEligibilityRows.mockResolvedValue({
      rows: [{ feature_key: "ventures", eligible: 1 }],
    });
    await expect(
      assertCapsEligibleForProfileKey({ ventures: { view: 1 } }, "founder"),
    ).resolves.toMatchObject({ valid: true });

    // A capability of a feature the profile is NOT eligible for is a violation.
    const bad = await assertCapsEligibleForProfileKey(
      { finance: { view: 1 } },
      "founder",
    );
    expect(bad.valid).toBe(false);
    expect(bad.violations).toEqual([
      { module: "finance", capability: "view", feature: "finance" },
    ]);
  });

  test("falls back to the roles it serves when the profile has no rows of its own", async () => {
    mockGetProfileEligibilityRows.mockResolvedValue({ rows: [] });
    listRolesUsingProfileDefault.mockResolvedValue({
      rows: [{ role_name: "staff" }],
    });
    mockGetRoleEligibilityRows.mockResolvedValue({
      rows: [{ feature_key: "crm", eligible: 1 }],
    });
    await expect(
      assertCapsEligibleForProfileKey({ contacts: { view: 1 } }, "staff_default"),
    ).resolves.toMatchObject({ valid: true });
  });

  test("a served role with a ceiling still bounds the profile", async () => {
    mockGetProfileEligibilityRows.mockResolvedValue({ rows: [] });
    listRolesUsingProfileDefault.mockResolvedValue({
      rows: [{ role_name: "staff" }],
    });
    mockGetRoleEligibilityRows.mockResolvedValue({
      rows: [{ feature_key: "crm", eligible: 1 }],
    });
    const res = await assertCapsEligibleForProfileKey(
      { finance: { view: 1 } },
      "staff_default",
    );
    expect(res.valid).toBe(false);
    expect(res.role).toBe("staff");
  });

  test("a served role with NO ceiling rows does not block (retired role)", async () => {
    mockGetProfileEligibilityRows.mockResolvedValue({ rows: [] });
    listRolesUsingProfileDefault.mockResolvedValue({
      rows: [{ role_name: "teacher" }],
    });
    mockGetRoleEligibilityRows.mockResolvedValue({ rows: [] });
    await expect(
      assertCapsEligibleForProfileKey({ finance: { view: 1 } }, "instructor"),
    ).resolves.toMatchObject({ valid: true });
  });
});
