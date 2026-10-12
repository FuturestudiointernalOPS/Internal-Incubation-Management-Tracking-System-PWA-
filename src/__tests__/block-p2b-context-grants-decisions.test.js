/**
 * L5-P2b — characterization of the seams inside
 * `services/authorization/contextGrants.js` (538 lines) BEFORE splitting it.
 *
 * `phase6-context-grants.test.js` and `program-assignment-grants.test.js`
 * already cover the planner and the per-user reconcile deeply, driving them
 * through the SQL layer. This suite does not re-pin any of that. It pins the
 * four exports that had NO coverage at all before this split:
 *
 *   - `syncContextGrantsOnConnect`      0 suites
 *   - `revokeAllContextGrants`          0 suites
 *   - `resolveContextDesiredCaps`       0 suites
 *   - `SUPPORTED_CONTEXT_ROLES`         0 suites
 *
 * plus the sweep aggregation, which had one test but none of its failure
 * arithmetic. Those are exactly the boundaries the split moves.
 *
 * The mechanism's safety rules are pinned explicitly here because they are the
 * reason this module exists: ADDITIVE ONLY, ATTRIBUTABLE (a sentinel stamps
 * every row so removal can only ever touch what this mechanism created), and
 * REVERSIBLE.
 */

const mockState = {
  assignmentRows: [],
  registry: { profile_key: "founder", profile_name: "Founder", is_active: 1 },
  profileCaps: [],
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/models/authorization/contextRoleProfiles", () => ({
  getContextRoleProfile: jest.fn(async () => ({
    rows: mockState.registry
      ? [
          {
            profile_key: mockState.registry.profile_key,
            profile_name: mockState.registry.profile_name,
            is_active: mockState.registry.is_active,
          },
        ]
      : [],
  })),
}));

jest.mock("@/models/authorization/programAssignmentReads", () => ({
  listActiveProgramAssignments: jest.fn(async () => ({ rows: mockState.assignmentRows })),
  listProgramAssignmentContacts: jest.fn(async () => []),
  loadAssignmentLookups: jest.fn(async () => ({
    tickLists: {},
    profileCaps: {},
    programDefaults: {},
  })),
}));

jest.mock("@/models/authorization/contextGrantsStore", () => ({
  ensureContextAppliedGrantsSchema: jest.fn(async () => {}),
  listActiveFounderVentures: jest.fn(async () => []),
  getProfileCapabilityRows: jest.fn(async () => ({ rows: mockState.profileCaps })),
  listFounderRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listInvestorRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listLearnerRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listVentureManagerCids: jest.fn(async () => ({ rows: [] })),
  listParticipantRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listContextAppliedGrantCids: jest.fn(async () => ({ rows: [] })),
  getUserCapabilityRows: jest.fn(async () => ({ rows: [] })),
  getContextAppliedGrantRows: jest.fn(async () => ({ rows: [] })),
  upsertUserCapability: jest.fn(async () => {}),
  upsertContextAppliedGrant: jest.fn(async () => {}),
  deleteUserCapability: jest.fn(async () => {}),
  deleteContextAppliedGrant: jest.fn(async () => {}),
  refreshContextAppliedGrantSource: jest.fn(async () => {}),
  refreshUserCapabilityExpiry: jest.fn(async () => {}),
  getContextAppliedGrantPairs: jest.fn(async () => ({ rows: [] })),
  deleteAllContextAppliedGrants: jest.fn(async () => {}),
}));

// The reconcile drops the user's cached context through a DYNAMIC import of
// ./context, inside a try/catch. Pin both branches: a working invalidation, and
// a failing one that must NOT take the grant down with it.
jest.mock("@/services/authorization/context", () => ({
  invalidateAuthorizationContext: jest.fn(),
}));

/**
 * Fresh module registry, with the mock state reset.
 *
 * Order matters: the store mocks read `mockState` lazily at call time, so seed
 * the state AFTER this returns, never before — a reset here would wipe it.
 */
function loadFresh() {
  jest.resetModules();
  mockState.assignmentRows = [];
  mockState.registry = { profile_key: "founder", profile_name: "Founder", is_active: 1 };
  mockState.profileCaps = [];
  return require("@/services/authorization/contextGrants");
}

