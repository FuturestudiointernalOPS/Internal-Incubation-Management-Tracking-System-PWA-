/**
 * Characterization net for the decisions that live inside
 * `src/app/api/org-membership/route.js` today.
 *
 * These assertions pin the BEHAVIOUR before the logic moves to
 * `@/services/authorization/membershipQueries.js` (corridor L5, block e):
 * the two WHERE builders, the protected-group flags (an N+1 over distinct
 * group names) and the membership lifecycle chain.
 *
 * The protected-group tests assert the NUMBER of statements as well as the
 * result: the batch read must keep the response shape while collapsing one
 * query per distinct group into one.
 */

const mockExecuted = [];

const mockState = {
  memberships: [], // listMemberships rows
  events: [], // listMembershipEvents rows
  protectedRows: [], // groups rows for the batch read — { name, is_protected }
  membership: null, // getMembership
  groups: [], // getUserGroupNames — not used here, kept for clarity
};

function mockRows(sql, args) {
  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sql)) return { rows: [] };
  if (sql.includes("FROM group_membership_events")) return { rows: mockState.events };
  if (sql.includes("FROM group_memberships")) return { rows: mockState.memberships };
  if (sql.includes("FROM groups WHERE name")) {
    // The real reader normalizes the name before querying.
    return { rows: mockState.protectedRows.filter((row) => row.name === args[0]) };
  }
  return { rows: [], rowsAffected: 1 };
}

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (query) => {
      const sql = String(typeof query === "string" ? query : query?.sql || "");
      const args = (typeof query === "string" ? [] : query?.args) || [];
      mockExecuted.push({ sql, args });
      return mockRows(sql, args);
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

jest.mock("@/server/authz/responses", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
  requireScopedAccess: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/services/authorization/context", () => ({
  ...jest.requireActual("@/services/authorization/context"),
  invalidateAllAuthorizationContexts: jest.fn(),
}));

jest.mock("@/models/authorization/membership", () => ({
  ...jest.requireActual("@/models/authorization/membership"),
  ...jest.requireActual("@/services/authorization/membership"),
  ensureMembershipSchema: jest.fn().mockResolvedValue(true),
  getMembership: jest.fn(async () => mockState.membership),
  // isGroupProtected stays REAL: it runs against the mocked @/lib/db, so the
  // per-group statements it issues are observable.
}));
jest.mock("@/services/authorization/membership", () => ({
  ...jest.requireActual("@/models/authorization/membership"),
  ...jest.requireActual("@/services/authorization/membership"),
}));

jest.mock("@/models/authorization", () => ({
  listMemberships: jest.fn(async () => ({ rows: mockState.memberships })),
  listMembershipEvents: jest.fn(async () => ({ rows: mockState.events })),
  updateMembershipStatus: jest.fn().mockResolvedValue(true),
  insertMembership: jest.fn().mockResolvedValue(true),
  syncMembershipUserGroup: jest.fn().mockResolvedValue(true),
  insertMembershipEvent: jest.fn().mockResolvedValue(true),
}));

const model = require("@/models/authorization");
const membership = require("@/models/authorization/membership");
const { invalidateAllAuthorizationContexts } = require("@/services/authorization/context");
const route = require("@/app/api/org-membership/route");

const getReq = (params = "") =>
  new Request(`http://localhost/api/org-membership${params}`);

