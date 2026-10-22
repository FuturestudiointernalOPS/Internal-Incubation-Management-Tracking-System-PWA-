/**
 * PHASE 9 (§12.3) — alerte de configuration : « plafond ouvert sans droit ».
 *
 * Un profil éligible à une fonctionnalité mais ne détenant AUCUN de ses droits
 * est un plafond qui n'ouvre sur rien. Le détecteur pur décide ; la route
 * d'éligibilité l'expose au GET pour que l'écran l'affiche.
 */

const mockElig = require("./helpers/eligibilityRouteMocks");

jest.mock("@/lib/db", () => mockElig.dbMock());
jest.mock("@/services/authorization/context", () => mockElig.authorizationContextMock());
jest.mock("@/server/authz/responses", () => mockElig.responsesMock());
jest.mock("@/services/authorization/eligibilityAdmin", () => mockElig.eligibilityAdminMock());
jest.mock("@/server/auth/session", () => ({ getSession: mockElig.authMock().getSession }));
jest.mock("@/models/authorization/accessQueries", () => {
  const m = mockElig.authMock();
  return { logPermissionAudit: m.logPermissionAudit, getUserGroups: m.getUserGroups };
});
jest.mock("@/models/authorization/bootstrap", () => {
  const m = mockElig.authMock();
  return {
    ensurePermissionsSchema: m.ensurePermissionsSchema,
    seedDefaultRoleCapabilities: m.seedDefaultRoleCapabilities,
    ensureResponsibilitiesSchema: m.ensureResponsibilitiesSchema,
    seedDefaultResponsibilities: m.seedDefaultResponsibilities,
  };
});
jest.mock("@/services/authorization/accessProfiles", () => ({
  getUserEffectiveProfile: mockElig.authMock().getUserEffectiveProfile,
}));
jest.mock("@/models/authorization", () => mockElig.authorizationModelMock());
jest.mock("@/models/authorization/profileCapabilitiesStore", () =>
  mockElig.profileCapabilitiesStoreMock(),
);
jest.mock("@/models/authorization/profilesStore", () => mockElig.profilesStoreMock());

const route = require("@/app/api/engineering/permissions/eligibility/route");
const { mockState, resetState } = require("./helpers/eligibilityRouteMocks");

beforeEach(() => {
  resetState();
  jest.clearAllMocks();
});

const eligibleProfileRow = (profileKey, featureKey) => ({
  feature_key: featureKey,
  identity_type: "profile",
  identity_value: profileKey,
  eligible: 1,
});

test("un profil éligible SANS droit déclenche une alerte", async () => {
  mockState.profiles = [{ key: "alpha" }];
  mockState.rows = [eligibleProfileRow("alpha", "finance")];
  mockState.profileCapabilitiesByKey = { alpha: [] };

  const body = await (await route.GET()).json();

  expect(body.ceilingAlerts).toEqual([
    expect.objectContaining({ identityType: "profile", identityValue: "alpha", feature: "finance" }),
  ]);
});

test("un profil éligible AVEC un droit de la fonctionnalité n'alerte pas", async () => {
  mockState.profiles = [{ key: "alpha" }];
  mockState.rows = [eligibleProfileRow("alpha", "finance")];
  // A finance-module right closes the ceiling.
  mockState.profileCapabilitiesByKey = {
    alpha: [{ module: "finance", capability: "view", access_level: 1 }],
  };

  const body = await (await route.GET()).json();

  expect(body.ceilingAlerts).toEqual([]);
});

test("un plafond FERMÉ (eligible=0) n'alerte jamais", async () => {
  mockState.profiles = [{ key: "alpha" }];
  mockState.rows = [
    { ...eligibleProfileRow("alpha", "finance"), eligible: 0 },
  ];
  mockState.profileCapabilitiesByKey = { alpha: [] };

  const body = await (await route.GET()).json();

  expect(body.ceilingAlerts).toEqual([]);
});

test("un profil actif sans rôle de base est signalé comme inassignable", async () => {
  mockState.profiles = [
    { key: "dead", allowed_roles: [] },
    { key: "staff_default", allowed_roles: ["staff"] },
  ];

  const body = await (await route.GET()).json();

  expect(body.unassignableProfiles).toEqual([{ key: "dead" }]);
});

test("un droit détenu sur un plafond explicitement fermé est signalé", async () => {
  mockState.profiles = [{ key: "alpha" }];
  // Explicit DENY row for finance on this profile…
  mockState.rows = [{ feature_key: "finance", identity_type: "profile", identity_value: "alpha", eligible: 0 }];
  // …yet the profile grants a finance-module right.
  mockState.profileCapabilitiesByKey = {
    alpha: [{ module: "finance", capability: "view", access_level: 1 }],
  };

  const body = await (await route.GET()).json();

  expect(body.rightAlerts).toEqual([
    expect.objectContaining({ identityType: "profile", identityValue: "alpha", feature: "finance", module: "finance" }),
  ]);
});

describe("findRightsOnClosedCeiling (pur)", () => {
  const { findRightsOnClosedCeiling } = require("@/services/authorization/eligibilityAdmin");

  test("signale un droit sur une fonctionnalité explicitement fermée", () => {
    const findings = findRightsOnClosedCeiling({
      closedEligibility: { finance: true },
      capabilities: { finance: { view: 1 } },
    });
    expect(findings).toEqual([{ feature: "finance", module: "finance", capabilities: ["view"] }]);
  });

  test("une ligne MANQUANTE n'est pas une violation (héritage possible)", () => {
    expect(
      findRightsOnClosedCeiling({ closedEligibility: {}, capabilities: { finance: { view: 1 } } }),
    ).toEqual([]);
  });

  test("un plafond fermé SANS droit est conforme", () => {
    expect(
      findRightsOnClosedCeiling({ closedEligibility: { finance: true }, capabilities: { finance: {} } }),
    ).toEqual([]);
  });
});

describe("findUnassignableProfiles (pur)", () => {
  const { findUnassignableProfiles } = require("@/services/authorization/eligibilityAdmin");

  test("détecte un allowed_roles vide (tableau, JSON ou null)", () => {
    expect(findUnassignableProfiles([{ key: "a", allowed_roles: [] }])).toEqual([{ key: "a" }]);
    expect(findUnassignableProfiles([{ key: "b", allowed_roles: "[]" }])).toEqual([{ key: "b" }]);
    expect(findUnassignableProfiles([{ key: "c", allowed_roles: null }])).toEqual([{ key: "c" }]);
  });

  test("ne signale pas un profil avec au moins un rôle", () => {
    expect(findUnassignableProfiles([{ key: "a", allowed_roles: ["staff"] }])).toEqual([]);
    expect(findUnassignableProfiles([{ key: "a", allowed_roles: '["member"]' }])).toEqual([]);
  });
});
