/**
 * Characterization tests for block i's three routes, written BEFORE moving
 * their decisions out.
 *
 *   - `user-context/route.js` — the read-only projection of ONE user's context
 *   - `context-grants-sweep/route.js` — the shared-secret guard
 *   - `sync-context-grants/route.js` — the reconcile endpoint
 *
 * Coverage that already exists and is NOT duplicated here: `ui4-contexts` and
 * `ui2-people` pin the SOURCETEXT of user-context, `security-lot6-hardening`
 * pins the secret read of the sweep, and `security-request-origin-and-scope`
 * pins the same-origin wiring. This file pins the RUNTIME behaviour behind
 * those source-text assertions.
 */

const mockState = {
  contact: null,
  context: null,
  contactContexts: { contexts: [], unavailable: [] },
  contactContextsThrows: false,
  sweepReport: { success: true, evaluated: 3, applied: 1, revoked: 0, changes: [] },
  syncThrows: false,
};

let mockAuthzDecision = null;
let mockOriginDecision = null;

// Mirrors the real shape: { module: { capability: true } }. A raw Set would
// serialize to {} over JSON, which is exactly what restrictionsToJson exists
// to prevent.
const mockRestrictionsToJson = (restrictions) => ({
  finance: Object.fromEntries([...restrictions].map((cap) => [cap, true])),
});

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn().mockResolvedValue({ rows: [] }) },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
}));

jest.mock("@/lib/requestOrigin", () => ({
  requireSameOrigin: jest.fn().mockImplementation(() => mockOriginDecision),
}));

// The projection service resolves restrictionsToJson from ./context (the
// convention of blocks a-d), so mock the context module too — sharing one fn so
// the two surfaces cannot disagree.
jest.mock("@/services/authorization/context", () => ({
  ...jest.requireActual("@/services/authorization/context"),
  restrictionsToJson: jest.fn().mockImplementation(mockRestrictionsToJson),
}));

jest.mock("@/models/authorization/resolver", () => ({
  resolveAuthorizationContext: jest
    .fn()
    .mockImplementation(async () => mockState.context),
  // Mirrors the real shape: { module: { capability: true } }. A raw Set would
  // serialize to {} over JSON, which is exactly what restrictionsToJson exists
  // to prevent.
  restrictionsToJson: jest.fn().mockImplementation(mockRestrictionsToJson),
}));

jest.mock("@/models/authorization/contactContexts", () => ({
  getContactContexts: jest.fn().mockImplementation(async () => {
    if (mockState.contactContextsThrows) {
      throw new Error("context read exploded");
    }
    return mockState.contactContexts;
  }),
}));

jest.mock("@/models/responsibilities", () => ({
  getContactByCid: jest.fn().mockImplementation(async () => ({
    rows: mockState.contact ? [mockState.contact] : [],
  })),
}));

const mockSyncAll = jest.fn().mockImplementation(async () => {
  if (mockState.syncThrows) throw new Error("reconcile exploded");
  return mockState.sweepReport;
});

jest.mock("@/services/authorization/contextGrants", () => ({
  syncAllContextGrantsEverywhere: mockSyncAll,
}));
// The model path is a facade re-exporting the service; mock both so the
// assertions hold whichever module the route imports.
jest.mock("@/models/authorization/contextGrants", () => ({
  syncAllContextGrantsEverywhere: mockSyncAll,
}));

const { requireAuthorization } = require("@/lib/authorization");
const { resolveAuthorizationContext } = require("@/models/authorization/resolver");
const { getContactContexts } = require("@/models/authorization/contactContexts");
const { getContactByCid } = require("@/models/responsibilities");
const userContextRoute = require("@/app/api/engineering/permissions/user-context/route");
const syncRoute = require("@/app/api/engineering/permissions/sync-context-grants/route");

