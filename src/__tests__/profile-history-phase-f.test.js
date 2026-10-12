/**
 * PHASE F — the residual read (docs/ROADMAP_ROLES_PROFILES_ACCESS.md).
 *
 * When a managed relationship ends, the ACTIVE grants are withdrawn but the
 * person keeps a READ-ONLY consultation of what they managed. Three surfaces:
 *
 *   1. the PURE mapping (context → the `<module>.view` ceiling) and the pure
 *      context-id extraction;
 *   2. the SYNC — apply / idempotent re-run / withdraw — against mocked stores,
 *      pinning the ISOLATION (a distinct provenance role_key and grant stamp,
 *      so the active reconcile can never touch the residual and vice versa);
 *   3. the scope catalogue gaining the two historical policies.
 */

const mockGetUserCapabilityRows = jest.fn();
const mockGetContextAppliedGrantRows = jest.fn();
const mockUpsertUserCapability = jest.fn();
const mockUpsertContextAppliedGrant = jest.fn();
const mockDeleteUserCapability = jest.fn();
const mockDeleteContextAppliedGrant = jest.fn();
const mockRefreshContextAppliedGrantSource = jest.fn();

jest.mock("@/models/authorization/contextGrantsStore", () => ({
  getUserCapabilityRows: (...args) => mockGetUserCapabilityRows(...args),
  getContextAppliedGrantRows: (...args) => mockGetContextAppliedGrantRows(...args),
  upsertUserCapability: (...args) => mockUpsertUserCapability(...args),
  upsertContextAppliedGrant: (...args) => mockUpsertContextAppliedGrant(...args),
  deleteUserCapability: (...args) => mockDeleteUserCapability(...args),
  deleteContextAppliedGrant: (...args) => mockDeleteContextAppliedGrant(...args),
  refreshContextAppliedGrantSource: (...args) => mockRefreshContextAppliedGrantSource(...args),
}));

jest.mock("@/models/authorization/profileAssignmentsStore", () => ({
  ensureProfileAssignmentsSchema: jest.fn(async () => true),
  listEndedAutomaticAssignments: jest.fn(),
}));

jest.mock("@/services/authorization/profileCatalog", () => ({
  profileKeyForContextRole: jest.fn(),
}));

const {
  readingCapabilitiesForContext,
  endedContextIds,
  syncContextGrantsHistory,
} = require("@/services/authorization/contextGrantHistory");
const assignments = require("@/models/authorization/profileAssignmentsStore");
const { profileKeyForContextRole } = require("@/services/authorization/profileCatalog");
const {
  SCOPE_POLICIES,
  SCOPE_POLICY_KEYS,
  isScopePolicyImplemented,
} = require("@/models/authorization/scope-catalog");