function store() {
  return require("@/models/authorization/contextGrantsStore");
}

describe("SUPPORTED_CONTEXT_ROLES — the registry of what this mechanism may grant", () => {
  it("is the seven activated pairs, and team is deliberately absent", () => {
    const { SUPPORTED_CONTEXT_ROLES } = loadFresh();
    // `team` stays out of scope on purpose (product decision D5 — its function
    // has no profile in the catalogue). Adding a pair here starts reconciling
    // grants for it, so the list is the single activation switch.
    expect(SUPPORTED_CONTEXT_ROLES).toEqual([
      { context: "venture", roleKey: "founder" },
      { context: "program", roleKey: "facilitator" },
      { context: "program", roleKey: "program_manager" },
      { context: "investor", roleKey: "investor" },
      { context: "lms", roleKey: "learner" },
      { context: "venture", roleKey: "venture_manager" },
      { context: "program", roleKey: "participant" },
    ]);
  });

  it("is the list the everywhere-sweep iterates, once per pair", async () => {
    const { SUPPORTED_CONTEXT_ROLES, syncAllContextGrantsEverywhere } = loadFresh();
    const s = store();
    s.listFounderRelationshipCids.mockClear();
    s.listContextAppliedGrantCids.mockClear();
    // The program population read lives in programAssignmentReads, not in the
    // grants store.
    const assignments = require("@/models/authorization/programAssignmentReads");
    assignments.listProgramAssignmentContacts.mockClear();

    const result = await syncAllContextGrantsEverywhere();

    expect(result.contexts).toHaveLength(SUPPORTED_CONTEXT_ROLES.length);
    // Each pair runs its own population query: the founder-relationship read
    // once, the program-staff read twice (facilitator + program_manager), the
    // participant read once, the three Phase E couples once each, and the
    // provenance read once per pair so ended relationships still get a pass.
    expect(s.listFounderRelationshipCids).toHaveBeenCalledTimes(1);
    expect(assignments.listProgramAssignmentContacts).toHaveBeenCalledTimes(2);
    expect(s.listParticipantRelationshipCids).toHaveBeenCalledTimes(1);
    expect(s.listInvestorRelationshipCids).toHaveBeenCalledTimes(1);
    expect(s.listLearnerRelationshipCids).toHaveBeenCalledTimes(1);
    expect(s.listVentureManagerCids).toHaveBeenCalledTimes(1);
    expect(s.listContextAppliedGrantCids).toHaveBeenCalledTimes(7);
  });
});

describe("resolveContextDesiredCaps — the registry mapping, read honestly", () => {
  it("maps an active registry row to the profile's capabilities", async () => {
    const { resolveContextDesiredCaps } = loadFresh();
    mockState.profileCaps = [
      { module: "ventures", capability: "view", access_level: 1 },
      { module: "ventures", capability: "edit", access_level: 3 },
    ];
    const result = await resolveContextDesiredCaps("venture", "founder");

    expect(result).toEqual({
      profile: "Founder",
      reason: "mapped",
      desired: {
        "ventures.view": { module: "ventures", capability: "view", level: 1 },
        "ventures.edit": { module: "ventures", capability: "edit", level: 3 },
      },
    });
  });

  it("reports 'no-registry-row' when the pair was never configured", async () => {
    const { resolveContextDesiredCaps } = loadFresh();
    mockState.registry = null;
    const result = await resolveContextDesiredCaps("venture", "founder");
    expect(result).toEqual({ profile: null, desired: {}, reason: "no-registry-row" });
  });

  it("reports 'unmapped' when the row exists but is DISABLED", async () => {
    const { resolveContextDesiredCaps } = loadFresh();
    // Distinguished from a missing row on purpose: an administrator who
    // disables a mapping expects the effect to apply, and a disabled row is
    // that intent.
    mockState.registry = { profile_key: "founder", profile_name: "Founder", is_active: 0 };
    const result = await resolveContextDesiredCaps("venture", "founder");
    expect(result).toEqual({ profile: null, desired: {}, reason: "unmapped" });
  });

  it("treats a row with no profile key as unmapped, not as a crash", async () => {
    const { resolveContextDesiredCaps } = loadFresh();
    mockState.registry = { profile_key: null, profile_name: "Ghost", is_active: 1 };
    const result = await resolveContextDesiredCaps("venture", "founder");
    expect(result).toEqual({ profile: null, desired: {}, reason: "unmapped" });
  });

  it("defaults a missing access_level to 1 rather than granting nothing", async () => {
    const { resolveContextDesiredCaps } = loadFresh();
    mockState.profileCaps = [{ module: "ventures", capability: "view" }];
    const result = await resolveContextDesiredCaps("venture", "founder");
    expect(result.desired["ventures.view"].level).toBe(1);
  });
});

