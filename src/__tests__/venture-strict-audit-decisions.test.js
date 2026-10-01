/**
 * Characterization tests for the venture strict-mode readiness audit route's
 * DECISIONS, written BEFORE moving them out of `venture-strict-audit/route.js`.
 *
 * Coverage gap this file closes: `phase5b-venture-pilot.test.js` unit-tests the
 * pure aggregator `summarizeVentureStrictAudit`, but the ROUTE had no test at
 * all. So the limit clamp, the per-cid grouping, the synthetic session and the
 * two fail-closed probes were completely uncharacterized.
 *
 * `summarizeVentureStrictAudit` is used REAL here (requireActual) so the route's
 * own decisions are measured against the real aggregation.
 */

const mockState = {
  relationships: [],
  contacts: [],
};

let mockAuthzDecision = null; // null = granted

// Per-cid probe answers, keyed by cid.
const mockContextByCid = {};
let mockContextThrowFor = []; // cids whose getAuthorizationContext throws
let mockAuthorizeImpl = () => false;

// The route imports the BARREL (@/lib/authorization); after extraction the
// service imports the context MODULE. Both mocks share these two spies, so the
// surfaces cannot disagree — that is what keeps a mismatch from turning into a
// silent 500.
const mockGetAuthorizationContext = jest
  .fn()
  .mockImplementation(async (sessionLike) => {
    if (mockContextThrowFor.includes(sessionLike?.cid)) {
      throw new Error(`context unavailable for ${sessionLike.cid}`);
    }
    return mockContextByCid[sessionLike?.cid] || {};
  });
const mockAuthorize = jest.fn().mockImplementation((...args) => mockAuthorizeImpl(...args));

const mockScopeByCid = {};
let mockScopeThrowFor = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn().mockResolvedValue({ rows: [] }) },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/services/authorization/context", () => ({
  ...jest.requireActual("@/services/authorization/context"),
  getAuthorizationContext: mockGetAuthorizationContext,
  authorize: mockAuthorize,
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
  getAuthorizationContext: mockGetAuthorizationContext,
  authorize: mockAuthorize,
}));

// The route used to import the FACADE (@/lib/authorization/scope); the service
// imports ./scope, which is what the facade re-exports. Mock the module that is
// really imported — and expose the SAME spy on the facade path so neither
// surface can disagree after the extraction.
const mockResolveScopeIds = jest
  .fn()
  .mockImplementation(async (policyKey, cid) => {
    if (mockScopeThrowFor.includes(cid)) {
      throw new Error(`scope unavailable for ${cid}`);
    }
    return mockScopeByCid[cid];
  });

jest.mock("@/services/authorization/scope", () => ({
  ...jest.requireActual("@/services/authorization/scope"),
  resolveScopeIds: mockResolveScopeIds,
}));

jest.mock("@/lib/authorization/scope", () => ({
  ...jest.requireActual("@/lib/authorization/scope"),
  resolveScopeIds: mockResolveScopeIds,
}));

const mockRealAuditModel = jest.requireActual("@/models/authorization/ventureScopeAudit");

jest.mock("@/models/authorization/ventureScopeAudit", () => ({
  ...mockRealAuditModel,
  listVentureRelationships: jest.fn().mockImplementation(async () => mockState.relationships),
  listAuditContacts: jest.fn().mockImplementation(async () => mockState.contacts),
}));

const { requireAuthorization } = require("@/lib/authorization");
const { getAuthorizationContext: _unusedBarrelContext } = require("@/lib/authorization");
const {
  getAuthorizationContext,
  authorize,
} = require("@/services/authorization/context");
const { resolveScopeIds } = require("@/services/authorization/scope");
const {
  listVentureRelationships,
  listAuditContacts,
} = require("@/models/authorization/ventureScopeAudit");
const route = require("@/app/api/engineering/permissions/venture-strict-audit/route");

const getReq = (query = "") =>
  new Request(`http://localhost/api/engineering/permissions/venture-strict-audit${query}`);

beforeEach(() => {
  mockState.relationships = [];
  mockState.contacts = [];
  mockAuthzDecision = null;
  mockContextThrowFor = [];
  mockScopeThrowFor = [];
  mockAuthorizeImpl = () => false;
  for (const key of Object.keys(mockContextByCid)) delete mockContextByCid[key];
  for (const key of Object.keys(mockScopeByCid)) delete mockScopeByCid[key];
  jest.clearAllMocks();
});

