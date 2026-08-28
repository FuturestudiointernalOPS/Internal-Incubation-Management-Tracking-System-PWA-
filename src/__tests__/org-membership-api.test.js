/**
 * Route-level tests for GET/PUT /api/org-membership.
 *
 * Covers the Phase 5 security acceptance items that live at the HTTP
 * boundary: org_membership.view/manage gating, direct-API manipulation
 * rejection, protected-group mutation authority, and the no-duplicate /
 * no-delete lifecycle guarantees (duplicate/expiry semantics are also
 * unit-tested in membership.test.js).
 */

const mockExecutedQueries = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql }) => {
      mockExecutedQueries.push(String(sql));
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "SA-1", name: "Super Admin" }),
  logPermissionAudit: jest.fn().mockResolvedValue(true),
}));

let mockAuthzDecision = null; // null = granted (route proceeds)
jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
  invalidateAllAuthorizationContexts: jest.fn(),
}));

const mockActualMembership = jest.requireActual("@/lib/authorization/membership");
jest.mock("@/lib/authorization/membership", () => ({
  ...mockActualMembership,
  ensureMembershipSchema: jest.fn().mockResolvedValue(true),
  getMembership: jest.fn(),
  isGroupProtected: jest.fn().mockResolvedValue(true),
}));

const { requireAuthorization, invalidateAllAuthorizationContexts } = require("@/lib/authorization");
const membershipLib = require("@/lib/authorization/membership");
const { GET, PUT } = require("@/app/api/org-membership/route");

const jsonReq = (body, url = "http://localhost/api/org-membership") =>
  new Request(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

beforeEach(() => {
  mockExecutedQueries.length = 0;
  mockAuthzDecision = null;
  membershipLib.getMembership.mockReset();
  membershipLib.getMembership.mockResolvedValue(null);
  jest.clearAllMocks();
});

describe("PUT /api/org-membership — authorization gate", () => {
  test("requires org_membership.manage (the dedicated authority, not assign_capabilities)", async () => {
    await PUT(jsonReq({ user_cid: "U1", group_name: "FUTURE STUDIO", action: "joined" }));
    expect(requireAuthorization).toHaveBeenCalledWith("org_membership", "manage");
  });

  test("unauthorized add → 403 and no database write (B, direct API)", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false, error: "errors.insufficientPermissions" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(jsonReq({ user_cid: "U1", group_name: "FUTURE STUDIO", action: "joined" }));
    expect(res.status).toBe(403);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO group_memberships"))).toBe(false);
  });

  test("unauthorized end/renew are equally rejected (C, D)", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false, error: "errors.insufficientPermissions" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    for (const action of ["ended", "renewed", "deactivated"]) {
      const res = await PUT(jsonReq({ user_cid: "U1", group_name: "FUTURE STUDIO", action }));
      expect(res.status).toBe(403);
    }
  });
});

describe("GET /api/org-membership — read gate", () => {
  test("requires org_membership.view", async () => {
    await GET(new Request("http://localhost/api/org-membership"));
    expect(requireAuthorization).toHaveBeenCalledWith("org_membership", "view");
  });

  test("unauthorized read → 403", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false, error: "errors.insufficientPermissions" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const res = await GET(new Request("http://localhost/api/org-membership"));
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/org-membership — request validation (M, body manipulation)", () => {
  test("missing user_cid or group_name → 400", async () => {
    for (const body of [
      { group_name: "FUTURE STUDIO", action: "joined" },
      { user_cid: "U1", action: "joined" },
    ]) {
      const res = await PUT(jsonReq(body));
      expect(res.status).toBe(400);
    }
  });

  test("unknown action → 400", async () => {
    const res = await PUT(jsonReq({ user_cid: "U1", group_name: "FUTURE STUDIO", action: "promote" }));
    expect(res.status).toBe(400);
  });

  test("invalid expires_at → 400", async () => {
    const res = await PUT(
      jsonReq({ user_cid: "U1", group_name: "FUTURE STUDIO", action: "joined", expires_at: "not-a-date" }),
    );
    expect(res.status).toBe(400);
  });

  test("action on a non-existent membership (other than joined) → 404", async () => {
    const res = await PUT(jsonReq({ user_cid: "U1", group_name: "FUTURE STUDIO", action: "renewed" }));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/org-membership — lifecycle (A, F, G, O)", () => {
  test("authorized add (joined) creates membership + event + user_groups sync (A)", async () => {
    membershipLib.getMembership
      .mockResolvedValueOnce(null) // current
      .mockResolvedValueOnce({ user_cid: "U1", group_name: "FUTURE STUDIO", started_at: "2026-01-01T00:00:00Z", expires_at: null, status: "active" }); // updated
    const res = await PUT(jsonReq({ user_cid: "U1", group_name: "FUTURE STUDIO", action: "joined" }));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO group_memberships"))).toBe(true);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO group_membership_events"))).toBe(true);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO user_groups"))).toBe(true);
    expect(invalidateAllAuthorizationContexts).toHaveBeenCalled();
  });

  test("renewal UPDATES the existing row — never a second membership (F, G)", async () => {
    membershipLib.getMembership
      .mockResolvedValueOnce({ user_cid: "U1", group_name: "FUTURE STUDIO", started_at: "2026-01-01T00:00:00Z", expires_at: null, status: "active" })
      .mockResolvedValueOnce({ user_cid: "U1", group_name: "FUTURE STUDIO", started_at: "2026-01-01T00:00:00Z", expires_at: "2027-01-31T00:00:00Z", status: "active" });
    const res = await PUT(
      jsonReq({ user_cid: "U1", group_name: "FUTURE STUDIO", action: "renewed", expires_at: "2027-01-31" }),
    );
    expect(res.status).toBe(200);
    expect(mockExecutedQueries.some((q) => q.includes("UPDATE group_memberships"))).toBe(true);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO group_memberships"))).toBe(false);
    expect(mockExecutedQueries.some((q) => q.includes("INSERT INTO group_membership_events"))).toBe(true);
  });

  test("ending a membership never deletes the row or the person (O)", async () => {
    membershipLib.getMembership
      .mockResolvedValueOnce({ user_cid: "U1", group_name: "FUTURE STUDIO", started_at: "2026-01-01T00:00:00Z", expires_at: null, status: "active" })
      .mockResolvedValueOnce({ user_cid: "U1", group_name: "FUTURE STUDIO", started_at: "2026-01-01T00:00:00Z", expires_at: null, status: "ended" });
    const res = await PUT(jsonReq({ user_cid: "U1", group_name: "FUTURE STUDIO", action: "ended" }));
    expect(res.status).toBe(200);
    expect(mockExecutedQueries.some((q) => q.includes("DELETE FROM group_memberships"))).toBe(false);
    expect(mockExecutedQueries.some((q) => q.includes("DELETE FROM contacts"))).toBe(false);
    expect(mockExecutedQueries.some((q) => q.includes("UPDATE group_memberships"))).toBe(true);
  });
});
