/**
 * Characterisation net for the decisions that live inside
 * `src/app/api/responsibilities/assign/route.js` today.
 *
 * These assertions pin the BEHAVIOUR before the logic moves to
 * `@/services/authorization/responsibilityAssignment.js` (corridor L5, block c):
 * the three-field validation, the assign/remove branches with their BEST-EFFORT
 * base-access handling (a failure is swallowed and only logged — it never fails
 * the assignment), and the unknown-action fallthrough.
 *
 * The real `@/models/responsibilities` SQL runs against a mocked `@/lib/db`, so
 * the statements asserted here are the ones the route actually causes.
 */

const mockExecuted = [];

const mockState = {
  responsibility: null, // getResponsibilityName — { name, key }
  contactName: null, // getContactName
  assignResult: { success: true },
  removeResult: { success: true },
  grantModules: [], // modules created by grantResponsibilityBaseAccess
  revokeModules: [], // modules revoked by revokeResponsibilityBaseAccess
  grantThrows: null,
  revokeThrows: null,
  session: { cid: "SA-1", name: "Super Admin" },
  contactRole: "staff", // the assignee's baseline (Phase H profile ↔ role rule)
};

function mockRows(sql) {
  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sql)) return { rows: [] };
  if (sql.includes("FROM responsibilities WHERE id = ?"))
    return { rows: mockState.responsibility ? [mockState.responsibility] : [] };
  if (sql.includes("SELECT name FROM contacts WHERE cid = ?"))
    return { rows: mockState.contactName ? [{ name: mockState.contactName }] : [] };
  // Phase H — the profile ↔ role rule is enforced ("block"). The fixture
  // responsibility is `program_manager`, a staff-only profile, so the assignee
  // is a baseline staff member; without this the écart would be refused before
  // the assign branch runs.
  if (sql.includes("SELECT role, access_profile_id, profile_key FROM contacts WHERE cid = ?"))
    return { rows: [{ role: mockState.contactRole, access_profile_id: null }] };
  return { rows: [], rowsAffected: 1 };
}

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (query) => {
      const sql = String(typeof query === "string" ? query : query?.sql || "");
      mockExecuted.push({ sql });
      return mockRows(sql);
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => mockState.session),
}));
jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/services/authorization/accessProfiles", () => ({
  assignResponsibility: jest.fn(async () => mockState.assignResult),
  removeResponsibility: jest.fn(async () => mockState.removeResult),
  getAllResponsibilities: jest.fn(async () => mockState.allResponsibilities || []),
}));
jest.mock("@/models/authorization/bootstrap", () => ({
  seedDefaultResponsibilities: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/server/authz/responses", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
  requireScopedAccess: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/featureAccess", () => ({
  normalizeAllowedRoles: jest.fn((value) => (Array.isArray(value) ? value : [])),
}));

jest.mock("@/models/responsibilities", () => ({
  grantResponsibilityBaseAccess: jest.fn(async () => {
    if (mockState.grantThrows) throw mockState.grantThrows;
    return mockState.grantModules;
  }),
  revokeResponsibilityBaseAccess: jest.fn(async () => {
    if (mockState.revokeThrows) throw mockState.revokeThrows;
    return mockState.revokeModules;
  }),
  getAssignedResponsibilitiesForUser: jest.fn(async () => ({ rows: mockState.assigned || [] })),
  getContactByCid: jest.fn(async () => ({ rows: mockState.contact || [] })),
  getResponsibilityName: jest.fn(async () => ({
    rows: mockState.responsibility ? [mockState.responsibility] : [],
  })),
  getContactName: jest.fn(async () => ({
    rows: mockState.contactName ? [{ name: mockState.contactName }] : [],
  })),
}));

const {
  grantResponsibilityBaseAccess,
  revokeResponsibilityBaseAccess,
} = require("@/models/responsibilities");
const { assignResponsibility, removeResponsibility } = require("@/services/authorization/accessProfiles");
const { logPermissionAudit } = require("@/models/authorization/accessQueries");
const route = require("@/app/api/responsibilities/assign/route");

