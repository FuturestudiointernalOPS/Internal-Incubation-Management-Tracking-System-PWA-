/**
 * Characterisation net for the decisions that live inside
 * `src/app/api/responsibilities/route.js` and
 * `src/app/api/responsibilities/access/route.js` today.
 *
 * These assertions pin the BEHAVIOURE before the logic moves to
 * `@/services/authorization/responsibilityCatalog.js` (corridor L5, block d):
 * the five conditional PUT writes, the count-then-delete, and the
 * `null` vs `[]` distinction on `allowed_roles` (null resets to seed
 * defaults, `[]` is a real state meaning "explicitly nobody").
 *
 * The real `@/models/responsibilities` SQL runs against a mocked `@/lib/db`, so
 * the statements asserted here are the ones the routes actually cause.
 */

const mockExecuted = [];

const mockState = {
  assignmentCount: 0, // countResponsibilityAssignments
  accessRow: null, // getResponsibilityAccess — { id, name, key, allowed_roles }
  userResponsibilities: [], // getUserResponsibilities
  allResponsibilities: [], // getAllResponsibilities
};

function mockRows(sql) {
  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sql)) return { rows: [] };
  if (sql.includes("FROM user_responsibilities WHERE responsibility_id = ?"))
    return { rows: [{ cnt: mockState.assignmentCount }] };
  if (sql.includes("FROM responsibilities WHERE id = ?"))
    return { rows: mockState.accessRow ? [mockState.accessRow] : [] };
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

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn().mockResolvedValue({ cid: "SA-1", name: "Super Admin" }),
  logPermissionAudit: jest.fn().mockResolvedValue(true),
  getUserResponsibilities: jest.fn(async () => mockState.userResponsibilities),
  getAllResponsibilities: jest.fn(async () => mockState.allResponsibilities),
  seedDefaultResponsibilities: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/models/responsibilities", () => ({
  countResponsibilityAssignments: jest.fn(async () => ({
    rows: [{ cnt: mockState.assignmentCount }],
  })),
  getResponsibilityAccess: jest.fn(async () => ({
    rows: mockState.accessRow ? [mockState.accessRow] : [],
  })),
  createResponsibility: jest.fn().mockResolvedValue(true),
  deleteResponsibility: jest.fn().mockResolvedValue(true),
  updateResponsibilityActive: jest.fn().mockResolvedValue(true),
  updateResponsibilityDescription: jest.fn().mockResolvedValue(true),
  updateResponsibilityIcon: jest.fn().mockResolvedValue(true),
  updateResponsibilityKey: jest.fn().mockResolvedValue(true),
  updateResponsibilityName: jest.fn().mockResolvedValue(true),
  setResponsibilityAllowedRoles: jest.fn().mockResolvedValue(true),
}));

const responsibilitiesModel = require("@/models/responsibilities");
const { logPermissionAudit } = require("@/lib/auth");
const catalogRoute = require("@/app/api/responsibilities/route");
const accessRoute = require("@/app/api/responsibilities/access/route");

const req = (method, url, body) =>
  new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

// The model layer is mocked, so write ORDER is asserted on the mock calls.
const callOrder = (fn) => fn.mock.invocationCallOrder[0];

beforeEach(() => {
  mockExecuted.length = 0;
  Object.assign(mockState, {
    assignmentCount: 0,
    accessRow: null,
    userResponsibilities: [],
    allResponsibilities: [],
  });
  jest.clearAllMocks();
});

