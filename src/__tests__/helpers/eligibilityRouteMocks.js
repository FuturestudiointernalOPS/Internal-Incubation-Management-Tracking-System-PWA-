/**
 * Fake DB + auth wiring for the eligibility-configuration route tests.
 *
 * The model layer is mocked (not the SQL) so the WHERE-free reads, the
 * previous-value read and the write choice stay observable as calls. The route
 * under test is always the REAL one.
 *
 * Every mutable answer lives on `mockState`, which keeps a stable identity:
 * `resetState()` clears it in place, so a suite can hold the exported reference.
 *
 * Every mock is a FACTORY, and a suite registers it as
 * `jest.mock("@/lib/db", () => mockElig.dbMock())`. Two reasons:
 *   - babel hoists the jest.mock calls above the suite's own require of this
 *     helper, so the reference must be `mock`-prefixed but cannot be read yet;
 *   - a factory that calls jest.requireActual must not run while this module is
 *     still loading, or it re-enters those same mock factories half-built.
 * Jest's registry is per test file, so the mocks are rebuilt for each suite.
 */

const mockState = {
  rows: [],
  userGroups: [],
  contactGroups: [],
  eligibilityRoles: [],
  roleDefaults: [],
  profiles: [],
  priorRow: null,
  // Per-ROLE probe answers, because the probe is asked once per downgrade and
  // a global stub would make every role look impacted.
  templateImpactsByRole: {},
  fallbackTemplateImpacts: [],
  session: { cid: "SA-1", name: "Super Admin" },
  authzDecision: null, // null = granted
  context: { isSuperAdmin: true, eligibility: {} },
  canConfigure: true,
  auditEntries: [],
  findTemplatesGrantingFeature: [],
};

function resetState() {
  for (const key of Object.keys(mockState)) delete mockState[key];
  Object.assign(mockState, {
  userGroups: [],
  contactGroups: [],
  eligibilityRoles: [],
  roleDefaults: [],
  profiles: [],
  priorRow: null,
  // Per-ROLE probe answers, because the probe is asked once per downgrade and
  // a global stub would make every role look impacted.
  templateImpactsByRole: {},
  fallbackTemplateImpacts: [],
  session: { cid: "SA-1", name: "Super Admin" },
  authzDecision: null, // null = granted
  context: { isSuperAdmin: true, eligibility: {} },
  canConfigure: true,
  auditEntries: [],
  findTemplatesGrantingFeature: [],
  });
}

// The engine's own vocabulary lives in the model + service, not in a barrel
// facade. `realEligibility()` names the module that owns MODULE_TO_FEATURE so
// the assertions compare against the real constant.
function realEligibility() {
  return jest.requireActual("@/models/authorization/eligibility");
}

function dbMock() {
  return {
    __esModule: true,
    default: { execute: jest.fn().mockResolvedValue({ rows: [] }) },
    initDb: jest.fn().mockResolvedValue(true),
  };
}

// The canConfigure decision lives in services/authorization/eligibilityConfiguration,
// which imports `authorize` from the context MODULE (the convention of blocks
// a-d: a service never imports the barrel that re-exports it). Mock the context
// module directly, sharing the same fn so both assertions point at one decision.
function authorizationContextMock() {
  return {
    ...jest.requireActual("@/services/authorization/context"),
    authorize: jest.fn().mockImplementation(() => mockState.canConfigure),
    getAuthorizationContext: jest.fn().mockImplementation(async () => mockState.context),
    invalidateAllAuthorizationContexts: jest.fn(),
  };
}

// The HTTP boundary is @/server/authz/responses, re-exported by the model barrel
// the route imports.
function responsesMock() {
  return {
    requireAuthorization: jest.fn().mockImplementation(async () => mockState.authzDecision),
    requireScopedAccess: jest.fn().mockResolvedValue(null),
  };
}

// The eligibility catalog comes from the real service; only the template-impact
// probe is stubbed so its per-role answers are observable.
function eligibilityAdminMock() {
  return {
    ...jest.requireActual("@/services/authorization/eligibilityAdmin"),
    findTemplatesGrantingFeature: jest.fn().mockImplementation(async (role, feature) => {
      mockState.findTemplatesGrantingFeature.push({ role, feature });
      const rows = Object.prototype.hasOwnProperty.call(mockState.templateImpactsByRole, role)
        ? mockState.templateImpactsByRole[role]
        : mockState.fallbackTemplateImpacts;
      return { rows };
    }),
  };
}

function authMock() {
  return {
    getSession: jest.fn().mockImplementation(async () => mockState.session),
    logPermissionAudit: jest.fn().mockImplementation(async (entry) => {
      mockState.auditEntries.push(entry);
      return true;
    }),
    ensurePermissionsSchema: jest.fn().mockResolvedValue(true),
    getUserGroups: jest.fn().mockResolvedValue([]),
    getUserEffectiveProfile: jest.fn().mockResolvedValue(null),
    seedDefaultRoleCapabilities: jest.fn().mockResolvedValue(true),
    ensureResponsibilitiesSchema: jest.fn().mockResolvedValue(true),
    seedDefaultResponsibilities: jest.fn().mockResolvedValue(true),
  };
}

function authorizationModelMock() {
  return {
    listFeatureEligibilityRows: jest.fn().mockImplementation(async () => ({ rows: mockState.rows })),
    listDistinctUserGroupNames: jest.fn().mockImplementation(async () => ({ rows: mockState.userGroups })),
    listDistinctContactGroupNames: jest.fn().mockImplementation(async () => ({ rows: mockState.contactGroups })),
    listEligibilityRoleIdentities: jest.fn().mockImplementation(async () => ({
      rows: mockState.eligibilityRoles,
    })),
    getEligibilityRow: jest.fn().mockImplementation(async () => ({
      rows: mockState.priorRow ? [mockState.priorRow] : [],
    })),
    deleteEligibilityRow: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
    upsertEligibilityRow: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
  };
}

// The role→profile defaults now come from the takeover's own store; the
// eligible profiles are read from the DB (profiles table) — never a hardcoded
// list — so the route's profile catalogue is stubbed here.
function profileCapabilitiesStoreMock() {
  return {
    // The eligibility read ensures the profile-capability schema before listing
    // the catalogue (that ALTER is what adds `profiles.label`).
    ensureProfileCapabilitiesSchema: jest.fn().mockResolvedValue(true),
    listRoleProfileDefaults: jest.fn().mockImplementation(async () => ({
      rows: mockState.roleDefaults,
    })),
  };
}

function profilesStoreMock() {
  return {
    ensureProfilesSchema: jest.fn().mockResolvedValue(true),
    listProfiles: jest.fn().mockImplementation(async () => ({ rows: mockState.profiles })),
  };
}

module.exports = {
  mockState,
  resetState,
  dbMock,
  realEligibility,
  authorizationContextMock,
  responsesMock,
  eligibilityAdminMock,
  authMock,
  authorizationModelMock,
  profileCapabilitiesStoreMock,
  profilesStoreMock,
};