beforeEach(() => {
  for (const fn of [
    mockGetUserCapabilityRows,
    mockGetContextAppliedGrantRows,
    mockUpsertUserCapability,
    mockUpsertContextAppliedGrant,
    mockDeleteUserCapability,
    mockDeleteContextAppliedGrant,
    mockRefreshContextAppliedGrantSource,
  ]) {
    fn.mockReset();
    fn.mockResolvedValue({ rows: [], rowsAffected: 1 });
  }
  assignments.listEndedAutomaticAssignments.mockReset();
  assignments.ensureProfileAssignmentsSchema.mockResolvedValue(true);
  profileKeyForContextRole.mockReset();
  profileKeyForContextRole.mockImplementation((_context, roleKey) => `${roleKey}`);
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("readingCapabilitiesForContext — the read ceiling of a context", () => {
  test("program grants programs.view only (the facilitator block has no view)", () => {
    expect(Object.keys(readingCapabilitiesForContext("program"))).toEqual(["programs.view"]);
  });

  test("venture, lms and investor each grant their module's view", () => {
    expect(readingCapabilitiesForContext("venture")).toEqual({
      "ventures.view": { module: "ventures", capability: "view", level: 1 },
    });
    expect(readingCapabilitiesForContext("lms")).toEqual({
      "lms.view": { module: "lms", capability: "view", level: 1 },
    });
    expect(readingCapabilitiesForContext("investor")).toEqual({
      "investor.view": { module: "investor", capability: "view", level: 1 },
    });
  });

  test("an unknown context grants nothing (fail closed)", () => {
    expect(readingCapabilitiesForContext("ghost")).toEqual({});
    expect(readingCapabilitiesForContext(null)).toEqual({});
  });
});

describe("endedContextIds", () => {
  test("deduplicates, orders by first sight, drops nulls", () => {
    expect(
      endedContextIds([
        { context_id: "P1" },
        { context_id: "P2" },
        { context_id: "P1" },
        { context_id: null },
        {},
      ]),
    ).toEqual(["P1", "P2"]);
  });
});

describe("syncContextGrantsHistory — apply / idempotent / withdraw", () => {
  test("applies the residual read with its own stamp and provenance namespace", async () => {
    assignments.listEndedAutomaticAssignments.mockResolvedValue({
      rows: [{ context_id: "P1" }],
    });
    mockGetUserCapabilityRows.mockResolvedValue({ rows: [] });
    mockGetContextAppliedGrantRows.mockResolvedValue({ rows: [] });

    const report = await syncContextGrantsHistory("C1", {
      context: "program",
      roleKey: "program_manager",
    });

    expect(report.applied).toEqual(["programs.view"]);
    expect(report.contextIds).toEqual(["P1"]);
    expect(mockUpsertUserCapability).toHaveBeenCalledWith(
      "C1",
      expect.objectContaining({
        module: "programs",
        capability: "view",
        level: 1,
        sentinel: "hist:program:program_manager",
        expiresAt: null,
      }),
    );
    expect(mockUpsertContextAppliedGrant).toHaveBeenCalledWith(
      "C1",
      expect.objectContaining({
        context: "program",
        roleKey: "history:program_manager",
        mode: "historical",
      }),
    );
  });

  test("re-running changes nothing (idempotent) but keeps the context list fresh", async () => {
    assignments.listEndedAutomaticAssignments.mockResolvedValue({
      rows: [{ context_id: "P1" }],
    });
    mockGetUserCapabilityRows.mockResolvedValue({
      rows: [
        {
          module: "programs",
          capability: "view",
          access_level: 1,
          granted_by: "hist:program:program_manager",
        },
      ],
    });
    mockGetContextAppliedGrantRows.mockResolvedValue({
      rows: [{ module: "programs", capability: "view" }],
    });

    const report = await syncContextGrantsHistory("C1", {
      context: "program",
      roleKey: "program_manager",
    });

    expect(report.applied).toEqual([]);
    expect(report.revoked).toEqual([]);
    expect(mockUpsertUserCapability).not.toHaveBeenCalled();
    expect(mockRefreshContextAppliedGrantSource).toHaveBeenCalledWith(
      "C1",
      "program",
      "history:program_manager",
      "P1",
    );
  });

  test("no ended card withdraws the residual (the relationship reopened)", async () => {
    assignments.listEndedAutomaticAssignments.mockResolvedValue({ rows: [] });
    mockGetUserCapabilityRows.mockResolvedValue({ rows: [] });
    mockGetContextAppliedGrantRows.mockResolvedValue({
      rows: [{ module: "programs", capability: "view" }],
    });

    const report = await syncContextGrantsHistory("C1", {
      context: "program",
      roleKey: "program_manager",
    });

    expect(report.revoked).toEqual(["programs.view"]);
    expect(mockDeleteUserCapability).toHaveBeenCalledWith(
      "C1",
      "programs",
      "view",
      "hist:program:program_manager",
    );
    expect(mockDeleteContextAppliedGrant).toHaveBeenCalledWith(
      "C1",
      "program",
      "history:program_manager",
      "programs",
      "view",
    );
  });

  test("a couple the catalogue does not know writes nothing", async () => {
    profileKeyForContextRole.mockReturnValue(null);

    const report = await syncContextGrantsHistory("C1", {
      context: "program",
      roleKey: "ghost",
    });

    expect(report).toEqual({ applied: [], revoked: [], contextIds: [] });
    expect(mockUpsertUserCapability).not.toHaveBeenCalled();
  });
});

describe("scope catalogue — the two historical policies", () => {
  test("both are declared, implemented and never silently allowed", () => {
    expect(SCOPE_POLICY_KEYS).toContain("venture_managed_history");
    expect(SCOPE_POLICY_KEYS).toContain("program_managed_history");
    expect(SCOPE_POLICIES.venture_managed_history.resource).toBe("venture");
    expect(SCOPE_POLICIES.program_managed_history.resource).toBe("program");
    expect(isScopePolicyImplemented("venture_managed_history")).toBe(true);
    expect(isScopePolicyImplemented("program_managed_history")).toBe(true);
  });
});
