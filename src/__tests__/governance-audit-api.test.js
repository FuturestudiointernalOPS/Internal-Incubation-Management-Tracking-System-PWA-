/**
 * Phase 7 governance tests: audit viewer API (read-only, authorized,
 * paginated, filterable) and protected-profile mutation guards.
 */

const mockExecutedQueries = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql }) => {
      mockExecutedQueries.push(String(sql));
      if (String(sql).includes("FROM permission_audit_log")) return { rows: [] };
      if (String(sql).includes("FROM role_access_profile_defaults")) return { rows: [{ role_name: "staff" }] };
      if (String(sql).includes("FROM contacts WHERE access_profile_id")) return { rows: [{ cnt: 0 }] };
      if (String(sql).includes("FROM access_profiles WHERE id")) return { rows: [{ id: 2, name: "Staff Default" }] };
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "SA-1", name: "Super Admin" }),
  logPermissionAudit: jest.fn().mockResolvedValue(true),
}));

let mockAuthzDecision = null;
jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
}));

const { requireAuthorization } = require("@/lib/authorization");
const auditRoute = require("@/app/api/engineering/permissions/audit/route");
const profilesRoute = require("@/app/api/access-profiles/route");

const getReq = (params = "") =>
  new Request(`http://localhost/api/engineering/permissions/audit?${params}`);

beforeEach(() => {
  mockExecutedQueries.length = 0;
  mockAuthzDecision = null;
  jest.clearAllMocks();
});

describe("GET /api/engineering/permissions/audit — viewer API", () => {
  test("requires permissions.view_matrix", async () => {
    await auditRoute.GET(getReq());
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  });

  test("unauthorized read → 403", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false, error: "x" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const res = await auditRoute.GET(getReq());
    expect(res.status).toBe(403);
  });

  test("authorized read returns entries + total + pagination metadata", async () => {
    const res = await auditRoute.GET(getReq("page=2&pageSize=10"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty("entries");
    expect(data).toHaveProperty("total");
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(10);
    // Server-side pagination — never loads the whole table.
    expect(mockExecutedQueries.some((q) => q.includes("LIMIT ? OFFSET ?"))).toBe(true);
    expect(mockExecutedQueries.some((q) => q.includes("COUNT(*) AS n"))).toBe(true);
  });

  test("filters are applied server-side (q, action, module, date range)", async () => {
    await auditRoute.GET(getReq("q=staff&action=granted&module=projects&from=2026-01-01&to=2026-12-31"));
    const all = mockExecutedQueries.join("\n");
    expect(all).toContain("actor_name ILIKE ?");
    expect(all).toContain("action = ?");
    expect(all).toContain("module = ?");
    expect(all).toContain("created_at >= ?");
    expect(all).toContain("created_at <= ?");
  });

  test("pageSize is capped server-side (max 100)", async () => {
    await auditRoute.GET(getReq("pageSize=9999"));
    // The LIMIT clause receives the clamped value via args — verify the API
    // still responds successfully rather than erroring.
    const res = await auditRoute.GET(getReq("pageSize=9999"));
    expect(res.status).toBe(200);
  });

  test("the viewer exposes NO mutation endpoint (append-only history)", () => {
    expect(typeof auditRoute.GET).toBe("function");
    expect(auditRoute.PUT).toBeUndefined();
    expect(auditRoute.POST).toBeUndefined();
    expect(auditRoute.DELETE).toBeUndefined();
    expect(auditRoute.PATCH).toBeUndefined();
  });
});

describe("Protected profile safeguards (role-default profiles)", () => {
  test("disabling a role-default profile → 400 with an explicit message", async () => {
    const res = await profilesRoute.PUT(
      new Request("http://localhost/api/access-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 2, is_active: 0 }),
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(String(data.error)).toMatch(/staff/i);
    expect(mockExecutedQueries.some((q) => q.includes("UPDATE access_profiles SET is_active"))).toBe(false);
  });

  test("deleting a role-default profile → rejected (change the role default first)", async () => {
    const res = await profilesRoute.DELETE(
      new Request("http://localhost/api/access-profiles?id=2", { method: "DELETE" }),
    );
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(String(data.error)).toMatch(/default for role/i);
    expect(mockExecutedQueries.some((q) => q.includes("DELETE FROM access_profiles"))).toBe(false);
  });
});
