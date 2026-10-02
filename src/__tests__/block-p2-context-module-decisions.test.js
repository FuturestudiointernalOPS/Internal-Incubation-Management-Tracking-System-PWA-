/**
 * L5-P2 — characterization of the seams inside `services/authorization/context.js`
 * BEFORE splitting that 560-line module in two.
 *
 * `authorization-resolver.test.js` already covers the pure algebra (merge
 * semantics, `authorize`, `buildPermissionExplanation`) with 112 tests. This
 * suite deliberately does NOT re-pin that. It pins the three things the split
 * is about to cut, because those are the parts with no coverage today:
 *
 *   1. the context CACHE lifecycle — TTL, role-keyed entries, inflight
 *      sharing, prefix invalidation, workspace-cache coupling;
 *   2. the eligibility BOOTSTRAP — seed-once-per-process semantics, and in
 *      particular that a failed seed is swallowed yet still marked attempted;
 *   3. the SERVICE SURFACE — that `services/authorization/context` exports the
 *      whole decision surface and the service barrel re-exports it unchanged, so
 *      the endpoint suites that `jest.mock("@/services/authorization/context")`
 *      keep reaching routes through the barrel. (The old
 *      `models/authorization/resolver` facade was deleted once nothing imported
 *      it — see docs/LAYER_SPLIT.md §3 — so the contract now lives on the
 *      service, not on a facade.)
 *
 * If any of these change during the split, this suite is the thing that says so.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

const mockResolve = jest.fn();
const mockDropWorkspaceContext = jest.fn();
const mockDropAllWorkspaceContexts = jest.fn();

jest.mock("@/services/authorization/context", () =>
  jest.requireActual("@/services/authorization/context"),
);

jest.mock("@/models/authorization/contextReads", () => ({
  getUserCapabilityGrants: jest.fn(async () => ({ rows: [] })),
  getUserCapabilityRestrictions: jest.fn(async () => ({ rows: [] })),
  getContactAccessProfileAndGroup: jest.fn(async () => ({ rows: [{}] })),
  getActiveAccessProfileById: jest.fn(async () => ({ rows: [] })),
  getRoleDefaultAccessProfile: jest.fn(async () => ({ rows: [] })),
  getBaseCapabilityRows: jest.fn(async () => ({ rows: [] })),
  getGroupCapabilityRows: jest.fn(async () => ({ rows: [] })),
  getFeatureEligibilityRows: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/lib/workspaceContextCache", () => ({
  dropWorkspaceContext: (...args) => mockDropWorkspaceContext(...args),
  dropAllWorkspaceContexts: (...args) => mockDropAllWorkspaceContexts(...args),
}));

const mockMigrations = [];
const mockEnsureSchema = jest.fn(async () => {});

jest.mock("@/models/authorization/migrations", () => ({
  runAuthzMigration: jest.fn(async (marker, seed) => {
    mockMigrations.push(marker);
    if (typeof seed === "function") await seed();
  }),
}));

// Spread the real module: services/authorization/eligibilityAdmin.js — which the
// barrel pulls in — reads MODULE_TO_FEATURE and FEATURE_ELIGIBILITY_DEFAULTS from
// here, and a hand-written mock of this module breaks the barrel's load. Only
// the bootstrap call and the six seeds are stubbed; what this suite asserts is
// the marker list and the once-per-process behaviour, never the seed SQL.
jest.mock("@/models/authorization/eligibility", () => ({
  ...jest.requireActual("@/models/authorization/eligibility"),
  ensureEligibilitySchema: (...args) => mockEnsureSchema(...args),
  seedDefaultEligibility: jest.fn(async () => {}),
  seedLmsFeatureEligibility: jest.fn(async () => {}),
  seedVenturesMemberEligibility: jest.fn(async () => {}),
  seedVenturesFounderEligibility: jest.fn(async () => {}),
  seedTemplateCeilingEligibility: jest.fn(async () => {}),
  seedProgramAssignmentEligibility: jest.fn(async () => {}),
}));

jest.mock("@/models/authorization/backfill", () => ({
  ensureCapabilityBackfills: jest.fn(async () => {}),
}));

/**
 * A fresh module registry per test: the cache and the bootstrap flag are
 * module-level state, and several assertions below are precisely ABOUT that
 * state being per-process.
 */
function loadFresh() {
  jest.resetModules();
  mockMigrations.length = 0;
  mockResolve.mockReset();
  mockDropWorkspaceContext.mockReset();
  mockDropAllWorkspaceContexts.mockReset();
  return require("@/services/authorization/context");
}

