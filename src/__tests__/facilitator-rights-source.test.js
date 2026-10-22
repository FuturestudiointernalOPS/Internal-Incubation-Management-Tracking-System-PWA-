/**
 * Lot 3.4 / D-5 — the facilitator's rights now have ONE source.
 *
 * The per-assignment checkboxes used to win over the assignment's PROFILE and
 * the program default. D-5 makes the profile the single source: the checkboxes
 * are measured in shadow (so a divergence stays visible) and never decide.
 */

jest.mock("@/models/authorization/accessQueries", () => ({
  listProfileCapabilities: jest.fn(async () => []),
  getFacilitatorDefaultPermissions: jest.fn(async () => null),
}));
jest.mock("@/services/authorization/programAssignment", () => ({
  resolveProgramAssignment: jest.fn(async () => null),
}));
jest.mock("@/models/authorization/backfill", () => ({
  ensureCapabilityBackfills: jest.fn(async () => {}),
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
  role: "facilitator",
  permissions: null,
  profile_key: null,
  ...over,
});

const profileGrants = (level) => [
  { module: "facilitator", capability: CAP, access_level: level },
];

beforeEach(() => {
  jest.clearAllMocks();
  listProfileCapabilities.mockResolvedValue([]);
  getFacilitatorDefaultPermissions.mockResolvedValue(null);
  mockShadowEnabled.mockReturnValue(false);
});

describe("D-5 — the profile decides, the checkboxes do not", () => {
  test("a checkbox that disagrees is ignored", async () => {
    listProfileCapabilities.mockResolvedValue(profileGrants(0));

    const level = await getFacilitatorPermissionLevel(
      "P1",
      assignment({ permissions: { [CAP]: 2 } }),
      CAP,
    );

    expect(level).toBe(0); // the profile explicitly grants nothing
  });

  test("a JSON string checkbox is ignored too", async () => {
    listProfileCapabilities.mockResolvedValue(profileGrants(1));

    const level = await getFacilitatorPermissionLevel(
      "P1",
      assignment({ permissions: JSON.stringify({ [CAP]: 3 }) }),
      CAP,
    );

    expect(level).toBe(1);
  });

  test("a facilitator assignment with no key derives the facilitator profile", async () => {
    listProfileCapabilities.mockResolvedValue(profileGrants(2));

    const level = await getFacilitatorPermissionLevel("P1", assignment(), CAP);

    expect(level).toBe(2);
    expect(listProfileCapabilities).toHaveBeenCalledWith("facilitator");
  });

  test("an explicit key wins over the role-derived profile", async () => {
    listProfileCapabilities.mockResolvedValue(profileGrants(2));

    await getFacilitatorPermissionLevel(
      "P1",
      assignment({ profile_key: "instructor" }),
      CAP,
    );

    expect(listProfileCapabilities).toHaveBeenCalledWith("instructor");
  });

  test("an explicit 0 in the profile does NOT fall through to the default", async () => {
    listProfileCapabilities.mockResolvedValue(profileGrants(0));
    getFacilitatorDefaultPermissions.mockResolvedValue({ [CAP]: 2 });

    const level = await getFacilitatorPermissionLevel("P1", assignment(), CAP);

    expect(level).toBe(0);
    expect(getFacilitatorDefaultPermissions).not.toHaveBeenCalled();
  });

  test("an unspecified role falls back to the program default", async () => {
    getFacilitatorDefaultPermissions.mockResolvedValue(JSON.stringify({ [CAP]: 1 }));

    const level = await getFacilitatorPermissionLevel(
      "P1",
      assignment({ role: "coach" }),
      CAP,
    );

    expect(level).toBe(1);
  });

  test("nothing configured → 0", async () => {
    await expect(
      getFacilitatorPermissionLevel("P1", assignment({ role: "coach" }), CAP),
    ).resolves.toBe(0);
  });
});

describe("shadow — the checkbox rule is measured, never enforced", () => {
  test("shadow off: the checkbox is not even read", async () => {
    listProfileCapabilities.mockResolvedValue(profileGrants(2));

    await getFacilitatorPermissionLevel("P1", assignment({ permissions: { [CAP]: 2 } }), CAP);

    expect(mockShadowCheck).not.toHaveBeenCalled();
  });

  test("shadow on: a divergence is logged, the profile still decides", async () => {
    mockShadowEnabled.mockReturnValue(true);
    listProfileCapabilities.mockResolvedValue(profileGrants(0));

    const level = await getFacilitatorPermissionLevel(
      "P1",
      assignment({ permissions: { [CAP]: 2 } }),
      CAP,
    );

    expect(level).toBe(0); // the profile decides
    expect(mockShadowCheck).toHaveBeenCalledWith({
      legacyAllowed: true,
      engineAllowed: false,
      meta: { resource: "program", policy: "facilitator_rights", capability: CAP },
    });
  });

  test("shadow on: agreement reports two equal verdicts", async () => {
    mockShadowEnabled.mockReturnValue(true);
    listProfileCapabilities.mockResolvedValue(profileGrants(2));

    await getFacilitatorPermissionLevel("P1", assignment({ permissions: { [CAP]: 2 } }), CAP);

    expect(mockShadowCheck).toHaveBeenCalledWith({
      legacyAllowed: true,
      engineAllowed: true,
      meta: { resource: "program", policy: "facilitator_rights", capability: CAP },
    });
  });
});