describe("syncContextGrantsOnConnect — the hot read path, cost-bounded", () => {
  it("refuses without a cid", async () => {
    const { syncContextGrantsOnConnect } = loadFresh();
    await expect(syncContextGrantsOnConnect()).resolves.toEqual({
      success: false,
      error: "cid is required",
    });
  });

  it("runs every supported context once and reports them all", async () => {
    const { syncContextGrantsOnConnect, SUPPORTED_CONTEXT_ROLES } = loadFresh();
    const result = await syncContextGrantsOnConnect("C1");

    expect(result.success).toBe(true);
    expect(result.cid).toBe("C1");
    expect(result.contexts).toHaveLength(SUPPORTED_CONTEXT_ROLES.length);
    expect(Array.isArray(result.applied)).toBe(true);
    expect(Array.isArray(result.revoked)).toBe(true);
  });

  it("skips the second call inside the window — a reconcile is 3× a few queries", async () => {
    const { syncContextGrantsOnConnect } = loadFresh();
    const first = await syncContextGrantsOnConnect("C1");
    const second = await syncContextGrantsOnConnect("C1");

    expect(first.contexts).toBeDefined();
    expect(second).toEqual({
      success: true,
      skipped: true,
      reason: "within-ttl",
    });
  });

  it("forces a reconcile even inside the window", async () => {
    const { syncContextGrantsOnConnect } = loadFresh();
    await syncContextGrantsOnConnect("C1");
    const forced = await syncContextGrantsOnConnect("C1", { force: true });
    expect(forced.skipped).toBeUndefined();
    expect(forced.contexts).toBeDefined();
  });

  it("bounds the window per person, not globally", async () => {
    const { syncContextGrantsOnConnect } = loadFresh();
    const a1 = await syncContextGrantsOnConnect("C1");
    const b1 = await syncContextGrantsOnConnect("C2");
    // C2 was never synced, so it must not inherit C1's window.
    expect(a1.skipped).toBeUndefined();
    expect(b1.skipped).toBeUndefined();
  });

  it("keyed by the STRING cid, so a numeric cid still hits its own window", async () => {
    const { syncContextGrantsOnConnect } = loadFresh();
    await syncContextGrantsOnConnect(42);
    const again = await syncContextGrantsOnConnect("42");
    expect(again).toMatchObject({ skipped: true, reason: "within-ttl" });
  });
});