describe("GET — read gate", () => {
  test("requires permissions.view_matrix and is read-only (no write gate)", async () => {
    const res = await route.GET(getReq());
    expect(res.status).toBe(200);
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  });

  test("a denied read returns the gate error and reads nothing", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false }), { status: 403 });
    const res = await route.GET(getReq());
    expect(res.status).toBe(403);
    expect(listVentureRelationships).not.toHaveBeenCalled();
  });

  test("a failure is a 500 carrying the raw message (unlike the i18n routes)", async () => {
    listVentureRelationships.mockRejectedValueOnce(new Error("boom"));
    const res = await route.GET(getReq());
    expect(res.status).toBe(500);
    // Pinned as-is: this route surfaces error.message instead of
    // "errors.somethingWrong". Changing it is a separate decision, not this
    // block's business.
    expect((await res.json()).error).toBe("boom");
  });
});

describe("GET — the limit clamp", () => {
  test("defaults to 300 people when ?limit is absent", async () => {
    mockState.relationships = Array.from({ length: 400 }, (_, i) => ({ cid: `C${i}`, venture_id: `V${i}` }));
    const body = await (await route.GET(getReq())).json();
    expect(body.evaluated).toBe(300);
  });

  test("?limit is honoured when in range", async () => {
    mockState.relationships = Array.from({ length: 10 }, (_, i) => ({ cid: `C${i}`, venture_id: `V${i}` }));
    const body = await (await route.GET(getReq("?limit=4"))).json();
    expect(body.evaluated).toBe(4);
  });

  test("?limit above 1000 is clamped to 1000", async () => {
    mockState.relationships = Array.from({ length: 1200 }, (_, i) => ({ cid: `C${i}`, venture_id: `V${i}` }));
    const body = await (await route.GET(getReq("?limit=99999"))).json();
    expect(body.evaluated).toBe(1000);
  });

  test("?limit below 1 is clamped to 1", async () => {
    mockState.relationships = Array.from({ length: 5 }, (_, i) => ({ cid: `C${i}`, venture_id: `V${i}` }));
    const body = await (await route.GET(getReq("?limit=-7"))).json();
    expect(body.evaluated).toBe(1);
  });

  test("?limit=0 falls back to the DEFAULT 300, not to 1", async () => {
    // Number("0") is 0, which is falsy, so `|| 300` wins before the clamp.
    // Pinned because it is surprising: asking for 0 people evaluates 300.
    mockState.relationships = Array.from({ length: 400 }, (_, i) => ({ cid: `C${i}`, venture_id: `V${i}` }));
    const body = await (await route.GET(getReq("?limit=0"))).json();
    expect(body.evaluated).toBe(300);
  });

  test("a non-numeric ?limit falls back to 300", async () => {
    mockState.relationships = Array.from({ length: 400 }, (_, i) => ({ cid: `C${i}`, venture_id: `V${i}` }));
    const body = await (await route.GET(getReq("?limit=abc"))).json();
    expect(body.evaluated).toBe(300);
  });

  test("the limit caps PEOPLE, not relationships — relationships stays uncapped", async () => {
    mockState.relationships = [
      { cid: "C1", venture_id: "V1" },
      { cid: "C1", venture_id: "V2" },
      { cid: "C2", venture_id: "V3" },
    ];
    const body = await (await route.GET(getReq("?limit=1"))).json();
    expect(body.evaluated).toBe(1);
    expect(body.relationships).toBe(3);
  });
});

