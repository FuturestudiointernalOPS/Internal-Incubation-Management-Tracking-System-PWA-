/**
 * Authorization — LMS module gating (Phase 12).
 *
 * Feature gating after promotion: the delegated staff grant, the
 * Program Manager backfill and the fail-closed path for a missing
 * capability.
 *
 * Mocks and context factories come from ./helpers/authorizationMocks.
 */

const mockAuthz = require("./helpers/authorizationMocks");

jest.mock("@/lib/db", () => mockAuthz.db);
jest.mock("@/server/authz/capabilities", () => {
  const auth = mockAuthz.auth;
  return { PERMISSION_MODULES: auth.PERMISSION_MODULES, ACCESS_LEVELS: auth.ACCESS_LEVELS };
});
jest.mock("@/server/auth/session", () => ({ getSession: mockAuthz.auth.getSession }));
jest.mock("@/models/authorization/bootstrap", () => ({ ensurePermissionsSchema: mockAuthz.auth.ensurePermissionsSchema }));
jest.mock("next/server", () => mockAuthz.nextServer);

const { authorize } = require("@/services/authorization/context");
const { saCtx, staffCtx } = require("./helpers/authorizationMocks");

// ─── LMS module (Phase 12) — feature-gated after promotion ───────────────────

describe("lms module", () => {
  test("MODULE_TO_FEATURE maps lms → lms (feature-gated)", () => {
    const {
  MODULE_TO_FEATURE,
} = require("@/models/authorization/eligibility");
    expect(MODULE_TO_FEATURE.lms).toBe("lms");
  });

  test("delegated staff with lms.create is allowed when eligible", () => {
    const ctx = staffCtx({
      eligibility: { lms: true },
      effective: { lms: { view: 1, create: 2 } },
    });
    expect(authorize(ctx, "lms", "create")).toBe(true);
    expect(authorize(ctx, "lms", "enroll")).toBe(false);
  });

  test("staff without lms capabilities is denied (no default grant)", () => {
    const ctx = staffCtx({ eligibility: { lms: true }, effective: { programs: { view: 1 } } });
    expect(authorize(ctx, "lms", "view")).toBe(false);
  });

  test("ineligible user is denied even with lms capability", () => {
    const ctx = staffCtx({ eligibility: {}, effective: { lms: { view: 1 } } });
    expect(authorize(ctx, "lms", "view")).toBe(false);
  });

  test("super admin is allowed without explicit lms rows (matrix bypass)", () => {
    expect(authorize(saCtx(), "lms", "create")).toBe(true);
    expect(authorize(saCtx(), "lms", "publish")).toBe(true);
  });

  test("super admin with an explicit lms restriction is denied", () => {
    const ctx = saCtx({ restrictions: { lms: new Set(["publish"]) } });
    expect(authorize(ctx, "lms", "publish")).toBe(false);
    expect(authorize(ctx, "lms", "view")).toBe(true); // unrelated cap unaffected
  });

  test("missing capability → denied (fail closed)", () => {
    const ctx = staffCtx({ eligibility: { lms: true }, effective: {} });
    expect(authorize(ctx, "lms", "enroll")).toBe(false);
  });

  // A page load issues several authorized requests at once; on a cold cache they
  // all miss and would each run the same resolution queries in parallel.
  test("concurrent readers of one user share ONE resolution", async () => {
    const dbMock = require("@/lib/db").default;
    const { getAuthorizationContext } = require("@/models/authorization/index");
    dbMock.execute.mockClear();

    const user = { cid: "USER_SHARED_CONTEXT", role: "staff" };
    const [firstContext, secondContext, thirdContext] = await Promise.all([
      getAuthorizationContext(user),
      getAuthorizationContext(user),
      getAuthorizationContext(user),
    ]);

    expect(firstContext).toBe(secondContext);
    expect(secondContext).toBe(thirdContext);
    const restrictionReads = dbMock.execute.mock.calls.filter((call) =>
      /SELECT module, capability FROM user_capability_restrictions\s+WHERE user_cid/i.test(
        typeof call[0] === "string" ? call[0] : call[0]?.sql || "",
      ),
    );
    expect(restrictionReads).toHaveLength(1);
  });

  test("a context is reused from the cache, and invalidated on demand", async () => {
    const dbMock = require("@/lib/db").default;
    const { getAuthorizationContext, invalidateAuthorizationContext } = require("@/models/authorization/index");

    const user = { cid: "USER_CACHED_CONTEXT", role: "staff" };
    const cachedContext = await getAuthorizationContext(user);

    dbMock.execute.mockClear();
    expect(await getAuthorizationContext(user)).toBe(cachedContext);
    expect(dbMock.execute).not.toHaveBeenCalled();

    // A permission write for that user must not keep serving the old answer.
    invalidateAuthorizationContext(user.cid);
    dbMock.execute.mockClear();
    await getAuthorizationContext(user);
    expect(dbMock.execute).toHaveBeenCalled();
  });

  test("program_manager is eligible for the lms feature (PM surface is reachable)", () => {
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
} = require("@/models/authorization/eligibility");
    // Phase H — program_manager is a PROFILE now, so its lms ceiling rides the
    // profile identity.
    expect(FEATURE_ELIGIBILITY_DEFAULTS.lms).not.toContain("program_manager");
    expect(FEATURE_ELIGIBILITY_PROFILE_DEFAULTS.lms).toContain("program_manager");
  });

  // The seed grants lms.view to the Program Manager profile, but seeds never
  // overwrite: a database seeded before the LMS promotion kept a PM profile
  // with no lms row, so every PM learning surface answered 403. The backfill
  // closes that gap for existing databases (missing rows only).
  test("ensureLmsViewBackfill grants lms.view to the Program Manager profile + role fallback", async () => {
    const dbMock = require("@/lib/db").default;
    const { ensureLmsViewBackfill } = require("@/models/authorization/backfill");
    dbMock.execute.mockClear();
    dbMock.execute.mockImplementation(async (query = {}) => {
      const sql = typeof query === "string" ? query : query.sql || "";
      if (sql.includes("FROM access_profiles")) return { rows: [{ id: 5 }] };
      return { rows: [] };
    });

    await ensureLmsViewBackfill();

    const calls = dbMock.execute.mock.calls.map((call) =>
      typeof call[0] === "string" ? { sql: call[0], args: [] } : call[0],
    );
    const profileInserts = calls.filter((call) =>
      call.sql.includes("INSERT INTO profile_capabilities"),
    );
    expect(profileInserts).toHaveLength(1);
    expect(profileInserts[0].args).toEqual(["program_manager", "lms", "view", 1]);
    expect(profileInserts[0].sql).toMatch(
      /ON CONFLICT \(profile_key, module, capability\) DO NOTHING/,
    );

    const roleInserts = calls.filter((call) => call.sql.includes("INSERT INTO role_capabilities"));
    expect(roleInserts).toHaveLength(1);
    expect(roleInserts[0].args).toEqual(["program_manager", "lms", "view", 1]);

    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });

  test("ensureLmsViewBackfill never grants a write capability", async () => {
    const dbMock = require("@/lib/db").default;
    const { ensureLmsViewBackfill } = require("@/models/authorization/backfill");
    dbMock.execute.mockClear();
    dbMock.execute.mockImplementation(async (query = {}) => {
      const sql = typeof query === "string" ? query : query.sql || "";
      if (sql.includes("FROM access_profiles")) return { rows: [{ id: 5 }] };
      return { rows: [] };
    });

    await ensureLmsViewBackfill();

    const granted = dbMock.execute.mock.calls
      .map((call) => (typeof call[0] === "string" ? [] : call[0].args))
      .filter((args) => Array.isArray(args) && args.includes("lms"))
      .map((args) => args[args.indexOf("lms") + 1]);
    expect(granted.length).toBeGreaterThan(0);
    for (const capability of granted) expect(capability).toBe("view");

    dbMock.execute.mockImplementation(async () => ({ rows: [] }));
  });
});

