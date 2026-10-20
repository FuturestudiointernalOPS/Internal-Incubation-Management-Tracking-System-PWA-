/**
 * Lot 3.4 / D-5 — the facilitator's rights have TWO sources today:
 *
 *   1. the per-assignment checkboxes (`v2_program_staff.permissions`);
 *   2. the assignment's PROFILE, then the program default.
 *
 * The checkboxes win. This suite freezes that order AND the shadow measurement
 * that will justify moving the profile to first place.
 */

jest.mock("@/models/authorization/accessQueries", () => ({
  listProfileCapabilities: jest.fn(async () => []),
  getFacilitatorDefaultPermissions: jest.fn(async () => null),
}));
jest.mock("@/services/authorization/programAssignment", () => ({
  resolveProgramAssignment: jest.fn(async () => null),
}));

const mockShadowEnabled = jest.fn(() => false);
const mockShadowCheck = jest.fn();
jest.mock("@/services/authorization/shadow", () => ({
  shadowEnabled: () => mockShadowEnabled(),
  shadowCheck: (...args) => mockShadowCheck(...args),
}));

const { listProfileCapabilities, getFacilitatorDefaultPermissions } = require("@/models/authorization/accessQueries");
const { getFacilitatorPermissionLevel } = require("@/server/authz/programAccess");

const CAP = "participants.view";

const assignment = (over = {}) => ({
  program_id: "P1",
  permissions: null,
  profile_key: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  listProfileCapabilities.mockResolvedValue([]);
  getFacilitatorDefaultPermissions.mockResolvedValue(null);
  mockShadowEnabled.mockReturnValue(false);
});

describe("the current order — checkbox, then profile, then program default", () => {
  test("the checkbox wins and the profile is not even read", async () => {
    const level = await getFacilitatorPermissionLevel(
      "P1",
      assignment({ permissions: { [CAP]: 2 }, profile_key: "facilitator" }),
      CAP,
    );

    expect(level).toBe(2);
    expect(listProfileCapabilities).not.toHaveBeenCalled();
  });

  test("a JSON string override is parsed like an object", async () => {
    const level = await getFacilitatorPermissionLevel(
      "P1",
      assignment({ permissions: JSON.stringify({ [CAP]: 3 }) }),
      CAP,
    );

    expect(level).toBe(3);
  });

  test("without a checkbox, the profile decides", async () => {
    listProfileCapabilities.mockResolvedValue([
      { module: "facilitator", capability: CAP, access_level: 2 },
    ]);

    const level = await getFacilitatorPermissionLevel(
      "P1",
      assignment({ profile_key: "facilitator" }),
      CAP,
    );

    expect(level).toBe(2);
    expect(getFacilitatorDefaultPermissions).not.toHaveBeenCalled();
  });

  test("an explicit 0 in the profile does NOT fall through to the default", async () => {
    listProfileCapabilities.mockResolvedValue([
      { module: "facilitator", capability: CAP, access_level: 0 },
    ]);
    getFacilitatorDefaultPermissions.mockResolvedValue({ [CAP]: 2 });

    const level = await getFacilitatorPermissionLevel(
      "P1",
      assignment({ profile_key: "facilitator" }),
      CAP,
    );

    expect(level).toBe(0);
    expect(getFacilitatorDefaultPermissions).not.toHaveBeenCalled();
  });

  test("no profile key → the program default", async () => {
    getFacilitatorDefaultPermissions.mockResolvedValue(JSON.stringify({ [CAP]: 1 }));

    const level = await getFacilitatorPermissionLevel("P1", assignment(), CAP);

    expect(level).toBe(1);
  });

  test("nothing configured → 0", async () => {
    await expect(getFacilitatorPermissionLevel("P1", assignment(), CAP)).resolves.toBe(0);
  });
});

describe("D-5 — the profile's answer is measured, never enforced", () => {
  test("shadow off: the profile-source is not computed", async () => {
    await getFacilitatorPermissionLevel(
      "P1",
      assignment({ permissions: { [CAP]: 2 }, profile_key: "facilitator" }),
      CAP,
    );

    expect(mockShadowCheck).not.toHaveBeenCalled();
  });

  test("shadow on: a divergence is logged, the checkbox still decides", async () => {
    mockShadowEnabled.mockReturnValue(true);
    listProfileCapabilities.mockResolvedValue([]);
    getFacilitatorDefaultPermissions.mockResolvedValue(null);

    const level = await getFacilitatorPermissionLevel(
      "P1",
      assignment({ permissions: { [CAP]: 2 }, profile_key: "facilitator" }),
      CAP,
    );

    expect(level).toBe(2); // unchanged
    expect(mockShadowCheck).toHaveBeenCalledWith({
      legacyAllowed: true,
      engineAllowed: false,
      meta: { resource: "program", policy: "facilitator_rights", capability: CAP },
    });
  });

  test("shadow on: agreement reports two equal verdicts", async () => {
    mockShadowEnabled.mockReturnValue(true);
    listProfileCapabilities.mockResolvedValue([
      { module: "facilitator", capability: CAP, access_level: 2 },
    ]);

    await getFacilitatorPermissionLevel(
      "P1",
      assignment({ permissions: { [CAP]: 2 }, profile_key: "facilitator" }),
      CAP,
    );

    expect(mockShadowCheck).toHaveBeenCalledWith({
      legacyAllowed: true,
      engineAllowed: true,
      meta: { resource: "program", policy: "facilitator_rights", capability: CAP },
    });
  });
});