describe("GET — grouping ventures per person", () => {
  test("cid and venture_id are coerced to strings on both sides", async () => {
    mockState.relationships = [{ cid: 12, venture_id: 34 }];
    mockContextByCid["12"] = {};
    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0].cid).toBe("12");
    expect(body.rows[0].ventures).toBe(1);
  });

  test("one row per person, carrying all their ventures", async () => {
    mockState.relationships = [
      { cid: "C1", venture_id: "V1" },
      { cid: "C2", venture_id: "V9" },
      { cid: "C1", venture_id: "V2" },
    ];
    const body = await (await route.GET(getReq())).json();
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0].cid).toBe("C1");
    expect(body.rows[0].ventures).toBe(2);
    expect(body.rows[1].cid).toBe("C2");
  });

  test("first-seen order decides who survives the limit cap", async () => {
    mockState.relationships = [
      { cid: "C1", venture_id: "V1" },
      { cid: "C2", venture_id: "V2" },
      { cid: "C1", venture_id: "V3" },
      { cid: "C3", venture_id: "V4" },
    ];
    const body = await (await route.GET(getReq("?limit=2"))).json();
    // Distinct cids in insertion order: C1, C2 — C3 is never probed even
    // though its relationship was read.
    expect(body.rows.map((row) => row.cid)).toEqual(["C1", "C2"]);
  });

  test("a person reachable through BOTH venture tables counts the venture twice", async () => {
    // The read UNIONs venture_members and venture_staff_assignments; a person
    // attached to V1 as a member AND as staff yields two rows. There is no
    // per-person dedup, so the count is 2. Pinned: the number is a row count,
    // not a distinct-venture count.
    mockState.relationships = [
      { cid: "C1", venture_id: "V1" },
      { cid: "C1", venture_id: "V1" },
    ];
    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0].ventures).toBe(2);
  });

  test("no relationship means an empty report, never an error", async () => {
    const body = await (await route.GET(getReq())).json();
    expect(body).toEqual({
      success: true,
      evaluated: 0,
      relationships: 0,
      total: 0,
      viewAllowed: 0,
      viewMissing: [],
      editMissing: [],
      rows: [],
    });
    // No person, so no probe at all. The contact read is still asked for,
    // with an EMPTY cid list — the model short-circuits it before any SQL.
    expect(listAuditContacts).toHaveBeenCalledWith([]);
    expect(getAuthorizationContext).not.toHaveBeenCalled();
    expect(resolveScopeIds).not.toHaveBeenCalled();
  });
});

describe("GET — the synthetic session is built from the contact row", () => {
  test("name, role and email come from the contact row", async () => {
    mockState.relationships = [{ cid: "C1", venture_id: "V1" }];
    mockState.contacts = [{ cid: "C1", name: "Ada", role: "staff", email: "ada@x.io" }];
    await route.GET(getReq());

    expect(getAuthorizationContext).toHaveBeenCalledWith({
      cid: "C1",
      role: "staff",
      email: "ada@x.io",
      name: "Ada",
    });
  });

  test("a person with NO contact row still gets a session, with nulls", async () => {
    mockState.relationships = [{ cid: "GHOST", venture_id: "V1" }];
    mockState.contacts = [];
    const body = await (await route.GET(getReq())).json();
    // The audit is about people attached to ventures, so a missing contact is
    // reported, not dropped.
    expect(body.evaluated).toBe(1);
    expect(body.rows[0]).toMatchObject({ cid: "GHOST", name: null, role: null });
    expect(getAuthorizationContext).toHaveBeenCalledWith({
      cid: "GHOST",
      role: null,
      email: null,
      name: null,
    });
  });

  test("contacts are asked for in ONE batch, by the capped cid list", async () => {
    mockState.relationships = [
      { cid: "C1", venture_id: "V1" },
      { cid: "C2", venture_id: "V2" },
    ];
    await route.GET(getReq());
    expect(listAuditContacts).toHaveBeenCalledTimes(1);
    expect(listAuditContacts).toHaveBeenCalledWith(["C1", "C2"]);
  });
});

describe("GET — the per-person gate probe fails closed", () => {
  test("a super admin is allowed both keys WITHOUT consulting authorize()", async () => {
    mockState.relationships = [{ cid: "SA", venture_id: "V1" }];
    mockContextByCid["SA"] = { isSuperAdmin: true };
    mockAuthorizeImpl = () => false;

    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0]).toMatchObject({ viewAllowed: true, editAllowed: true, missing: [] });
    // isSuperAdmin short-circuits: authorize() is never asked.
    expect(authorize).not.toHaveBeenCalled();
  });

  test("view and edit are probed independently", async () => {
    mockState.relationships = [{ cid: "C1", venture_id: "V1" }];
    mockContextByCid["C1"] = { isSuperAdmin: false };
    mockAuthorizeImpl = (_ctx, _module, capability) => capability === "view";

    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0]).toMatchObject({ viewAllowed: true, editAllowed: false, missing: ["ventures.edit"] });
    expect(authorize).toHaveBeenCalledWith({ isSuperAdmin: false }, "ventures", "view");
    expect(authorize).toHaveBeenCalledWith({ isSuperAdmin: false }, "ventures", "edit");
  });

  test("an unresolvable person is reported as missing BOTH keys", async () => {
    mockState.relationships = [{ cid: "BROKEN", venture_id: "V1" }];
    mockContextThrowFor = ["BROKEN"];

    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0]).toMatchObject({ viewAllowed: false, editAllowed: false, missing: ["ventures.view"] });
    expect(body.viewMissing).toHaveLength(1);
    // Fail closed means the probe error is swallowed, not surfaced.
    expect(body.error).toBeUndefined();
  });

  test("a throwing authorize() also fails closed", async () => {
    mockState.relationships = [{ cid: "C1", venture_id: "V1" }];
    mockContextByCid["C1"] = {};
    mockAuthorizeImpl = () => {
      throw new Error("grants exploded");
    };

    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0]).toMatchObject({ viewAllowed: false, editAllowed: false });
    expect(body.editMissing).toHaveLength(0);
  });

  test("a context that resolves to nothing is treated as NO access", async () => {
    mockState.relationships = [{ cid: "C1", venture_id: "V1" }];
    mockContextByCid["C1"] = undefined;
    mockAuthorizeImpl = () => false;
    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0].viewAllowed).toBe(false);
  });

  test("missing reports the FIRST missing key only, never both", async () => {
    mockState.relationships = [{ cid: "C1", venture_id: "V1" }];
    mockContextByCid["C1"] = {};
    mockAuthorizeImpl = () => false;
    const body = await (await route.GET(getReq())).json();
    // `viewAllowed` gates the report: if you cannot read the venture, the edit
    // gap is not listed — reading is the prerequisite.
    expect(body.rows[0].missing).toEqual(["ventures.view"]);
    expect(body.viewMissing).toHaveLength(1);
    expect(body.editMissing).toHaveLength(0);
    expect(body.viewAllowed).toBe(0);
  });
});

