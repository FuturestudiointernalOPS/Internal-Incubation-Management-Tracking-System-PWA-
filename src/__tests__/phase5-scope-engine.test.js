/**
 * PHASE 5 — Scope Engine.
 *
 * Contracts locked here:
 *   1. Decision composition order: capability → policy supported → within
 *      scope. Every uncertainty fails CLOSED.
 *   2. Predicates read AUTHORITATIVE assignment data (venture_members,
 *      program staff/participant rows, own LMS enrollments) — never cache,
 *      never client state.
 *   3. Unimplemented policies resolve to DENY and are marked as such in the
 *      shared catalogue (no silent allow, no hidden gap).
 *   4. The verification endpoint is read-only and capability-gated.
 */

const mockExecuted = [];
let mockRows = [];
let mockThrow = false;

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (queryObj) => {
      const sql = typeof queryObj === "string" ? queryObj : queryObj?.sql;
      const args = typeof queryObj === "string" ? [] : queryObj?.args || [];
      mockExecuted.push({ sql: String(sql), args });
      if (mockThrow) throw new Error("connection lost");
      return { rows: mockRows };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

let mockAuthzDecision = null;
jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
}));

const requireAuthorization = require("@/lib/authorization").requireAuthorization;
const route = require("@/app/api/engineering/permissions/scope-check/route");
const {
  SCOPE_POLICY_KEYS,
  SCOPE_POLICIES,
  SCOPE_DECISION_REASONS,
  evaluateScopeDecision,
  isScopePolicyImplemented,
} = require("@/lib/authorization/scope-catalog");
const { resolveScopeIds, isWithinScope } = require("@/lib/authorization/scope");

const getReq = (params) =>
  new Request(
    `http://localhost/api/engineering/permissions/scope-check?${params}`,
  );

beforeEach(() => {
  mockExecuted.length = 0;
  mockRows = [];
  mockThrow = false;
  mockAuthzDecision = null;
  jest.clearAllMocks();
});

describe("Phase 5 — catalogue & decision contract", () => {
  test("every policy key has a catalogue entry with a resource", () => {
    for (const key of SCOPE_POLICY_KEYS) {
      expect(SCOPE_POLICIES[key]).toBeTruthy();
      expect(typeof SCOPE_POLICIES[key].resource).toBe("string");
      expect(SCOPE_POLICIES[key].key).toBe(key);
    }
  });

  test("team_own is declared but explicitly unimplemented (visible gap, fail-closed)", () => {
    expect(isScopePolicyImplemented("team_own")).toBe(false);
    expect(typeof SCOPE_POLICIES.team_own.source).toBe("string");
    expect(SCOPE_POLICIES.team_own.source.length).toBeGreaterThan(10);
  });

  test("implemented policies cover venture / program / learning", () => {
    expect(isScopePolicyImplemented("venture_own")).toBe(true);
    expect(isScopePolicyImplemented("program_assigned")).toBe(true);
    expect(isScopePolicyImplemented("learning_own")).toBe(true);
  });

  test("decision matrix — capability first, then policy support, then scope", () => {
    // No capability → denied regardless of scope.
    expect(
      evaluateScopeDecision({
        capabilityHeld: false,
        policyKey: "venture_own",
        withinScope: true,
      }),
    ).toEqual({ allowed: false, reason: SCOPE_DECISION_REASONS.CAPABILITY_MISSING });

    // Unsupported policy → denied even with capability + within scope.
    expect(
      evaluateScopeDecision({
        capabilityHeld: true,
        policyKey: "team_own",
        withinScope: true,
      }),
    ).toEqual({ allowed: false, reason: SCOPE_DECISION_REASONS.POLICY_UNSUPPORTED });

    // Capability + supported policy but out of scope → denied.
    expect(
      evaluateScopeDecision({
        capabilityHeld: true,
        policyKey: "venture_own",
        withinScope: false,
      }),
    ).toEqual({ allowed: false, reason: SCOPE_DECISION_REASONS.OUT_OF_SCOPE });

    // All gates pass → allowed.
    expect(
      evaluateScopeDecision({
        capabilityHeld: true,
        policyKey: "venture_own",
        withinScope: true,
      }),
    ).toEqual({ allowed: true, reason: SCOPE_DECISION_REASONS.ALLOWED });
  });
});