describe("cache — the context is resolved once per identity per TTL", () => {
  it("refuses to resolve without a cid", async () => {
    const ctx = loadFresh();
    await expect(ctx.getAuthorizationContext(null)).resolves.toBeNull();
    await expect(ctx.getAuthorizationContext({})).resolves.toBeNull();
  });

  it("reuses one resolution for the same cid AND role inside the TTL", async () => {
    const ctx = loadFresh();
    // The cache wraps getAuthorizationContext's own resolver; drive it through
    // the real resolver but count the repository reads instead of stubbing.
    const reads = require("@/models/authorization/contextReads");
    reads.getUserCapabilityGrants.mockClear();

    const first = await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });
    const second = await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });

    expect(second).toBe(first);
    // Only the boot resolution happened; the second call was served from cache.
    expect(reads.getUserCapabilityGrants).toHaveBeenCalledTimes(1);
  });

  it("keys the cache on cid AND role, so a role change is not served stale", async () => {
    const ctx = loadFresh();
    const reads = require("@/models/authorization/contextReads");
    reads.getUserCapabilityGrants.mockClear();

    await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });
    await ctx.getAuthorizationContext({ cid: "C1", role: "mentor" });

    // Same person, two roles => two entries. Serving the second from the first
    // would hand a mentor the staff matrix.
    expect(reads.getUserCapabilityGrants).toHaveBeenCalledTimes(2);
  });

  it("shares ONE resolution between callers that arrive before it completes", async () => {
    const ctx = loadFresh();
    const reads = require("@/models/authorization/contextReads");
    reads.getUserCapabilityGrants.mockClear();

    // Concurrent, uncached: a cold page load fires several authorized requests
    // at once and every one of them used to run the same resolution.
    const [a, b, c] = await Promise.all([
      ctx.getAuthorizationContext({ cid: "C1", role: "staff" }),
      ctx.getAuthorizationContext({ cid: "C1", role: "staff" }),
      ctx.getAuthorizationContext({ cid: "C1", role: "staff" }),
    ]);

    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(reads.getUserCapabilityGrants).toHaveBeenCalledTimes(1);
  });

  it("drops only the named identity, by prefix", async () => {
    const ctx = loadFresh();
    const reads = require("@/models/authorization/contextReads");
    reads.getUserCapabilityGrants.mockClear();

    await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });
    await ctx.getAuthorizationContext({ cid: "C1", role: "mentor" });
    await ctx.getAuthorizationContext({ cid: "C2", role: "staff" });

    ctx.invalidateAuthorizationContext("C1");
    await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });
    await ctx.getAuthorizationContext({ cid: "C2", role: "staff" });

    // 3 resolutions, then C1/staff resolves again while C2 is served from
    // cache. C1/mentor is not re-read because it was not requested again.
    expect(reads.getUserCapabilityGrants).toHaveBeenCalledTimes(4);
  });

  it("is a no-op without a cid, and never drops the workspace cache", async () => {
    const ctx = loadFresh();
    ctx.invalidateAuthorizationContext();
    ctx.invalidateAuthorizationContext("");
    expect(mockDropWorkspaceContext).not.toHaveBeenCalled();
  });

  it("couples the workspace-context drop to the authorization drop", async () => {
    const ctx = loadFresh();
    ctx.invalidateAuthorizationContext("C1");
    // The post-login navigation list is derived from the same access facts;
    // dropping one without the other is what this call site prevents.
    expect(mockDropWorkspaceContext).toHaveBeenCalledWith("C1");
    expect(mockDropAllWorkspaceContexts).not.toHaveBeenCalled();
  });

  it("clears every entry on invalidateAll, workspace cache included", async () => {
    const ctx = loadFresh();
    const reads = require("@/models/authorization/contextReads");
    reads.getUserCapabilityGrants.mockClear();

    await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });
    await ctx.getAuthorizationContext({ cid: "C2", role: "staff" });

    ctx.invalidateAllAuthorizationContexts();
    await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });
    await ctx.getAuthorizationContext({ cid: "C2", role: "staff" });

    expect(reads.getUserCapabilityGrants).toHaveBeenCalledTimes(4);
    expect(mockDropAllWorkspaceContexts).toHaveBeenCalled();
  });

  it("does not cache a FAILED resolution", async () => {
    const ctx = loadFresh();
    const reads = require("@/models/authorization/contextReads");
    reads.getUserCapabilityGrants
      .mockImplementationOnce(async () => {
        throw new Error("db down");
      })
      .mockImplementation(async () => ({ rows: [] }));

    await expect(
      ctx.getAuthorizationContext({ cid: "C1", role: "staff" }),
    ).rejects.toThrow("db down");

    reads.getUserCapabilityGrants.mockClear();
    // The inflight entry was cleared in `finally`, so the next caller retries
    // instead of replaying the rejected promise forever.
    await expect(
      ctx.getAuthorizationContext({ cid: "C1", role: "staff" }),
    ).resolves.toBeTruthy();
    expect(reads.getUserCapabilityGrants).toHaveBeenCalledTimes(1);
  });
});

