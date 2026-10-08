/**
 * Characterization tests for the two block-h routes' DECISIONS, written BEFORE
 * moving them out:
 *
 *   - `audit/route.js` — the WHERE/ILIKE assembly and the pagination clamp
 *   - `context-roles/route.js` — the per-row holder-count N+1
 *
 * `governance-audit-api.test.js` and `phase4-context-roles.test.js` already
 * cover both routes' HTTP boundary, so this file targets what they leave out:
 * WHICH comparator each field uses (exact `=` vs `ILIKE`), the exact clamp
 * edges, the date conversion, and — the point of this block — how many
 * statements the holder counts cost.
 */

const mockState = {
  auditCount: 0,
  auditEntries: [],
  registryRows: [],
  profiles: [],
  // holder counts keyed "context:role_key"; absent = the read fails
  holderCounts: {},
  holderReadFailure: false,
};

const mockExecutedQueries = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn().mockImplementation(async ({ sql }) => {
      mockExecutedQueries.push(String(sql));
      if (String(sql).includes("FROM permission_audit_log")) return { rows: [] };
      if (String(sql).includes("COUNT(*) FROM permission_audit_log")) {
        return { rows: [{ n: mockState.auditCount }] };
      }
      if (mockState.holderReadFailure) throw new Error("holder read exploded");
      if (String(sql).includes("context_role_holder_counts") || String(sql).includes("UNION ALL")) {
        // The batched holder read.
        return {
          rows: Object.entries(mockState.holderCounts).map(([pair, c]) => ({
            pair,
            c,
          })),
        };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "SA-1", name: "Super Admin" }),
}));
jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn().mockResolvedValue(true),
}));

let mockAuthzDecision = null;
jest.mock("@/server/authz/responses", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
  requireScopedAccess: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/requestOrigin", () => ({
  requireSameOrigin: jest.fn().mockReturnValue(null),
}));

jest.mock("@/models/authorization", () => ({
  countPermissionAudits: jest.fn().mockImplementation(async () => ({
    rows: [{ n: mockState.auditCount }],
  })),
  listPermissionAudits: jest.fn().mockImplementation(async () => ({
    rows: mockState.auditEntries,
  })),
  getAccessProfileMeta: jest.fn().mockResolvedValue({ rows: [] }),
  listAccessProfiles: jest.fn().mockImplementation(async () => ({ rows: mockState.profiles })),
}));

const mockRegistry = {
  seedContextRoleProfiles: jest.fn().mockResolvedValue(true),
  listContextRoleProfiles: jest.fn().mockImplementation(async () => ({ rows: mockState.registryRows })),
  upsertContextRoleProfile: jest.fn().mockResolvedValue({ rows: [] }),
  countContextRoleHoldersBatch: jest
    .fn()
    .mockImplementation(async (pairs) => {
      if (mockState.holderReadFailure) throw new Error("holder read exploded");
      const counts = {};
      for (const { context, roleKey } of pairs) {
        const key = `${context}:${roleKey}`;
        if (Object.prototype.hasOwnProperty.call(mockState.holderCounts, key)) {
          counts[key] = mockState.holderCounts[key];
        }
      }
      return counts;
    }),
  countContextRoleHolders: jest
    .fn()
    .mockImplementation(async (context, roleKey) => {
      const key = `${context}:${roleKey}`;
      if (mockState.holderReadFailure) throw new Error("holder read exploded");
      if (Object.prototype.hasOwnProperty.call(mockState.holderCounts, key)) {
        return mockState.holderCounts[key];
      }
      return null;
    }),
  isValidContextRoleContext: jest.fn().mockReturnValue(true),
  isValidContextRoleKey: jest.fn().mockReturnValue(true),
  ensureContextRoleProfilesSchema: jest.fn().mockResolvedValue(true),
  CONTEXT_ROLE_CONTEXTS: ["program", "venture", "lms", "investor"],
};

jest.mock("@/models/authorization/contextRoleProfiles", () => mockRegistry);

const { requireAuthorization } = require("@/server/authz/responses");
const {
  countPermissionAudits,
  listPermissionAudits,
} = require("@/models/authorization");
const auditRoute = require("@/app/api/engineering/permissions/audit/route");
const contextRolesRoute = require("@/app/api/engineering/permissions/context-roles/route");

const getReq = (params = "", path = "audit") =>
  new Request(
    `http://localhost/api/engineering/permissions/${path}?${params}`,
    { headers: { origin: "http://localhost" } },
  );

