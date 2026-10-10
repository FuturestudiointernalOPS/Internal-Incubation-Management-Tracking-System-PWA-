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
  mockState.rows = [eligibleProfileRow("alpha", "crm")];
  mockState.profileCapabilitiesByKey = { alpha: [] };

  const body = await (await route.GET()).json();

  expect(body.ceilingAlerts).toEqual([
    expect.objectContaining({ identityType: "profile", identityValue: "alpha", feature: "crm" }),
  ]);
});

test("un profil éligible AVEC un droit de la fonctionnalité n'alerte pas", async () => {
  mockState.profiles = [{ key: "alpha" }];
  mockState.rows = [eligibleProfileRow("alpha", "crm")];
  // A crm-module right (contacts → feature crm) closes the ceiling.
  mockState.profileCapabilitiesByKey = {
    alpha: [{ module: "contacts", capability: "view", access_level: 1 }],
  };

  const body = await (await route.GET()).json();

  expect(body.ceilingAlerts).toEqual([]);
});

test("un plafond FERMÉ (eligible=0) n'alerte jamais", async () => {
  mockState.profiles = [{ key: "alpha" }];
  mockState.rows = [
    { ...eligibleProfileRow("alpha", "crm"), eligible: 0 },
  ];
  mockState.profileCapabilitiesByKey = { alpha: [] };

  const body = await (await route.GET()).json();

  expect(body.ceilingAlerts).toEqual([]);
});
