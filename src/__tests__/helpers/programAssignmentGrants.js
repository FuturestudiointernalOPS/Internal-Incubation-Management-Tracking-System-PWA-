/**
 * Fake database + fixtures for the assignment-derived program access suites.
 *
 * `mockExecute` answers the exact queries the assignment read model issues, so
 * the REAL models and services run against it. `mockState` keeps a stable
 * identity — `resetState` clears it in place instead of rebinding — so a suite
 * can hold the exported reference and still observe the reset.
 *
 * Suites register the mocks with `jest.mock("@/lib/db", () => mockGrants.dbMock)`;
 * the `mock` prefix is what babel-plugin-jest-hoist requires for an
 * out-of-scope reference. Jest's registry is per test file, so the mocks are
 * rebuilt for each suite that requires this helper.
 */

const PROGRAM_ACTIVE = "P-ACTIVE";
const PROGRAM_OPEN_ENDED = "P-OPEN";

const ALL_FACILITATOR_KEYS = require("@/lib/facilitator-permissions").FACILITATOR_CAPABILITY_KEYS;

const mockState = {};

function resetState() {
  for (const key of Object.keys(mockState)) delete mockState[key];
  Object.assign(mockState, {
    assignments: [],
    managedProgramIds: [],
    programDefaults: {}, // program_id → object
    profileCaps: [], // rows for access_profile_capabilities
    registry: null, // context_role_profiles row
    userCaps: [],
    applied: [],
    profileCapsQueriedFor: [],
  });
}

async function mockExecute(query) {
  const sqlText = typeof query === "string" ? query : query.sql || "";
  const args = typeof query === "string" ? [] : query.args || [];

  // Schema self-healing
  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sqlText)) return { rows: [] };

  // Registry mapping (program manager)
  if (sqlText.includes("FROM context_role_profiles")) {
    return { rows: mockState.registry ? [mockState.registry] : [] };
  }

  // Program defaults batch
  if (sqlText.includes("facilitator_default_permissions AS def")) {
    return {
      rows: args.map((id) => ({
        id,
        def: mockState.programDefaults[String(id)] ?? null,
      })),
    };
  }

  // Assignment rows (staff join)
  if (sqlText.includes("FROM v2_program_staff")) {
    return { rows: mockState.assignments };
  }

  // Named manager lookup
  if (sqlText.includes("assigned_pm_id AS TEXT) = ?")) {
    return {
      rows: mockState.managedProgramIds.map((id) => ({
        program_id: id,
        role_key: "program_manager",
        permissions: null,
        access_profile_id: null,
        end_date: null,
        status: "Active",
        is_archived: 0,
      })),
    };
  }

  // Profile capabilities (registry path + assignment profile path)
  if (sqlText.includes("FROM access_profile_capabilities")) {
    mockState.profileCapsQueriedFor.push(args);
    return { rows: mockState.profileCaps };
  }

  if (sqlText.includes("SELECT module, capability, access_level, granted_by, expires_at FROM user_capabilities")) {
    return { rows: mockState.userCaps.filter((row) => row.user_cid === String(args[0])) };
  }

  if (sqlText.includes("FROM context_applied_grants") && sqlText.includes("SELECT")) {
    const [cid, context, roleKey] = args;
    return {
      rows: mockState.applied.filter(
        (row) =>
          row.user_cid === cid && row.context === context && row.role_key === roleKey,
      ),
    };
  }

  if (sqlText.includes("INSERT INTO user_capabilities")) {
    const [user_cid, module, capability, access_level, granted_by, expires_at] = args;
    mockState.userCaps = mockState.userCaps.filter(
      (row) => !(row.user_cid === user_cid && row.module === module && row.capability === capability),
    );
    mockState.userCaps.push({
      user_cid,
      module,
      capability,
      access_level,
      granted_by,
      expires_at,
    });
    return { rows: [] };
  }

  if (sqlText.includes("INSERT INTO context_applied_grants")) {
    const [user_cid, context, role_key, source_ref, module, capability, access_level] = args;
    mockState.applied = mockState.applied.filter(
      (row) =>
        !(
          row.user_cid === user_cid &&
          row.context === context &&
          row.role_key === role_key &&
          row.module === module &&
          row.capability === capability
        ),
    );
    mockState.applied.push({
      user_cid,
      context,
      role_key,
      source_ref,
      module,
      capability,
      access_level,
    });
    return { rows: [] };
  }

  if (sqlText.includes("DELETE FROM user_capabilities")) {
    const [user_cid, module, capability, granted_by] = args;
    mockState.userCaps = mockState.userCaps.filter(
      (row) =>
        !(
          row.user_cid === user_cid &&
          row.module === module &&
          row.capability === capability &&
          row.granted_by === granted_by
        ),
    );
    return { rows: [] };
  }

  if (sqlText.includes("DELETE FROM context_applied_grants")) {
    if (args.length === 2) {
      const [user_cid, context, role_key] = args;
      mockState.applied = mockState.applied.filter(
        (row) =>
          !(row.user_cid === user_cid && row.context === context && row.role_key === role_key),
      );
      return { rows: [] };
    }
    const [user_cid, context, role_key, module, capability] = args;
    mockState.applied = mockState.applied.filter(
      (row) =>
        !(
          row.user_cid === user_cid &&
          row.context === context &&
          row.role_key === role_key &&
          row.module === module &&
          row.capability === capability
        ),
    );
    return { rows: [] };
  }

  return { rows: [] };
}

const dbMock = {
  __esModule: true,
  default: { execute: jest.fn(async (query) => mockExecute(query)) },
  initDb: jest.fn(async () => true),
};

// The context-grant service imports its cache invalidator from the
// authorization service (same layer), so the stub is wired on that path.
const authorizationContextMock = { invalidateAuthorizationContext: jest.fn() };

const CID = "USR_FACILITATOR_1";

/** Far-future so "active" means active regardless of the real clock. */
const OPEN_END = "2099-06-30";
const OPEN_END_ID = PROGRAM_ACTIVE;

/**
 * Resolved lazily: contextGrants pulls in @/lib/db, which the suite only has
 * mocked once this module has finished loading.
 */
function facilitatorSentinel() {
  const { contextGrantSentinel } = require("@/services/authorization/contextGrants");
  return contextGrantSentinel("program", "facilitator");
}

function assignment(programId, permissions, extra = {}) {
  return {
    program_id: programId,
    role_key: "facilitator",
    permissions: permissions ? JSON.stringify(permissions) : null,
    access_profile_id: null,
    ...extra,
  };
}

function ours(module, capability) {
  const sentinel = facilitatorSentinel();
  return mockState.userCaps.filter(
    (row) =>
      row.user_cid === CID &&
      row.module === module &&
      row.capability === capability &&
      row.granted_by === sentinel,
  );
}

module.exports = {
  mockState,
  resetState,
  mockExecute,
  dbMock,
  authorizationContextMock,
  assignment,
  ours,
  CID,
  OPEN_END,
  OPEN_END_ID,
  facilitatorSentinel,
  PROGRAM_ACTIVE,
  PROGRAM_OPEN_ENDED,
  ALL_FACILITATOR_KEYS,
};