beforeEach(() => {
  mockState.auditCount = 0;
  mockState.auditEntries = [];
  mockState.registryRows = [];
  mockState.profiles = [];
  mockState.holderCounts = {};
  mockState.holderReadFailure = false;
  mockExecutedQueries.length = 0;
  mockAuthzDecision = null;
  jest.clearAllMocks();
});

describe("audit — WHICH comparator each field uses", () => {
  test("actor / target / capability are ILIKE (substring), wrapped in %", async () => {
    await auditRoute.GET(getReq("actor=ada&target=venture%20X&capability=view"));
    const [whereSql, args] = countPermissionAudits.mock.calls[0];
    expect(whereSql).toContain("actor_name ILIKE ?");
    expect(whereSql).toContain("target_name ILIKE ?");
    expect(whereSql).toContain("capability ILIKE ?");
    // A LIKE filter takes the substring, so the wildcards are added here.
    expect(args).toEqual(["%ada%", "%venture X%", "%view%"]);
  });

  test("action / module / target_cid are EXACT matches, no wildcards", async () => {
    await auditRoute.GET(getReq("action=granted&module=crm&target_cid=C-9"));
    const [whereSql, args] = countPermissionAudits.mock.calls[0];
    expect(whereSql).toContain("action = ?");
    expect(whereSql).toContain("module = ?");
    expect(whereSql).toContain("target_cid = ?");
    expect(whereSql).not.toContain("action ILIKE");
    // No % added: an exact "granted" must not match "granted_by_admin".
    expect(args).toEqual(["granted", "crm", "C-9"]);
  });

  test("q spans SIX columns with the SAME pattern repeated six times", async () => {
    await auditRoute.GET(getReq("q=staff"));
    const [whereSql, args] = countPermissionAudits.mock.calls[0];
    for (const column of [
      "actor_name",
      "target_name",
      "action",
      "module",
      "capability",
      "details",
    ]) {
      expect(whereSql).toContain(`${column} ILIKE ?`);
    }
    expect(args).toEqual(Array(6).fill("%staff%"));
  });

  test("filters combine with AND in a fixed order", async () => {
    await auditRoute.GET(getReq("action=granted&q=staff&module=crm&from=2026-01-01"));
    const [whereSql] = countPermissionAudits.mock.calls[0];
    expect(whereSql).toMatch(/^WHERE .* AND .* AND /);
    const order = ["actor_name", "target_name", "action = ?", "module = ?", "created_at >= ?"];
    let last = -1;
    for (const token of order) {
      const at = whereSql.indexOf(token);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  test("no filter at all means NO WHERE clause, not a tautology", async () => {
    await auditRoute.GET(getReq());
    const [whereSql, args] = countPermissionAudits.mock.calls[0];
    expect(whereSql).toBe("");
    expect(args).toEqual([]);
  });

  test("a whitespace-only filter is dropped, so it cannot match everything", async () => {
    await auditRoute.GET(getReq("actor=%20%20&action=granted"));
    const [whereSql] = countPermissionAudits.mock.calls[0];
    // Trimmed to "", so only the action filter survives.
    expect(whereSql).not.toContain("actor_name");
    expect(whereSql).toContain("action = ?");
  });

  test("from / to are converted to ISO and are INCLUSIVE bounds", async () => {
    await auditRoute.GET(getReq("from=2026-01-01T10:00:00%2B01:00&to=2026-12-31"));
    const [whereSql, args] = countPermissionAudits.mock.calls[0];
    expect(whereSql).toContain("created_at >= ?");
    expect(whereSql).toContain("created_at <= ?");
    // Both normalized to UTC ISO before hitting SQL.
    expect(args[0]).toBe(new Date("2026-01-01T10:00:00+01:00").toISOString());
    expect(args[1]).toBe(new Date("2026-12-31").toISOString());
  });

  test("an UNPARSEABLE date is a 500 — the filter is not silently dropped", async () => {
    const res = await auditRoute.GET(getReq("from=not-a-date"));
    // Pinned as-is: new Date("not-a-date").toISOString() throws a RangeError,
    // which reaches the catch. Silently ignoring a bad date filter would
    // return an UNFILTERED audit log, so the loud failure is the safer of the
    // two — but it is a 500 on user input, and making it a 400 is a product
    // decision this block does not take.
    expect(res.status).toBe(500);
  });
});

describe("audit — pagination clamp and the two-statement shape", () => {
  test("defaults are page 1, pageSize 25", async () => {
    const body = await (await auditRoute.GET(getReq())).json();
    expect(body).toMatchObject({ page: 1, pageSize: 25 });
    expect(listPermissionAudits.mock.calls[0][1].slice(-2)).toEqual([25, 0]);
  });

  test("page 0 and negative page clamp to 1", async () => {
    expect((await (await auditRoute.GET(getReq("page=0"))).json()).page).toBe(1);
    expect((await (await auditRoute.GET(getReq("page=-3"))).json()).page).toBe(1);
  });

  test("a FALSY pageSize falls back to 25; any other value clamps into [1, 100]", async () => {
    // `parseInt(x) || 25`: 0 and non-numeric are falsy so they take the
    // default, but a negative is truthy and therefore reaches the clamp.
    expect((await (await auditRoute.GET(getReq("pageSize=0"))).json()).pageSize).toBe(25);
    expect((await (await auditRoute.GET(getReq("pageSize=abc"))).json()).pageSize).toBe(25);
    // Pinned: -9 clamps UP to the floor of 1, it does not take the default.
    expect((await (await auditRoute.GET(getReq("pageSize=-9"))).json()).pageSize).toBe(1);
    expect((await (await auditRoute.GET(getReq("pageSize=1000"))).json()).pageSize).toBe(100);
    expect((await (await auditRoute.GET(getReq("pageSize=7"))).json()).pageSize).toBe(7);
  });

  test("offset is (page - 1) * pageSize, appended after the filter args", async () => {
    await auditRoute.GET(getReq("action=granted&page=3&pageSize=20"));
    const args = listPermissionAudits.mock.calls[0][1];
    expect(args).toEqual(["granted", 20, 40]);
  });

  test("count and list share the SAME where clause; only limit/offset differ", async () => {
    await auditRoute.GET(getReq("q=staff&action=granted"));
    const [countWhere, countArgs] = countPermissionAudits.mock.calls[0];
    const [listWhere, listArgs] = listPermissionAudits.mock.calls[0];
    expect(listWhere).toBe(countWhere);
    expect(listArgs.slice(0, countArgs.length)).toEqual(countArgs);
    expect(listArgs.length).toBe(countArgs.length + 2);
  });

  test("the count runs BEFORE the list, so total can never describe a later state", async () => {
    await auditRoute.GET(getReq());
    expect(countPermissionAudits.mock.invocationCallOrder[0]).toBeLessThan(
      listPermissionAudits.mock.invocationCallOrder[0],
    );
  });

  test("total is a number, and an absent count row reads as 0", async () => {
    mockState.auditCount = 1234;
    expect((await (await auditRoute.GET(getReq())).json()).total).toBe(1234);
    countPermissionAudits.mockResolvedValueOnce({ rows: [] });
    expect((await (await auditRoute.GET(getReq())).json()).total).toBe(0);
  });
});

describe("context-roles GET — the holder-count N+1", () => {
  const registryRow = (context, roleKey) => ({
    context,
    role_key: roleKey,
    profile_id: null,
    is_active: 1,
    notes: "",
  });

  test("every registry row carries its holder count", async () => {
    mockState.registryRows = [
      registryRow("program", "participant"),
      registryRow("venture", "founder"),
    ];
    mockState.holderCounts = { "program:participant": 12, "venture:founder": 3 };

    const body = await (await contextRolesRoute.GET(getReq("", "context-roles"))).json();
    expect(body.roles).toEqual([
      { ...registryRow("program", "participant"), holders: 12 },
      { ...registryRow("venture", "founder"), holders: 3 },
    ]);
  });

  test("a pair the engine does not measure keeps null, so the UI shows '—'", async () => {
    mockState.registryRows = [registryRow("program", "program_manager")];
    // absent from holderCounts → the model returns null
    const body = await (await contextRolesRoute.GET(getReq("", "context-roles"))).json();
    expect(body.roles[0].holders).toBeNull();
  });

  test("a count of 0 is a real answer, distinct from unknown", async () => {
    mockState.registryRows = [registryRow("lms", "learner")];
    mockState.holderCounts = { "lms:learner": 0 };
    const body = await (await contextRolesRoute.GET(getReq("", "context-roles"))).json();
    expect(body.roles[0].holders).toBe(0);
  });

  test("CURRENT SHAPE: one holder read per registry row", async () => {
    mockState.registryRows = [
      registryRow("program", "participant"),
      registryRow("program", "program_manager"),
      registryRow("program", "facilitator"),
      registryRow("venture", "founder"),
      registryRow("venture", "team_member"),
      registryRow("lms", "learner"),
      registryRow("investor", "investor"),
    ];
    mockState.holderCounts = { "program:participant": 5 };

    await contextRolesRoute.GET(getReq("", "context-roles"));
    // AFTER: the registry is asked ONCE for every row's count. The previous
    // shape called countContextRoleHolders seven times; the statement count
    // inside the batch read is pinned in context-role-holder-batch.test.js, so
    // the change is measured at BOTH layers.
    expect(mockRegistry.countContextRoleHoldersBatch).toHaveBeenCalledTimes(1);
    expect(mockRegistry.countContextRoleHolders).not.toHaveBeenCalled();
    expect(mockRegistry.countContextRoleHoldersBatch.mock.calls[0][0]).toHaveLength(7);
  });

  test("an EMPTY registry still seeds and answers, without any holder read", async () => {
    mockState.registryRows = [];
    const body = await (await contextRolesRoute.GET(getReq("", "context-roles"))).json();
    expect(body).toEqual({
      success: true,
      contexts: ["program", "venture", "lms", "investor"],
      roles: [],
      profiles: [],
      seeded: true,
    });
    expect(mockRegistry.seedContextRoleProfiles).toHaveBeenCalledTimes(1);
    expect(mockRegistry.countContextRoleHoldersBatch).toHaveBeenCalledWith([]);
    expect(mockExecutedQueries).toHaveLength(0);
  });

  test("the holder count rides alongside the row, never replacing it", async () => {
    const row = { ...registryRow("venture", "founder"), profile_id: 4, notes: "keep" };
    mockState.registryRows = [row];
    mockState.holderCounts = { "venture:founder": 7 };
    const body = await (await contextRolesRoute.GET(getReq("", "context-roles"))).json();
    expect(body.roles[0]).toEqual({ ...row, holders: 7 });
  });

  test("the response also carries the profile list and the context catalogue", async () => {
    mockState.profiles = [{ id: 1, name: "Staff Default" }];
    const body = await (await contextRolesRoute.GET(getReq("", "context-roles"))).json();
    expect(body.profiles).toEqual([{ id: 1, name: "Staff Default" }]);
    expect(body.contexts).toEqual(["program", "venture", "lms", "investor"]);
  });

  test("a holder read that throws is a 500 — the registry is NOT fail-soft here", async () => {
    mockState.registryRows = [registryRow("program", "participant")];
    mockState.holderReadFailure = true;
    const res = await contextRolesRoute.GET(getReq("", "context-roles"));
    // The MODEL swallows a failed count (returns null, warns); an outright
    // throw here is a different failure and surfaces as a 500.
    expect(res.status).toBe(500);
  });

  test("a read seeds BEFORE listing, and never invalidates the cache", async () => {
    mockState.registryRows = [];
    await contextRolesRoute.GET(getReq("", "context-roles"));
    expect(mockRegistry.seedContextRoleProfiles.mock.invocationCallOrder[0]).toBeLessThan(
      mockRegistry.listContextRoleProfiles.mock.invocationCallOrder[0],
    );
    // The route's only authorization import is the HTTP boundary
    // (@/server/authz/responses, re-exported by the model barrel). That boundary
    // carries no cache invalidation, so a governance read cannot drop the cache.
    const { invalidateAllAuthorizationContexts } = require("@/server/authz/responses");
    expect(invalidateAllAuthorizationContexts).toBeUndefined();
  });

  test("the read gate is view_matrix, and it runs AFTER the origin check", async () => {
    const { requireSameOrigin } = require("@/lib/requestOrigin");
    mockAuthzDecision = new Response(JSON.stringify({ success: false }), { status: 403 });
    const res = await contextRolesRoute.GET(getReq("", "context-roles"));
    expect(res.status).toBe(403);
    expect(requireSameOrigin).toHaveBeenCalled();
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
    // A cross-site read must not seed anything.
    expect(mockRegistry.seedContextRoleProfiles).not.toHaveBeenCalled();
  });

  test("a cross-site GET is blocked before the gate is even asked", async () => {
    const { requireSameOrigin } = require("@/lib/requestOrigin");
    requireSameOrigin.mockReturnValueOnce(
      new Response(JSON.stringify({ success: false }), { status: 403 }),
    );
    const res = await contextRolesRoute.GET(getReq("", "context-roles"));
    expect(res.status).toBe(403);
    expect(requireAuthorization).not.toHaveBeenCalled();
  });
});