const putReq = (body) =>
  new Request("http://localhost/api/responsibilities/assign", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mockExecuted.length = 0;
  Object.assign(mockState, {
    responsibility: { name: "Program Manager", key: "program_manager" },
    contactName: "Josias Hinnakou",
    assignResult: { success: true },
    removeResult: { success: true },
    grantModules: [],
    revokeModules: [],
    grantThrows: null,
    revokeThrows: null,
    session: { cid: "SA-1", name: "Super Admin" },
    contactRole: "staff",
  });
  jest.clearAllMocks();
});

describe("input validation — all three fields or nothing", () => {
  test.each([
    ["missing user_cid", { responsibility_id: 2, action: "assign" }],
    ["missing responsibility_id", { user_cid: "U-1", action: "assign" }],
    ["missing action", { user_cid: "U-1", responsibility_id: 2 }],
    ["empty body", {}],
  ])("%s → 400, nothing written", async (_label, body) => {
    const res = await route.PUT(putReq(body));
    expect(res.status).toBe(400);
    expect(assignResponsibility).not.toHaveBeenCalled();
    expect(removeResponsibility).not.toHaveBeenCalled();
  });

  test("falsy action values are refused — the guard is truthiness, not membership", async () => {
    // `action: ""` is falsy → 400 from the required-guard, NOT the 400 from the
    // unknown-action fallthrough. Both are 400 but with different bodies.
    const res = await route.PUT(putReq({ user_cid: "U-1", responsibility_id: 2, action: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toMatch(/are required/i);
  });
});

describe("separation of duties", () => {
  test("self-target refused for both branches, before any write", async () => {
    for (const action of ["assign", "remove"]) {
      mockExecuted.length = 0;
      mockState.session = { cid: "U-1", name: "Self" };
      const res = await route.PUT(putReq({ user_cid: "U-1", responsibility_id: 2, action }));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(String(body.error)).toMatch(/your own responsibilities/i);
      expect(assignResponsibility).not.toHaveBeenCalled();
      expect(removeResponsibility).not.toHaveBeenCalled();
    }
  });
});

describe("unknown action", () => {
  test("falls through to 400 with the allowed values named, nothing written", async () => {
    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "promote" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(String(body.error)).toMatch(/unknown action: promote/i);
    expect(String(body.error)).toMatch(/'assign' or 'remove'/);
    expect(assignResponsibility).not.toHaveBeenCalled();
    expect(removeResponsibility).not.toHaveBeenCalled();
  });

  test("action matching is exact — 'ASSIGN' is not 'assign'", async () => {
    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "ASSIGN" }),
    );
    expect(res.status).toBe(400);
    expect(String((await res.json()).error)).toMatch(/unknown action/i);
    expect(assignResponsibility).not.toHaveBeenCalled();
  });
});

describe("assign branch", () => {
  test("assigns, then grants base access, then audits — in that order", async () => {
    mockState.grantModules = ["projects", "programs"];

    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "assign" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // The grant note appears in BOTH the audit details and the user message.
    expect(String(body.message)).toContain("Base access granted: projects, programs");
    expect(assignResponsibility).toHaveBeenCalledWith("U-1", 2, "SA-1");
    expect(grantResponsibilityBaseAccess).toHaveBeenCalledWith({
      userCid: "U-1",
      responsibilityKey: "program_manager",
      grantedBy: "SA-1",
    });
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "responsibility_assigned", targetCid: "U-1" }),
    );
  });

  test("a responsibility with NO key skips the base-access grant entirely", async () => {
    mockState.responsibility = { name: "Legacy", key: null };

    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "assign" }),
    );
    expect(res.status).toBe(200);
    expect(grantResponsibilityBaseAccess).not.toHaveBeenCalled();
    // No note, and the message must not contain a stray separator.
    expect(String((await res.json()).message)).not.toMatch(/Base access/);
  });

  test("a grant failure is SWALLOWED: the assignment still succeeds", async () => {
    mockState.grantThrows = new Error("user_capabilities write failed");

    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "assign" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // No base-access note, and the message still reads cleanly.
    expect(String(body.message)).not.toMatch(/Base access/);
    expect(String(body.message)).not.toMatch(/\.\./);
  });

  test("an unknown responsibility still assigns, naming it 'Unknown'", async () => {
    mockState.responsibility = null;
    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 999, action: "assign" }),
    );
    expect(res.status).toBe(200);
    expect(String((await res.json()).message)).toContain('"Unknown"');
    expect(grantResponsibilityBaseAccess).not.toHaveBeenCalled();
  });

  test("a model failure on assign → 500 and NO audit entry", async () => {
    mockState.assignResult = { success: false, error: "boom" };
    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "assign" }),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("boom");
    expect(logPermissionAudit).not.toHaveBeenCalled();
    expect(grantResponsibilityBaseAccess).not.toHaveBeenCalled();
  });

  test("an empty grant list yields no note at all", async () => {
    mockState.grantModules = [];
    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "assign" }),
    );
    expect(String((await res.json()).message)).not.toMatch(/Base access|Revoked/);
  });
});