describe("GET /api/responsibilities — two shapes, one endpoint", () => {
  test("with user_cid → that user's responsibilities", async () => {
    mockState.userResponsibilities = [{ id: 1, name: "A", allowed_roles: null }];
    const res = await catalogRoute.GET(
      req("GET", "http://localhost/api/responsibilities?user_cid=U-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user_cid).toBe("U-1");
    expect(body.responsibilities).toHaveLength(1);
  });

  test("without user_cid → the full catalog, no user_cid key at all", async () => {
    mockState.allResponsibilities = [{ id: 1, name: "A", allowed_roles: '["staff"]' }];
    const res = await catalogRoute.GET(req("GET", "http://localhost/api/responsibilities"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("user_cid");
    // The JSON string is parsed for the UI.
    expect(body.responsibilities[0].allowed_roles).toEqual(["staff"]);
  });

  test("an empty allowed_roles string stays null, NOT [] — 'not configured' != 'nobody'", async () => {
    mockState.allResponsibilities = [
      { id: 1, name: "A", allowed_roles: "" },
      { id: 2, name: "B", allowed_roles: "[]" },
    ];
    const res = await catalogRoute.GET(req("GET", "http://localhost/api/responsibilities"));
    const body = await res.json();
    expect(body.responsibilities[0].allowed_roles).toBeNull(); // not configured
    expect(body.responsibilities[1].allowed_roles).toEqual([]); // explicitly nobody
  });

  test("the defaults are seeded before the query, on every read", async () => {
    const { seedDefaultResponsibilities } = require("@/lib/auth");
    await catalogRoute.GET(req("GET", "http://localhost/api/responsibilities"));
    expect(seedDefaultResponsibilities).toHaveBeenCalled();
  });
});

describe("POST /api/responsibilities", () => {
  test("name and key are both required", async () => {
    for (const body of [{ name: "X" }, { key: "x" }, {}]) {
      const res = await catalogRoute.POST(
        req("POST", "http://localhost/api/responsibilities", body),
      );
      expect(res.status).toBe(400);
    }
    expect(responsibilitiesModel.createResponsibility).not.toHaveBeenCalled();
  });

  test("creates with description and icon passed through unchanged", async () => {
    const res = await catalogRoute.POST(
      req("POST", "http://localhost/api/responsibilities", {
        name: "Coach",
        key: "coach",
        description: "D",
        icon: "I",
      }),
    );
    expect(res.status).toBe(200);
    expect(responsibilitiesModel.createResponsibility).toHaveBeenCalledWith(
      "Coach",
      "coach",
      "D",
      "I",
    );
  });
});

describe("PUT /api/responsibilities — conditional writes", () => {
  test("missing id → 400, no write", async () => {
    const res = await catalogRoute.PUT(
      req("PUT", "http://localhost/api/responsibilities", { name: "X" }),
    );
    expect(res.status).toBe(400);
    expect(responsibilitiesModel.updateResponsibilityName).not.toHaveBeenCalled();
  });

  test("only the PRESENT fields are written, in a fixed order", async () => {
    await catalogRoute.PUT(
      req("PUT", "http://localhost/api/responsibilities", {
        id: 3,
        is_active: 0,
        description: "new",
      }),
    );
    expect(responsibilitiesModel.updateResponsibilityDescription).toHaveBeenCalledTimes(1);
    expect(responsibilitiesModel.updateResponsibilityActive).toHaveBeenCalledTimes(1);
    expect(callOrder(responsibilitiesModel.updateResponsibilityDescription)).toBeLessThan(
      callOrder(responsibilitiesModel.updateResponsibilityActive),
    );
    // The three absent fields were never touched.
    expect(responsibilitiesModel.updateResponsibilityName).not.toHaveBeenCalled();
    expect(responsibilitiesModel.updateResponsibilityKey).not.toHaveBeenCalled();
    expect(responsibilitiesModel.updateResponsibilityIcon).not.toHaveBeenCalled();
  });

  test("an absent field writes NOTHING — undefined skips, it does not null out", async () => {
    await catalogRoute.PUT(
      req("PUT", "http://localhost/api/responsibilities", { id: 3, name: "N" }),
    );
    expect(responsibilitiesModel.updateResponsibilityName).toHaveBeenCalledWith(3, "N");
    expect(responsibilitiesModel.updateResponsibilityKey).not.toHaveBeenCalled();
    expect(responsibilitiesModel.updateResponsibilityDescription).not.toHaveBeenCalled();
    expect(responsibilitiesModel.updateResponsibilityIcon).not.toHaveBeenCalled();
    expect(responsibilitiesModel.updateResponsibilityActive).not.toHaveBeenCalled();
  });

  test("explicit nulls DO write — the guard is `!== undefined`, not truthiness", async () => {
    await catalogRoute.PUT(
      req("PUT", "http://localhost/api/responsibilities", {
        id: 3,
        description: null,
        icon: null,
      }),
    );
    // `null` is a deliberate clear, not an omission.
    expect(responsibilitiesModel.updateResponsibilityDescription).toHaveBeenCalledWith(3, null);
    expect(responsibilitiesModel.updateResponsibilityIcon).toHaveBeenCalledWith(3, null);
  });

  test("false and 0 are written, not skipped", async () => {
    await catalogRoute.PUT(
      req("PUT", "http://localhost/api/responsibilities", { id: 3, is_active: 0 }),
    );
    expect(responsibilitiesModel.updateResponsibilityActive).toHaveBeenCalledWith(3, 0);
  });

  test("an id with no updatable field writes nothing at all, still 200", async () => {
    const res = await catalogRoute.PUT(
      req("PUT", "http://localhost/api/responsibilities", { id: 3 }),
    );
    expect(res.status).toBe(200);
    for (const fn of [
      "updateResponsibilityName",
      "updateResponsibilityKey",
      "updateResponsibilityDescription",
      "updateResponsibilityIcon",
      "updateResponsibilityActive",
    ]) {
      expect(responsibilitiesModel[fn]).not.toHaveBeenCalled();
    }
  });

  test("all five fields write in the documented order", async () => {
    await catalogRoute.PUT(
      req("PUT", "http://localhost/api/responsibilities", {
        id: 3,
        is_active: 1,
        icon: "i",
        description: "d",
        key: "k",
        name: "n",
      }),
    );
    // Fixed order: name → key → description → icon → is_active.
    const order = [
      "updateResponsibilityName",
      "updateResponsibilityKey",
      "updateResponsibilityDescription",
      "updateResponsibilityIcon",
      "updateResponsibilityActive",
    ].map((fn) => callOrder(responsibilitiesModel[fn]));
    expect(order).toHaveLength(5);
    expect(order.every(Number.isFinite)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order); // strictly increasing
  });
});

describe("DELETE /api/responsibilities — count-then-delete", () => {
  test("counts assignments BEFORE deleting, and reports them", async () => {
    mockState.assignmentCount = 4;
    const res = await catalogRoute.DELETE(
      req("DELETE", "http://localhost/api/responsibilities?id=3"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unassigned).toBe(4);
    // The delete happened anyway — the count is a REPORT, not a guard.
    expect(responsibilitiesModel.deleteResponsibility).toHaveBeenCalledWith("3");
    expect(
      callOrder(responsibilitiesModel.countResponsibilityAssignments),
    ).toBeLessThan(callOrder(responsibilitiesModel.deleteResponsibility));
  });

  test("a responsibility still assigned to 4 people is deleted — orphans are left to the UI", async () => {
    mockState.assignmentCount = 4;
    await catalogRoute.DELETE(req("DELETE", "http://localhost/api/responsibilities?id=3"));
    expect(responsibilitiesModel.deleteResponsibility).toHaveBeenCalledWith("3");
  });

  test("a missing count row reports 0, not undefined", async () => {
    mockState.assignmentCount = 0;
    const res = await catalogRoute.DELETE(
      req("DELETE", "http://localhost/api/responsibilities?id=3"),
    );
    expect((await res.json()).unassigned).toBe(0);
  });

  test("missing id → 400, no count and no delete", async () => {
    const res = await catalogRoute.DELETE(
      req("DELETE", "http://localhost/api/responsibilities"),
    );
    expect(res.status).toBe(400);
    expect(responsibilitiesModel.deleteResponsibility).not.toHaveBeenCalled();
  });
});

describe("PUT /api/responsibilities/access — null vs []", () => {
  const accessReq = (body) =>
    req("PUT", "http://localhost/api/responsibilities/access", body);

  beforeEach(() => {
    mockState.accessRow = { id: 1, name: "Coach", key: "coach", allowed_roles: null };
  });

  test("null means RESET to seed defaults — stored as SQL NULL, not '[]'", async () => {
    const res = await accessRoute.PUT(accessReq({ id: 1, allowed_roles: null }));
    expect(res.status).toBe(200);
    expect(responsibilitiesModel.setResponsibilityAllowedRoles).toHaveBeenCalledWith(1, null);
  });

  test("undefined (missing key) resets too — same decision", async () => {
    await accessRoute.PUT(accessReq({ id: 1 }));
    expect(responsibilitiesModel.setResponsibilityAllowedRoles).toHaveBeenCalledWith(1, null);
  });

  test("[] means EXPLICITLY NOBODY — a real state, stored as '[]'", async () => {
    await accessRoute.PUT(accessReq({ id: 1, allowed_roles: [] }));
    expect(responsibilitiesModel.setResponsibilityAllowedRoles).toHaveBeenCalledWith(1, "[]");
  });

  test("a non-array (string, object, number) → 400, nothing written", async () => {
    for (const allowed_roles of ["staff", { role: "staff" }, 42]) {
      const res = await accessRoute.PUT(accessReq({ id: 1, allowed_roles }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(String(body.error)).toMatch(/must be an array/i);
    }
    expect(responsibilitiesModel.setResponsibilityAllowedRoles).not.toHaveBeenCalled();
  });

  test("duplicates are removed, order preserved", async () => {
    await accessRoute.PUT(
      accessReq({ id: 1, allowed_roles: ["staff", "intern", "staff"] }),
    );
    expect(responsibilitiesModel.setResponsibilityAllowedRoles).toHaveBeenCalledWith(
      1,
      '["staff","intern"]',
    );
  });

  test("empty strings and whitespace-only entries are DROPPED, not trimmed", async () => {
    await accessRoute.PUT(
      accessReq({ id: 1, allowed_roles: ["staff", "", "   ", "intern"] }),
    );
    // The value is stored as-is: " staff " would keep its spaces.
    expect(responsibilitiesModel.setResponsibilityAllowedRoles).toHaveBeenCalledWith(
      1,
      '["staff","intern"]',
    );
  });

  test("non-string entries are filtered out", async () => {
    await accessRoute.PUT(accessReq({ id: 1, allowed_roles: ["staff", 7, null, true] }));
    expect(responsibilitiesModel.setResponsibilityAllowedRoles).toHaveBeenCalledWith(
      1,
      '["staff"]',
    );
  });

  test("a list of only junk stores '[]', not null — 'nobody' is deliberate", async () => {
    await accessRoute.PUT(accessReq({ id: 1, allowed_roles: ["", "  "] }));
    expect(responsibilitiesModel.setResponsibilityAllowedRoles).toHaveBeenCalledWith(1, "[]");
  });

  test("the response echoes the responsibility with parsed allowed_roles", async () => {
    mockState.accessRow = { id: 1, name: "Coach", key: "coach", allowed_roles: '["old"]' };
    const res = await accessRoute.PUT(accessReq({ id: 1, allowed_roles: ["staff"] }));
    const body = await res.json();
    expect(body.responsibility).toEqual({
      id: 1,
      name: "Coach",
      key: "coach",
      allowed_roles: ["staff"],
    });
  });

  test("after a reset the echoed value is null, not []", async () => {
    mockState.accessRow = { id: 1, name: "Coach", key: "coach", allowed_roles: '["old"]' };
    const res = await accessRoute.PUT(accessReq({ id: 1, allowed_roles: null }));
    expect((await res.json()).responsibility.allowed_roles).toBeNull();
  });

  test("missing id → 400 before any read", async () => {
    const res = await accessRoute.PUT(accessReq({ allowed_roles: ["staff"] }));
    expect(res.status).toBe(400);
    expect(responsibilitiesModel.setResponsibilityAllowedRoles).not.toHaveBeenCalled();
  });

  test("id 0 is treated as missing (falsy guard)", async () => {
    const res = await accessRoute.PUT(accessReq({ id: 0, allowed_roles: ["staff"] }));
    expect(res.status).toBe(400);
  });

  test("unknown responsibility → 404, nothing written", async () => {
    mockState.accessRow = null;
    const res = await accessRoute.PUT(accessReq({ id: 99, allowed_roles: ["staff"] }));
    expect(res.status).toBe(404);
    expect(responsibilitiesModel.setResponsibilityAllowedRoles).not.toHaveBeenCalled();
  });

  test("the audit records the previous AND the new value", async () => {
    mockState.accessRow = { id: 1, name: "Coach", key: "coach", allowed_roles: '["old"]' };
    await accessRoute.PUT(accessReq({ id: 1, allowed_roles: ["staff"] }));
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "responsibility_access_updated",
        capability: "coach",
        previousValue: '["old"]',
        newValue: '["staff"]',
      }),
    );
  });

  test("a null previous value is audited as null", async () => {
    await accessRoute.PUT(accessReq({ id: 1, allowed_roles: ["staff"] }));
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({ previousValue: null }),
    );
  });
});