const fullContext = () => ({
  role: "staff",
  isSuperAdmin: false,
  profile: { id: 3, name: "Staff Default" },
  groups: ["TEAM A"],
  eligibility: { crm: true },
  baseCaps: { crm: { view: 2 } },
  groupCaps: { lms: { view: 1 } },
  grants: { crm: { edit: 1 } },
  restrictions: new Set(["finance.export"]),
  effective: { crm: { view: 2, edit: 1 } },
});

beforeEach(() => {
  mockState.contact = { cid: "C1", role: "staff", group_name: "TEAM A", email: "a@x.io" };
  mockState.context = fullContext();
  mockState.contactContexts = { contexts: [], unavailable: [] };
  mockState.contactContextsThrows = false;
  mockState.sweepReport = { success: true, evaluated: 3, applied: 1, revoked: 0, changes: [] };
  mockState.syncThrows = false;
  mockAuthzDecision = null;
  mockOriginDecision = null;
  jest.clearAllMocks();
});

const ctxReq = (query = "") =>
  new Request(`http://localhost/api/engineering/permissions/user-context${query}`);

describe("user-context — the cid gate", () => {
  test("requires permissions.view_matrix", async () => {
    const res = await userContextRoute.GET(ctxReq("?cid=C1"));
    expect(res.status).toBe(200);
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  });

  test("a missing cid is a 400 and reads nothing", async () => {
    const res = await userContextRoute.GET(ctxReq());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("cid is required");
    expect(getContactByCid).not.toHaveBeenCalled();
  });

  test("a whitespace-only cid is a 400, not a lookup for ' '", async () => {
    const res = await userContextRoute.GET(ctxReq("?cid=%20%20"));
    expect(res.status).toBe(400);
    expect(getContactByCid).not.toHaveBeenCalled();
  });

  test("an unknown contact is a 404, not an empty 200", async () => {
    mockState.contact = null;
    const res = await userContextRoute.GET(ctxReq("?cid=GHOST"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Contact not found");
    // Crucially: no resolver call, so an unknown person is never reported as
    // an empty-but-valid context.
    expect(resolveAuthorizationContext).not.toHaveBeenCalled();
  });

  test("a denied read short-circuits before the contact lookup", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false }), { status: 403 });
    const res = await userContextRoute.GET(ctxReq("?cid=C1"));
    expect(res.status).toBe(403);
    expect(getContactByCid).not.toHaveBeenCalled();
  });
});