describe("bootstrap — eligibility is seeded once per process", () => {
  it("runs every marker once, then never again in that process", async () => {
    const ctx = loadFresh();
    await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });
    const afterFirst = [...mockMigrations];

    await ctx.getAuthorizationContext({ cid: "C2", role: "staff" });
    await ctx.getAuthorizationContext({ cid: "C3", role: "staff" });

    expect(afterFirst.length).toBeGreaterThan(0);
    expect(mockMigrations).toEqual(afterFirst);
  });

  it("pins the marker list — these names are rows in the database", async () => {
    // Renaming a marker re-runs that seed on every deployed database. These
    // strings are production data, not implementation detail.
    loadFresh();
    const ctx = require("@/services/authorization/context");
    await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });

    expect(mockMigrations).toEqual([
      "eligibility-bootstrap-seed",
      "eligibility-lms-bootstrap-v2",
      "eligibility-ventures-member-v1",
      "eligibility-ventures-founder-v1",
      "eligibility-template-ceiling-v1",
      "eligibility-programs-assignment-v1",
    ]);
  });

  it("swallows a failed seed and still resolves — a missing column must not 500 every gated request", async () => {
    jest.resetModules();
    mockMigrations.length = 0;
    mockEnsureSchema.mockRejectedValueOnce(new Error("no such column"));
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const ctx = require("@/services/authorization/context");
    await expect(
      ctx.getAuthorizationContext({ cid: "C1", role: "staff" }),
    ).resolves.toBeTruthy();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("marks the seed ATTEMPTED even when it failed, so it does not retry per request", async () => {
    jest.resetModules();
    mockEnsureSchema.mockRejectedValue(new Error("no such column"));
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const ctx = require("@/services/authorization/context");
    await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });
    const afterFirst = mockEnsureSchema.mock.calls.length;

    await ctx.getAuthorizationContext({ cid: "C2", role: "staff" });
    await ctx.getAuthorizationContext({ cid: "C3", role: "staff" });

    // Deliberate: "attempted once per process whatever the outcome". Retrying a
    // failing seed on every request would turn one broken column into a
    // permanent per-request tax. It retries on the next BOOT instead.
    expect(afterFirst).toBeGreaterThan(0);
    expect(mockEnsureSchema.mock.calls.length).toBe(afterFirst);
    errSpy.mockRestore();
  });
});

describe("the decision surface survives the split", () => {
  const DECISION_SURFACE = [
    "authorize",
    "can",
    "evaluateAuthorization",
    "getAuthorizationContext",
    "resolveAuthorizationContext",
    "invalidateAuthorizationContext",
    "invalidateAllAuthorizationContexts",
    "mergeEffectiveCapabilities",
    "effectivePermissionsFromContext",
    "buildPermissionExplanation",
    "rowsToCaps",
    "rowsToRestrictions",
    "restrictionsToJson",
  ];

  it.each(DECISION_SURFACE)("%s is exported by the service module", (name) => {
    expect(require("@/services/authorization/context")[name]).toBeDefined();
  });

  // The `models/authorization/resolver` facade was deleted (nothing imported
  // it). These names now live only on the context service, so this pins the
  // same surface on its surviving home rather than on a deleted facade.
  it.each(DECISION_SURFACE)("%s is exported by the service (facade replacement)", (name) => {
    expect(require("@/services/authorization/context")[name]).toBeDefined();
  });

  it("the service barrel RE-EXPORTS the context surface unchanged", () => {
    // The "re-export, not re-implement" contract the deleted model facade
    // carried now holds between the service barrel and the context module: a
    // jest.mock of `@/services/authorization/context` still reaches routes that
    // import the barrel. Identity, not just presence.
    const context = require("@/services/authorization/context");
    const barrel = require("@/services/authorization");
    for (const name of DECISION_SURFACE) {
      expect(barrel[name]).toBe(context[name]);
    }
  });

  it("the service barrel still re-exports the whole decision surface", () => {
    const barrel = require("@/services/authorization");
    for (const name of DECISION_SURFACE) {
      expect(barrel[name]).toBeDefined();
    }
  });

  it("an unconfigured cache does not leak the resolver between identities", async () => {
    const ctx = loadFresh();
    const first = await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });
    ctx.invalidateAllAuthorizationContexts();
    const second = await ctx.getAuthorizationContext({ cid: "C1", role: "staff" });
    // Same input, but a cleared cache means a genuinely re-resolved object.
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });
});