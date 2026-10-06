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

jest.mock("@/models/authorization/profileCapabilitiesStore", () => ({
  ensureProfileCapabilitiesSchema: jest.fn(async () => true),
  listProfileCapabilities: (...args) => mockListProfileCapabilities(...args),
  listProfileCapabilityCounts: (...args) => mockListProfileCapabilityCounts(...args),
  clearProfileCapabilities: (...args) => mockClearProfileCapabilities(...args),
  upsertProfileCapability: (...args) => mockUpsertProfileCapability(...args),
  getRoleProfileDefault: jest.fn(),
  upsertRoleProfileDefault: jest.fn(),
  deleteRoleProfileDefault: jest.fn(),
  listRolesUsingProfileDefault: jest.fn(),
}));

const {
  replaceProfileCapabilities,
  listProfileCapabilities,
} = require("@/services/authorization/profileCapabilities");

beforeEach(() => {
  mockClearProfileCapabilities.mockClear();
  mockUpsertProfileCapability.mockClear();
  mockListProfileCapabilities.mockReset();
  mockListProfileCapabilities.mockResolvedValue({ rows: [] });
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