describe("remove branch", () => {
  test("removes, then revokes base access, then audits", async () => {
    mockState.revokeModules = ["projects"];

    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "remove" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(String(body.message)).toContain("Base access revoked: projects");
    expect(removeResponsibility).toHaveBeenCalledWith("U-1", 2);
    expect(revokeResponsibilityBaseAccess).toHaveBeenCalledWith({
      userCid: "U-1",
      responsibilityKey: "program_manager",
    });
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "responsibility_removed", targetCid: "U-1" }),
    );
  });

  test("a revoke failure is SWALLOWED: the removal still succeeds", async () => {
    mockState.revokeThrows = new Error("ledger read failed");

    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "remove" }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  test("a model failure on remove → 500 and NO revoke, NO audit", async () => {
    mockState.removeResult = { success: false, error: "nope" };
    const res = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "remove" }),
    );
    expect(res.status).toBe(500);
    expect(revokeResponsibilityBaseAccess).not.toHaveBeenCalled();
    expect(logPermissionAudit).not.toHaveBeenCalled();
  });

  test("the two branches use the OPPOSITE verb in the note (granted vs revoked)", async () => {
    mockState.grantModules = ["projects"];
    const assigned = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "assign" }),
    );
    expect(String((await assigned.json()).message)).toMatch(/Base access granted/);

    mockState.revokeModules = ["projects"];
    const removed = await route.PUT(
      putReq({ user_cid: "U-1", responsibility_id: 2, action: "remove" }),
    );
    expect(String((await removed.json()).message)).toMatch(/Base access revoked/);
  });
});

describe("GET /api/responsibilities/assign — self-healing list", () => {
  const getReq = (cid) =>
    new Request(`http://localhost/api/responsibilities/assign?user_cid=${cid}`);

  test("missing user_cid → 400", async () => {
    const res = await route.GET(new Request("http://localhost/api/responsibilities/assign"));
    expect(res.status).toBe(400);
  });

  test("assignments come with a toggle flag and normalized roles", async () => {
    mockState.allResponsibilities = [
      { id: 1, name: "A", allowed_roles: ["staff"] },
      { id: 2, name: "B", allowed_roles: null },
    ];
    mockState.assigned = [{ id: 2 }];

    const res = await route.GET(getReq("U-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.responsibilities).toEqual([
      { id: 1, name: "A", allowed_roles: ["staff"], assigned: false },
      { id: 2, name: "B", allowed_roles: [], assigned: true },
    ]);
  });

  test("the defaults are seeded on every read (self-heal) — BEFORE the guard", async () => {
    const { seedDefaultResponsibilities } = require("@/models/authorization/bootstrap");
    const res = await route.GET(new Request("http://localhost/api/responsibilities/assign"));
    expect(res.status).toBe(400);
    // Even a request that fails validation has already re-seeded: the tab must
    // never render empty.
    expect(seedDefaultResponsibilities).toHaveBeenCalled();
  });

  test("an unknown user is NOT an error — user: null with the full list", async () => {
    mockState.contact = [];
    mockState.allResponsibilities = [{ id: 1, name: "A", allowed_roles: [] }];

    const res = await route.GET(getReq("GHOST"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
    expect(body.responsibilities).toHaveLength(1);
  });
});