describe("GET — the scope probe fails closed", () => {
  test("scope is resolved under venture_own with the person's email", async () => {
    mockState.relationships = [{ cid: "C1", venture_id: "V1" }];
    mockState.contacts = [{ cid: "C1", name: "Ada", role: "staff", email: "ada@x.io" }];
    mockScopeByCid["C1"] = ["V1", "V2"];

    const body = await (await route.GET(getReq())).json();
    expect(resolveScopeIds).toHaveBeenCalledWith("venture_own", "C1", { email: "ada@x.io" });
    expect(body.rows[0].scopeCount).toBe(2);
  });

  test("a failing scope resolution reports 0, never a crash and never -1", async () => {
    mockState.relationships = [{ cid: "C1", venture_id: "V1" }];
    mockScopeThrowFor = ["C1"];
    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0].scopeCount).toBe(0);
  });

  test("a non-array scope answer counts as 0", async () => {
    mockState.relationships = [{ cid: "C1", venture_id: "V1" }];
    mockScopeByCid["C1"] = { not: "an array" };
    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0].scopeCount).toBe(0);
  });

  test("an EMPTY scope list is 0, and does not mean the person is dropped", async () => {
    mockState.relationships = [{ cid: "C1", venture_id: "V1" }];
    mockScopeByCid["C1"] = [];
    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0].scopeCount).toBe(0);
    expect(body.evaluated).toBe(1);
  });

  test("a failing gate probe does NOT stop the scope probe", async () => {
    mockState.relationships = [{ cid: "C1", venture_id: "V1" }];
    mockContextThrowFor = ["C1"];
    mockScopeByCid["C1"] = ["V1"];
    const body = await (await route.GET(getReq())).json();
    expect(body.rows[0]).toMatchObject({ viewAllowed: false, scopeCount: 1 });
  });
});

describe("GET — one probe per evaluated person, no batching", () => {
  test("a wide organization costs one gate probe AND one scope call per person", async () => {
    mockState.relationships = Array.from({ length: 12 }, (_, i) => ({
      cid: `C${i}`,
      venture_id: "V1",
    }));
    mockState.contacts = Array.from({ length: 12 }, (_, i) => ({
      cid: `C${i}`,
      name: `P${i}`,
      role: "staff",
      email: `p${i}@x.io`,
    }));
    for (let i = 0; i < 12; i += 1) mockScopeByCid[`C${i}`] = ["V1"];

    const body = await (await route.GET(getReq())).json();
    expect(body.evaluated).toBe(12);
    // Current shape: sequential per-person probes. Pinned so the extraction
    // cannot quietly change the probe count.
    expect(getAuthorizationContext).toHaveBeenCalledTimes(12);
    expect(resolveScopeIds).toHaveBeenCalledTimes(12);
    expect(listAuditContacts).toHaveBeenCalledTimes(1);
  });

  test("contacts for people past the cap are not requested", async () => {
    mockState.relationships = [
      { cid: "C1", venture_id: "V1" },
      { cid: "C2", venture_id: "V2" },
      { cid: "C3", venture_id: "V3" },
    ];
    await route.GET(getReq("?limit=2"));
    expect(listAuditContacts).toHaveBeenCalledWith(["C1", "C2"]);
  });
});