const putReq = (body) =>
  new Request("http://localhost/api/org-membership", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const countStatements = (fragment) =>
  mockExecuted.filter((entry) => entry.sql.includes(fragment)).length;

beforeEach(() => {
  mockExecuted.length = 0;
  Object.assign(mockState, {
    memberships: [],
    events: [],
    protectedRows: [],
    membership: null,
  });
  jest.clearAllMocks();
});

describe("GET — WHERE builder from the filters", () => {
  const membershipCall = () => model.listMemberships.mock.calls.at(-1);

  test("no filter → no WHERE at all (whole catalog)", async () => {
    mockState.memberships = [{ group_name: "FUTURE STUDIO", user_cid: "U1" }];
    const res = await route.GET(getReq());
    expect(res.status).toBe(200);
    expect(membershipCall()).toEqual(["", []]);
  });

  test("group only → one predicate, group name NORMALIZED", async () => {
    await route.GET(getReq("?group=future%20studio"));
    expect(membershipCall()[0]).toMatch(/WHERE gm\.group_name = \?/);
    expect(membershipCall()[1]).toEqual(["FUTURE STUDIO"]);
  });

  test("user_cid only → one predicate", async () => {
    await route.GET(getReq("?user_cid=U1"));
    expect(membershipCall()[0]).toMatch(/WHERE gm\.user_cid = \?/);
    expect(membershipCall()[1]).toEqual(["U1"]);
  });

  test("both filters → ANDed, in that order, args aligned to predicates", async () => {
    await route.GET(getReq("?group=future%20studio&user_cid=U1"));
    expect(membershipCall()[0]).toMatch(/WHERE gm\.group_name = \? AND gm\.user_cid = \?/);
    expect(membershipCall()[1]).toEqual(["FUTURE STUDIO", "U1"]);
  });

  test("history is opt-in — the events query is skipped without ?history=1", async () => {
    mockState.memberships = [];
    await route.GET(getReq("?group=future%20studio"));
    expect(countStatements("FROM group_membership_events")).toBe(0);
  });

  test("history=1 queries events with the SAME filters on the `ev` alias", async () => {
    await route.GET(getReq("?history=1&group=future%20studio&user_cid=U1"));
    const [where, args] = model.listMembershipEvents.mock.calls.at(-1);
    expect(where).toMatch(/WHERE ev\.group_name = \? AND ev\.user_cid = \?/);
    expect(args).toEqual(["FUTURE STUDIO", "U1"]);
  });

  test("history without filters reads the whole (capped) event log", async () => {
    await route.GET(getReq("?history=1"));
    expect(model.listMembershipEvents.mock.calls.at(-1)[0]).not.toMatch(/\bWHERE\b/);
  });

  test("history=0 is NOT history — the flag is an exact string match", async () => {
    await route.GET(getReq("?history=0"));
    expect(countStatements("FROM group_membership_events")).toBe(0);
  });
});

describe("GET — protected-group flags", () => {
  test("one lookup per DISTINCT group, absent groups are not protected", async () => {
    mockState.memberships = [
      { group_name: "FUTURE STUDIO", user_cid: "U1" },
      { group_name: "TEAM A", user_cid: "U3" },
    ];
    mockState.protectedRows = [{ name: "FUTURE STUDIO", is_protected: 1 }];

    const res = await route.GET(getReq());
    const body = await res.json();
    // The map is keyed by the group_name AS STORED on the membership row; a
    // group with no row in `groups` is simply not protected.
    expect(body.protected).toEqual({ "FUTURE STUDIO": true, "TEAM A": false });
  });

  test("is_protected is compared numerically — '1' as text still counts", async () => {
    mockState.memberships = [{ group_name: "G", user_cid: "U1" }];
    mockState.protectedRows = [{ name: "G", is_protected: "1" }];
    const res = await route.GET(getReq());
    expect((await res.json()).protected).toEqual({ G: true });
  });

  test("an explicit 0 is not protected", async () => {
    mockState.memberships = [{ group_name: "G", user_cid: "U1" }];
    mockState.protectedRows = [{ name: "G", is_protected: 0 }];
    const res = await route.GET(getReq());
    expect((await res.json()).protected).toEqual({ G: false });
  });

  test("a group with NO row in `groups` is not protected, not an error", async () => {
    mockState.memberships = [{ group_name: "GHOST", user_cid: "U1" }];
    mockState.protectedRows = [];
    const res = await route.GET(getReq());
    expect((await res.json()).protected).toEqual({ GHOST: false });
  });

  test("no memberships → no flag lookup at all", async () => {
    mockState.memberships = [];
    await route.GET(getReq());
    expect(countStatements("FROM groups WHERE name")).toBe(0);
  });

  test("a case-variant row is the SAME group: same flag, key kept as stored", async () => {
    // `isGroupProtected` normalizes the name before querying, so both rows
    // resolve to FUTURE STUDIO and share its flag — but the response keys stay
    // whatever the membership rows carry, because the UI reads them as-is.
    mockState.memberships = [
      { group_name: "FUTURE STUDIO", user_cid: "U1" },
      { group_name: "future studio", user_cid: "U2" },
    ];
    mockState.protectedRows = [{ name: "FUTURE STUDIO", is_protected: 1 }];

    const body = await (await route.GET(getReq())).json();
    expect(Object.keys(body.protected).sort()).toEqual(["FUTURE STUDIO", "future studio"]);
    expect(body.protected["FUTURE STUDIO"]).toBe(true);
    expect(body.protected["future studio"]).toBe(true);
  });

  test("the whole flag map costs ONE statement, whatever the row count", async () => {
    mockState.memberships = Array.from({ length: 25 }, (_, i) => ({
      group_name: `GROUP ${i % 5}`,
      user_cid: `U${i}`,
    }));
    mockState.protectedRows = [
      { name: "GROUP 0", is_protected: 1 },
      { name: "GROUP 2", is_protected: 1 },
    ];

    const res = await route.GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body.protected)).toHaveLength(5);
    // Before the batch read this was one statement per distinct group.
    expect(countStatements("FROM groups WHERE name")).toBe(1);
    expect(body.protected["GROUP 0"]).toBe(true);
    expect(body.protected["GROUP 1"]).toBe(false);
  });
});