describe("Phase 5 — data-layer predicates", () => {
  test("venture_own reads active venture_members rows for cid or contact_id", async () => {
    mockRows = [{ id: "V1" }, { id: "V2" }];
    const ids = await resolveScopeIds("venture_own", "C1");
    expect(ids).toEqual(["V1", "V2"]);
    const q = mockExecuted[0];
    expect(q.sql).toContain("FROM venture_members");
    expect(q.sql).toContain("removed_at IS NULL");
    expect(q.sql).toContain("user_cid = ?");
    expect(q.sql).toContain("contact_id = ?");
    expect(q.args).toEqual(["C1", "C1"]);
  });

  test("program_assigned unions staff assignment (email-tolerant) with enrollment", async () => {
    mockRows = [{ id: "P1" }];
    const ids = await resolveScopeIds("program_assigned", "C1", {
      email: "ada@example.com",
    });
    expect(ids).toEqual(["P1"]);
    const q = mockExecuted[0];
    expect(q.sql).toContain("v2_program_staff");
    expect(q.sql).toContain("LOWER(TRIM(staff_id))");
    expect(q.sql).toContain("participant_programs");
    expect(q.args).toEqual(["C1", "ada@example.com", "C1"]);
  });

  test("learning_own reads only own, non-suspended enrollments", async () => {
    mockRows = [{ id: "K1" }];
    await resolveScopeIds("learning_own", "C1");
    const q = mockExecuted[0];
    expect(q.sql).toContain("FROM lms_enrollments");
    expect(q.sql).toContain("status <> 'suspended'");
    expect(q.args).toEqual(["C1"]);
  });

  test("isWithinScope: member yes, non-member no", async () => {
    mockRows = [{ id: "V1" }];
    expect(await isWithinScope("venture_own", "C1", "V1")).toBe(true);
    expect(await isWithinScope("venture_own", "C1", "V2")).toBe(false);
  });

  test("fail-closed: empty resource id, no rows, unsupported policy, db error", async () => {
    expect(await isWithinScope("venture_own", "C1", null)).toBe(false);
    expect(await isWithinScope("venture_own", "C1", "")).toBe(false);

    mockRows = [];
    expect(await isWithinScope("venture_own", "C1", "V1")).toBe(false);

    mockExecuted.length = 0;
    expect(await isWithinScope("team_own", "C1", "T1")).toBe(false);
    // Unsupported policies never even reach the database.
    expect(mockExecuted).toHaveLength(0);

    mockThrow = true;
    expect(await isWithinScope("venture_own", "C1", "V1")).toBe(false);
    expect(await resolveScopeIds("venture_own", "C1")).toBeNull();
  });

  test("resolveScopeIds requires a user cid (fail-closed)", async () => {
    expect(await resolveScopeIds("venture_own", null)).toBeNull();
    expect(mockExecuted).toHaveLength(0);
  });
});

describe("GET /api/engineering/permissions/scope-check", () => {
  test("requires permissions.view_matrix", async () => {
    await route.GET(getReq("policy=venture_own&cid=C1"));
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  });

  test("unauthorized → 403", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const res = await route.GET(getReq("policy=venture_own&cid=C1"));
    expect(res.status).toBe(403);
  });

  test("unknown policy or missing cid → 400", async () => {
    const badPolicy = await route.GET(getReq("policy=crm_own&cid=C1"));
    expect(badPolicy.status).toBe(400);
    const noCid = await route.GET(getReq("policy=venture_own"));
    expect(noCid.status).toBe(400);
  });

  test("verifies a real membership decision (David style: AgriNova yes, FinTechCo no)", async () => {
    mockRows = [{ id: "AgriNova" }, { id: "TechBridge" }];
    const res = await route.GET(
      getReq("policy=venture_own&cid=David&resource_id=AgriNova"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.within_scope).toBe(true);
    expect(data.resolved_count).toBe(2);

    const res2 = await route.GET(
      getReq("policy=venture_own&cid=David&resource_id=FinTechCo"),
    );
    const data2 = await res2.json();
    expect(data2.within_scope).toBe(false);
  });

  test("unimplemented policy reports the honest state (no silent allow)", async () => {
    const res = await route.GET(getReq("policy=team_own&cid=C1&resource_id=T1"));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.implemented).toBe(false);
    expect(data.within_scope).toBe(false);
    expect(data.resolved_count).toBe(0);
  });
});
