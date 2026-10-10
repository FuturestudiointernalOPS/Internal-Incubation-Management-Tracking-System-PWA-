/**
 * PHASE 7 — D4 : plafond « identité ∪ fonction » (spec §16.2 vs §5.3).
 *
 * L'arbitrage D4 retient l'UNION : une identité éligible OUVRE la section ; le
 * « non » d'une identité n'est pas un veto global sur une autre identité. Le
 * seul cas signalé est celui où un PROFIL ouvre une section que le RÔLE refuse
 * EXPLICITEMENT — l'accès est accordé AVEC un avertissement de SECTION, jamais
 * refusé.
 *
 * Le verdict et sa justification viennent d'une seule fonction pure
 * (`explainEligibility`), donc ils ne peuvent pas diverger.
 */
let mockEligibilityRows = [];

jest.mock("@/models/authorization/contextReads", () => ({
  getUserCapabilityGrants: jest.fn(async () => ({ rows: [] })),
  getUserCapabilityRestrictions: jest.fn(async () => ({ rows: [] })),
  getContactAccessProfileAndGroup: jest.fn(async () => ({ rows: [{}] })),
  resolveContactBaseProfile: jest.fn(async () => ({ rows: [] })),
  resolveRoleDefaultBaseProfile: jest.fn(async () => ({ rows: [] })),
  getBaseCapabilityRows: jest.fn(async () => ({ rows: [] })),
  getGroupCapabilityRows: jest.fn(async () => ({ rows: [] })),
  getFeatureEligibilityRows: jest.fn(async () => ({ rows: mockEligibilityRows })),
}));

jest.mock("@/services/authorization/membership", () => ({
  getEffectiveGroupsForUser: jest.fn(async () => []),
}));
jest.mock("@/models/authorization/profileAssignmentsStore", () => ({
  listActiveProfileKeys: jest.fn(async () => ({ rows: [] })),
}));
jest.mock("@/services/authorization/contextBootstrap", () => ({
  ensureEligibilitySeeded: jest.fn(async () => true),
}));
jest.mock("@/models/authorization/backfill", () => ({
  ensureCapabilityBackfills: jest.fn(async () => {}),
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

const {
  evaluateEligibility,
  explainEligibility,
} = require("@/services/authorization/eligibility");
const {
  resolveAuthorizationContext,
} = require("@/services/authorization/context");

const ROLE_DENY = {
  feature_key: "ventures",
  identity_type: "role",
  identity_value: "member",
  eligible: 0,
};
const ROLE_ALLOW = { ...ROLE_DENY, eligible: 1 };
const PROFILE_ALLOW = {
  feature_key: "ventures",
  identity_type: "profile",
  identity_value: "founder",
  eligible: 1,
};

describe("D4 — evaluateEligibility : union des identités", () => {
  test("une identité qui autorise ouvre la section, même si une autre refuse", () => {
    expect(evaluateEligibility([ROLE_DENY, PROFILE_ALLOW], "ventures")).toBe(true);
  });

  test("aucune identité n'autorise : refusé (échec fermé)", () => {
    const rows = [ROLE_DENY, { ...PROFILE_ALLOW, eligible: 0 }];
    expect(evaluateEligibility(rows, "ventures")).toBe(false);
  });

  test("aucune ligne : refusé (échec fermé)", () => {
    expect(evaluateEligibility([], "ventures")).toBe(false);
  });
});

describe("D4 — explainEligibility : avertissement de section", () => {
  test("profil ouvre malgré le refus explicite du rôle → avertissement", () => {
    expect(explainEligibility([ROLE_DENY, PROFILE_ALLOW], "ventures")).toEqual({
      eligible: true,
      openedByProfile: true,
    });
  });

  test("le rôle autorise : aucun avertissement", () => {
    expect(explainEligibility([ROLE_ALLOW, PROFILE_ALLOW], "ventures")).toEqual({
      eligible: true,
      openedByProfile: false,
    });
  });

  test("aucune autorisation : refus, pas d'avertissement", () => {
    expect(explainEligibility([ROLE_DENY], "ventures")).toEqual({
      eligible: false,
      openedByProfile: false,
    });
  });
});

describe("D4 — le contexte du résolveur expose verdict + avertissement", () => {
  test("profil ouvre / rôle refuse : éligible AVEC avertissement de section", async () => {
    mockEligibilityRows = [ROLE_DENY, PROFILE_ALLOW];
    const ctx = await resolveAuthorizationContext({
      cid: "U1",
      role: "member",
      profiles: ["founder"],
    });
    expect(ctx.eligibility.ventures).toBe(true);
    expect(ctx.eligibilityWarnings.ventures).toBe("opened_by_profile");
  });

  test("rôle autorise : éligible SANS avertissement", async () => {
    mockEligibilityRows = [ROLE_ALLOW];
    const ctx = await resolveAuthorizationContext({
      cid: "U1",
      role: "member",
      profiles: [],
    });
    expect(ctx.eligibility.ventures).toBe(true);
    expect(ctx.eligibilityWarnings.ventures).toBeUndefined();
  });
});
