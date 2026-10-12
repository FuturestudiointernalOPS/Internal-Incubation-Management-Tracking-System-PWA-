/**
 * PHASE G — explanation (docs/ROADMAP_ROLES_PROFILES_ACCESS.md §9).
 *
 * The pure explanation gains the CONTEXTUAL identity — the active profiles and
 * the access template — beside the raw capability sources, so "why does this
 * person have access" answers with the function that put them there, not only
 * the resulting keys. The assignment PERIODS are attached by the caller (the
 * permission read), which owns the database read.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

const { buildPermissionExplanation } = require("@/services/authorization/contextDecisions");

describe("buildPermissionExplanation — the contextual identity (Phase G)", () => {
  test("carries the active profiles and the resolved access template", () => {
    const explanation = buildPermissionExplanation({
      isSuperAdmin: false,
      eligibilityRows: [],
      baseCaps: {},
      groupCaps: {},
      grants: {},
      profiles: ["founder", "learner"],
      profile: { profileId: 7, profileName: "Founder", profileSource: "role" },
    });

    expect(explanation.contextualProfiles).toEqual(["founder", "learner"]);
    expect(explanation.accessProfile).toEqual({
      profileId: 7,
      profileName: "Founder",
      profileSource: "role",
    });
  });

  test("a person with no profile reports an empty list, never undefined", () => {
    const explanation = buildPermissionExplanation({
      isSuperAdmin: false,
      eligibilityRows: [],
      baseCaps: {},
      groupCaps: {},
      grants: {},
    });
    expect(explanation.contextualProfiles).toEqual([]);
    expect(explanation.accessProfile).toBeNull();
  });

  test("Super Admin bypasses eligibility and holds no profile", () => {
    const explanation = buildPermissionExplanation({ isSuperAdmin: true });
    expect(explanation.contextualProfiles).toEqual([]);
  });

  test("null context is still null", () => {
    expect(buildPermissionExplanation(null)).toBeNull();
  });
});