describe("user-context — the projection is the resolver's, unchanged", () => {
  test("the resolver is fed the CONTACT's role and group, not the query's", async () => {
    mockState.contact = { cid: "C1", role: "founder", group_name: "VENTURE X", email: "a@x.io" };
    await userContextRoute.GET(ctxReq("?cid=C1"));
    expect(resolveAuthorizationContext).toHaveBeenCalledWith({
      cid: "C1",
      role: "founder",
      group_name: "VENTURE X",
    });
  });

  test("a contact with no role/group feeds nulls, not undefined keys", async () => {
    mockState.contact = { cid: "C1", role: null, group_name: null, email: null };
    await userContextRoute.GET(ctxReq("?cid=C1"));
    expect(resolveAuthorizationContext).toHaveBeenCalledWith({
      cid: "C1",
      role: null,
      group_name: null,
    });
  });

  test("the five source columns map onto the resolver's own inputs", async () => {
    const body = await (await userContextRoute.GET(ctxReq("?cid=C1"))).json();
    // Profile | Group | Grant | Restriction | Effective
    expect(body.sources).toEqual({
      profile: { crm: { view: 2 } },
      groups: { lms: { view: 1 } },
      grants: { crm: { edit: 1 } },
      restrictions: { finance: { "finance.export": true } },
    });
    expect(body.effective).toEqual({ crm: { view: 2, edit: 1 } });
  });

  test("the scalar projections ride through as-is", async () => {
    const body = await (await userContextRoute.GET(ctxReq("?cid=C1"))).json();
    expect(body).toMatchObject({
      success: true,
      cid: "C1",
      role: "staff",
      isSuperAdmin: false,
      profile: { id: 3, name: "Staff Default" },
      groups: ["TEAM A"],
      eligibility: { crm: true },
    });
  });

  test("restrictions go through restrictionsToJson, never a raw Set", async () => {
    await userContextRoute.GET(ctxReq("?cid=C1"));
    const { restrictionsToJson } = require("@/services/authorization/context");
    expect(restrictionsToJson).toHaveBeenCalledWith(new Set(["finance.export"]));
  });

  test("contexts and their availability ride alongside, fail-soft per kind", async () => {
    mockState.contactContexts = {
      contexts: [{ kind: "venture", roleKey: "founder", label: "Venture X" }],
      unavailable: ["lms"],
    };
    const body = await (await userContextRoute.GET(ctxReq("?cid=C1"))).json();
    expect(body.contexts).toEqual([
      { kind: "venture", roleKey: "founder", label: "Venture X" },
    ]);
    // The UI needs to know a lookup FAILED: flattening it into "no
    // memberships" would be a lie.
    expect(body.contextsUnavailable).toEqual(["lms"]);
    expect(getContactContexts).toHaveBeenCalledWith("C1", { email: "a@x.io" });
  });

  test("the scope block is a fixed note, never a second verdict", async () => {
    const body = await (await userContextRoute.GET(ctxReq("?cid=C1"))).json();
    expect(body.scope).toEqual({
      engine: "implemented",
      note: "venture_own · program_assigned · learning_own (team_own pending)",
    });
  });

  test("a contexts read that THROWS is a 500, not a silent empty list", async () => {
    // The model's own per-kind failure is reported through `unavailable`, and
    // it does not throw; an outright throw is a different failure and reaches
    // the catch. Pinned so the fail-soft contract is not over-read.
    mockState.contactContextsThrows = true;
    const res = await userContextRoute.GET(ctxReq("?cid=C1"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("context read exploded");
  });

  test("a failing resolver is a 500 carrying the message", async () => {
    resolveAuthorizationContext.mockRejectedValueOnce(new Error("resolver down"));
    const res = await userContextRoute.GET(ctxReq("?cid=C1"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("resolver down");
  });
});

describe("sync-context-grants — the reconcile endpoint", () => {
  const syncReq = () =>
    new Request("http://localhost/api/engineering/permissions/sync-context-grants", {
      headers: { origin: "http://localhost" },
    });

  test("is same-origin gated BEFORE the permission gate", async () => {
    mockOriginDecision = new Response(JSON.stringify({ success: false }), { status: 403 });
    const res = await syncRoute.GET(syncReq());
    expect(res.status).toBe(403);
    expect(requireAuthorization).not.toHaveBeenCalled();
    // A cross-site reconcile must not run at all.
    expect(mockSyncAll).not.toHaveBeenCalled();
  });

  test("requires permissions.view_matrix", async () => {
    await syncRoute.GET(syncReq());
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
    expect(mockSyncAll).toHaveBeenCalledTimes(1);
  });

  test("the reconcile report is returned verbatim", async () => {
    const res = await syncRoute.GET(syncReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockState.sweepReport);
  });

  test("a failing reconcile is a 500, not a partial success", async () => {
    mockState.syncThrows = true;
    const res = await syncRoute.GET(syncReq());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("reconcile exploded");
  });

  test("this endpoint is a GET that WRITES — idempotent by design", async () => {
    // Re-running must be safe; that is what makes it a GET at all.
    await syncRoute.GET(syncReq());
    await syncRoute.GET(syncReq());
    expect(mockSyncAll).toHaveBeenCalledTimes(2);
  });
});

describe("context-grants-sweep — the shared-secret guard", () => {
  // The secret is read into a module-level constant at import time, so each
  // case needs a fresh module registry with its own env.
  const loadSweepRoute = async (env) => {
    const previous = process.env.CONTEXT_GRANTS_SECRET_KEY;
    if (env === null) delete process.env.CONTEXT_GRANTS_SECRET_KEY;
    else process.env.CONTEXT_GRANTS_SECRET_KEY = env;
    jest.resetModules();
    const route = require("@/app/api/engineering/permissions/context-grants-sweep/route");
    const restore = () => {
      if (previous === undefined) delete process.env.CONTEXT_GRANTS_SECRET_KEY;
      else process.env.CONTEXT_GRANTS_SECRET_KEY = previous;
    };
    return { route, restore };
  };

  const postReq = ({ header, query } = {}) => {
    const headers = {};
    if (header !== undefined) headers["x-cron-secret"] = header;
    const url = `http://localhost/api/engineering/permissions/context-grants-sweep${query ? `?key=${query}` : ""}`;
    return new Request(url, { method: "POST", headers });
  };

  test("an UNCONFIGURED deployment is a 503, never an open write path", async () => {
    const { route, restore } = await loadSweepRoute(null);
    const res = await route.POST(postReq({ header: "anything" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Service not configured.");
    // The decisive part: it must NOT run the sweep.
    expect(mockSyncAll).not.toHaveBeenCalled();
    restore();
  });

  test("the header is preferred over the deprecated query parameter", async () => {
    const { route, restore } = await loadSweepRoute("s3cret");
    // Right header, wrong query → the header wins.
    const res = await route.POST(postReq({ header: "s3cret", query: "wrong" }));
    expect(res.status).toBe(200);
    restore();
  });

  test("a PRESENT-BUT-WRONG header is NOT rescued by a correct query parameter", async () => {
    const { route, restore } = await loadSweepRoute("s3cret");
    const res = await route.POST(postReq({ header: "wrong", query: "s3cret" }));
    // `header || query` short-circuits on any non-empty header, so a wrong
    // credential fails even when the deprecated query parameter carries the
    // right one. Pinned because it is the safer reading: an explicitly
    // presented wrong secret must not be rescued by a fallback.
    expect(res.status).toBe(403);
    expect(mockSyncAll).not.toHaveBeenCalled();
    restore();
  });

  test("a missing key is a 403 with the i18n key", async () => {
    const { route, restore } = await loadSweepRoute("s3cret");
    const res = await route.POST(postReq());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("errors.insufficientPermissions");
    expect(mockSyncAll).not.toHaveBeenCalled();
    restore();
  });

  test("a wrong key is a 403 and never runs the sweep", async () => {
    const { route, restore } = await loadSweepRoute("s3cret");
    const res = await route.POST(postReq({ header: "nope" }));
    expect(res.status).toBe(403);
    expect(mockSyncAll).not.toHaveBeenCalled();
    restore();
  });

  test("an empty header falls through to the query parameter", async () => {
    const { route, restore } = await loadSweepRoute("s3cret");
    const res = await route.POST(postReq({ header: "", query: "s3cret" }));
    expect(res.status).toBe(200);
    restore();
  });

  test("the authorized sweep returns the reconcile report verbatim", async () => {
    const { route, restore } = await loadSweepRoute("s3cret");
    const res = await route.POST(postReq({ header: "s3cret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockState.sweepReport);
    restore();
  });

  test("a failing sweep is a 500, not a silent success", async () => {
    const { route, restore } = await loadSweepRoute("s3cret");
    mockState.syncThrows = true;
    const res = await route.POST(postReq({ header: "s3cret" }));
    expect(res.status).toBe(500);
    mockState.syncThrows = false;
    restore();
  });

  test("a key is never echoed back in the response or the report", async () => {
    const { route, restore } = await loadSweepRoute("s3cret");
    const res = await route.POST(postReq({ header: "s3cret" }));
    expect(JSON.stringify(await res.json())).not.toContain("s3cret");
    restore();
  });
});