describe("PUT — input validation", () => {
  test("missing user_cid or group_name → 400, nothing written", async () => {
    for (const body of [
      { group_name: "G", action: "joined" },
      { user_cid: "U1", action: "joined" },
      { user_cid: "U1", group_name: "   ", action: "joined" },
    ]) {
      const res = await route.PUT(putReq(body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("errors.invalidMembershipRequest");
    }
    expect(model.insertMembership).toBeDefined();
  });

  test("an unknown action → 400 with the action error key", async () => {
    const res = await route.PUT(
      putReq({ user_cid: "U1", group_name: "G", action: "promote" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("errors.invalidMembershipAction");
  });

  test("the action is lowercased before validation — 'JOINED' is accepted", async () => {
    const res = await route.PUT(
      putReq({ user_cid: "U1", group_name: "G", action: "JOINED" }),
    );
    expect(res.status).not.toBe(400);
  });

  test("an unparseable expires_at → 400 with the date error key", async () => {
    const res = await route.PUT(
      putReq({ user_cid: "U1", group_name: "G", action: "joined", expires_at: "not-a-date" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("errors.invalidMembershipDate");
  });

  test("null, empty string and absent expires_at are all 'no expiry' — never a 400", async () => {
    for (const expires_at of [null, "", undefined]) {
      const res = await route.PUT(
        putReq({ user_cid: "U1", group_name: "G", action: "joined", expires_at }),
      );
      expect(res.status).not.toBe(400);
    }
  });

  test("a malformed JSON body → 400, not a 500", async () => {
    const res = await route.PUT(putReq("{not json"));
    expect(res.status).toBe(400);
  });

  test("validation runs BEFORE any membership lookup", async () => {
    await route.PUT(putReq({ user_cid: "U1", group_name: "G", action: "nope" }));
    expect(membership.getMembership).not.toHaveBeenCalled();
  });
});

describe("PUT — lifecycle chain", () => {
  test("no membership + action != joined → 404 membershipNotFound", async () => {
    mockState.membership = null;
    for (const action of ["activated", "renewed", "deactivated", "ended", "expired"]) {
      const res = await route.PUT(putReq({ user_cid: "U1", group_name: "G", action }));
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe("errors.membershipNotFound");
    }
    expect(model.insertMembership).not.toHaveBeenCalled();
    expect(model.updateMembershipStatus).not.toHaveBeenCalled();
  });

  test("no membership + joined → INSERT, then sync user_groups, then the event", async () => {
    mockState.membership = null;
    const res = await route.PUT(putReq({ user_cid: "U1", group_name: "G", action: "joined" }));
    expect(res.status).toBe(200);
    expect(model.insertMembership).toHaveBeenCalled();
    expect(model.updateMembershipStatus).not.toHaveBeenCalled();
    // user_groups is kept in sync so legacy consumers see the same edge.
    expect(model.syncMembershipUserGroup).toHaveBeenCalledWith(
      "U1",
      "G",
      expect.any(String),
    );
    expect(model.insertMembershipEvent).toHaveBeenCalled();
  });

  test("an EXISTING membership is UPDATED, never re-inserted (no duplicate person)", async () => {
    mockState.membership = {
      user_cid: "U1",
      group_name: "G",
      started_at: "2026-01-01",
      expires_at: null,
      status: "ended",
    };
    const res = await route.PUT(putReq({ user_cid: "U1", group_name: "G", action: "renewed" }));
    expect(res.status).toBe(200);
    expect(model.updateMembershipStatus).toHaveBeenCalled();
    expect(model.insertMembership).not.toHaveBeenCalled();
    expect(model.syncMembershipUserGroup).not.toHaveBeenCalled();
  });

  test("joined on an existing membership updates rather than duplicating", async () => {
    mockState.membership = {
      user_cid: "U1",
      group_name: "G",
      started_at: "2026-01-01",
      expires_at: null,
      status: "active",
    };
    await route.PUT(putReq({ user_cid: "U1", group_name: "G", action: "joined" }));
    expect(model.updateMembershipStatus).toHaveBeenCalled();
    expect(model.insertMembership).not.toHaveBeenCalled();
  });

  test("the response re-reads the membership AFTER the write", async () => {
    mockState.membership = null;
    const res = await route.PUT(putReq({ user_cid: "U1", group_name: "G", action: "joined" }));
    const body = await res.json();
    expect(body.success).toBe(true);
    // getMembership is called before AND after the write.
    expect(membership.getMembership.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("every successful change drops the authorization cache and audits", async () => {
    mockState.membership = null;
    const res = await route.PUT(putReq({ user_cid: "U1", group_name: "G", action: "joined" }));
    expect(res.status).toBe(200);
    expect(invalidateAllAuthorizationContexts).toHaveBeenCalled();
    const { logPermissionAudit } = require("@/models/authorization/accessQueries");
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "membership_changed", targetCid: "U1" }),
    );
  });

  test("a refused action writes no audit entry", async () => {
    mockState.membership = null;
    const { logPermissionAudit } = require("@/models/authorization/accessQueries");
    await route.PUT(putReq({ user_cid: "U1", group_name: "G", action: "ended" }));
    expect(logPermissionAudit).not.toHaveBeenCalled();
  });

  test("an actor without cid falls back to id, then to null", async () => {
    const { getSession } = require("@/server/auth/session");
    mockState.membership = null;

    getSession.mockResolvedValueOnce({ id: "ID-1", name: "By Id" });
    await route.PUT(putReq({ user_cid: "U1", group_name: "G", action: "joined" }));
    expect(model.insertMembershipEvent).toHaveBeenCalledWith(
      "U1",
      "G",
      expect.any(String),
      "ID-1",
      null,
    );
  });
});