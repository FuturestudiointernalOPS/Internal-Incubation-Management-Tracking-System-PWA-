/**
 * ASSIGNMENT-DERIVED PROGRAM ACCESS — the change plan and the ceiling.
 *
 * What syncContextGrantsForUser would write, and the rule that an
 * ineligible person never keeps an assignment-derived grant.
 *
 * The fake database and the fixtures live in
 * ./helpers/programAssignmentGrants.
 */

const mockGrants = require("./helpers/programAssignmentGrants");

jest.mock("@/lib/db", () => mockGrants.dbMock);
jest.mock("@/services/authorization/context", () => mockGrants.authorizationContextMock);

const {
  resolveAssignmentCapabilityLevel,
} = require("@/services/authorization/programAssignments");
const { planContextGrantChanges } = require("@/services/authorization/contextGrants");

const {
  resetState,
  assignment,
  PROGRAM_ACTIVE,
  facilitatorSentinel,
  ALL_FACILITATOR_KEYS,
} = require("./helpers/programAssignmentGrants");

const FACILITATOR_SENTINEL = facilitatorSentinel();

beforeEach(() => resetState());

describe("planContextGrantChanges — expiry is part of the comparison", () => {
  const desired = {
    "facilitator.groups.view": { module: "facilitator", capability: "groups.view", level: 1 },
  };

  test("a row whose level AND expiry already match is left alone", () => {
    const { toApply } = planContextGrantChanges({
      desired,
      existing: [
        {
          module: "facilitator",
          capability: "groups.view",
          access_level: 1,
          granted_by: FACILITATOR_SENTINEL,
          expires_at: "2026-06-30",
        },
      ],
      sentinel: FACILITATOR_SENTINEL,
      expiresAt: "2026-06-30",
    });
    expect(toApply).toEqual([]);
  });

  test("a program whose end date moved re-dates the grant", () => {
    const { toApply } = planContextGrantChanges({
      desired,
      existing: [
        {
          module: "facilitator",
          capability: "groups.view",
          access_level: 1,
          granted_by: FACILITATOR_SENTINEL,
          expires_at: "2026-06-30",
        },
      ],
      sentinel: FACILITATOR_SENTINEL,
      expiresAt: "2026-12-31",
    });
    expect(toApply).toHaveLength(1);
    expect(toApply[0].expiresAt).toBe("2026-12-31");
  });

  test("a manual grant is still never overwritten", () => {
    const { toApply } = planContextGrantChanges({
      desired,
      existing: [
        {
          module: "facilitator",
          capability: "groups.view",
          access_level: 1,
          granted_by: "USER_SA",
          expires_at: null,
        },
      ],
      sentinel: FACILITATOR_SENTINEL,
      expiresAt: "2026-12-31",
    });
    expect(toApply).toEqual([]);
  });
});

describe("eligibility ceiling — the assignment grant must not be dead on arrival", () => {
  const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/models/authorization/eligibility-defaults");
  const { RESPONSIBILITY_FEATURE_ROLES } = require("@/lib/featureAccess");

  test("the programs feature is eligible for the contextual identities", () => {
    // A facilitator is a baseline Member (or carries the facilitator label);
    // without the ceiling row the resolver refuses BEFORE reading the grant.
    expect(FEATURE_ELIGIBILITY_DEFAULTS.programs).toContain("facilitator");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.programs).toContain("member");
  });

  test("the responsibility defaults stay in exact sync (they share one source)", () => {
    expect(RESPONSIBILITY_FEATURE_ROLES.programs).toEqual(
      FEATURE_ELIGIBILITY_DEFAULTS.programs,
    );
  });

  test("the assignment-only facilitator capabilities still resolve as granted today", () => {
    // Guards against a future vocabulary addition silently denying everyone:
    // every declared key must have a defined level for an unconfigured row.
    for (const capability of ALL_FACILITATOR_KEYS) {
      const level = resolveAssignmentCapabilityLevel(
        assignment(PROGRAM_ACTIVE, {}),
        capability,
        {},
      );
      expect(typeof level).toBe("number");
      expect(level).toBeGreaterThanOrEqual(1);
    }
  });
});