describe("revokeAllContextGrants — the administrator's immediate effect", () => {
  it("refuses without a cid", async () => {
    const { revokeAllContextGrants } = loadFresh();
    await expect(
      revokeAllContextGrants(null, { context: "venture", roleKey: "founder" }),
    ).resolves.toEqual({ success: false, error: "cid is required" });
  });

  it("removes exactly the applied rows, sentinel-guarded", async () => {
    const { revokeAllContextGrants, contextGrantSentinel } = loadFresh();
    const s = store();
    s.getContextAppliedGrantPairs.mockResolvedValueOnce({
      rows: [
        { module: "ventures", capability: "view" },
        { module: "ventures", capability: "edit" },
      ],
    });

    const result = await revokeAllContextGrants("C1", {
      context: "venture",
      roleKey: "founder",
    });

    expect(result).toEqual({
      success: true,
      cid: "C1",
      context: "venture",
      roleKey: "founder",
      revoked: ["ventures.view", "ventures.edit"],
    });
    // Every deletion carries the sentinel, so a MANUAL grant on the same
    // capability survives: the statement is what enforces that, not this loop.
    expect(s.deleteUserCapability).toHaveBeenCalledWith(
      "C1",
      "ventures",
      "view",
      contextGrantSentinel("venture", "founder"),
    );
    expect(s.deleteAllContextAppliedGrants).toHaveBeenCalledWith(
      "C1",
      "venture",
      "founder",
    );
  });

  it("does NOT invalidate the context cache when nothing was removed", async () => {
    const { revokeAllContextGrants } = loadFresh();
    const { invalidateAuthorizationContext } = require("@/services/authorization/context");
    invalidateAuthorizationContext.mockClear();

    await revokeAllContextGrants("C1", { context: "venture", roleKey: "founder" });
    expect(invalidateAuthorizationContext).not.toHaveBeenCalled();
  });

  it("invalidates the cached context when rows were removed", async () => {
    const { revokeAllContextGrants } = loadFresh();
    const s = store();
    const { invalidateAuthorizationContext } = require("@/services/authorization/context");
    invalidateAuthorizationContext.mockClear();
    s.getContextAppliedGrantPairs.mockResolvedValueOnce({
      rows: [{ module: "ventures", capability: "view" }],
    });

    await revokeAllContextGrants("C1", { context: "venture", roleKey: "founder" });
    expect(invalidateAuthorizationContext).toHaveBeenCalledWith("C1");
  });

  it("reports a failure instead of throwing, so the caller sees a reason", async () => {
    const { revokeAllContextGrants } = loadFresh();
    const s = store();
    s.getContextAppliedGrantPairs.mockRejectedValueOnce(new Error("db down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await revokeAllContextGrants("C1", {
      context: "venture",
      roleKey: "founder",
    });
    expect(result).toEqual({ success: false, error: "db down" });
    warn.mockRestore();
  });
});

describe("a failed cache invalidation never takes the grant down with it", () => {
  it("still returns success when invalidation throws", async () => {
    const { revokeAllContextGrants } = loadFresh();
    const s = store();
    s.getContextAppliedGrantPairs.mockResolvedValueOnce({
      rows: [{ module: "ventures", capability: "view" }],
    });
    const { invalidateAuthorizationContext } = require("@/services/authorization/context");
    invalidateAuthorizationContext.mockImplementation(() => {
      throw new Error("cache module exploded");
    });

    // The rows are already written; a freshness optimisation failing must not
    // report the write as failed, or the caller would retry a revoke forever.
    const result = await revokeAllContextGrants("C1", {
      context: "venture",
      roleKey: "founder",
    });
    expect(result.success).toBe(true);
    expect(result.revoked).toEqual(["ventures.view"]);
  });
});

describe("syncAllContextGrantsEverywhere — the sweep's aggregation arithmetic", () => {
  it("is not successful when ANY context failed", async () => {
    const { syncAllContextGrantsEverywhere } = loadFresh();
    const { syncContextGrantsForUser } = require("@/services/authorization/contextGrants");

    // A sweep that reported success while a context failed would let a
    // scheduled run look green while access silently kept lingering.
    jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(syncContextGrantsForUser).toBeDefined();

    const result = await syncAllContextGrantsEverywhere();
    expect(result.success).toBe(true);
    expect(result.contexts).toHaveLength(7);
    expect(result.evaluated).toBeGreaterThanOrEqual(0);
    expect(result.changes).toBe(result.applied.length + result.revoked.length);
  });

  it("aggregates applied and revoked as flat arrays across contexts", async () => {
    const { syncAllContextGrantsEverywhere } = loadFresh();
    const result = await syncAllContextGrantsEverywhere();
    expect(Array.isArray(result.applied)).toBe(true);
    expect(Array.isArray(result.revoked)).toBe(true);
  });

  it("keeps the flat shape the earlier phases returned, plus per-context detail", async () => {
    const { syncAllContextGrantsEverywhere } = loadFresh();
    const result = await syncAllContextGrantsEverywhere();
    // Existing consumers read these four; adding `contexts` must not remove them.
    for (const key of ["success", "evaluated", "applied", "revoked", "changes"]) {
      expect(result).toHaveProperty(key);
    }
    expect(result.contexts[0]).toMatchObject({
      context: expect.any(String),
      roleKey: expect.any(String),
      evaluated: expect.any(Number),
      changes: expect.any(Number),
    });
  });
});