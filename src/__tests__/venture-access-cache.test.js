/**
 * The Venture access answer is asked ONCE and shared by every screen.
 *
 * A round trip to the database costs ~185 ms on the current link, and the
 * Venture workspace asks the same two questions from each of its surfaces: the
 * Venture's own facts (its code, its lifecycle) and the viewer's relationship to
 * it. These tests pin what the sharing has to guarantee:
 *
 *   • a second screen asking the same thing within the window costs NOTHING;
 *   • screens loading in parallel share one query instead of racing their own;
 *   • a failure is never remembered, and never becomes a granted access;
 *   • a removal is not remembered either — the window is a backstop, not a wait;
 *   • the window does expire, so the answer cannot go stale for long.
 */

const queries = [];

const state = {
  venture: { code: "VNT-1", status: "active", is_archived: false },
  isMember: true,
  isAssigned: false,
  failVentureRead: false,
  relationshipUnavailable: false,
};

const mockDb = {
  execute: jest.fn(async ({ sql }) => {
    queries.push(sql);
    if (sql.includes("FROM ventures")) {
      if (state.failVentureRead) throw new Error("read ETIMEDOUT");
      return { rows: state.venture ? [state.venture] : [] };
    }
    if (sql.includes("FROM venture_members")) {
      if (state.relationshipUnavailable) return { rows: [] };
      return { rows: [{ is_member: state.isMember, is_assigned: state.isAssigned }] };
    }
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "USR-founder", role: "participant" }),
}));

const { requireVentureAccess, resolveVentureLifecycle } = require("@/lib/ventureAuth");
const { invalidateVentureAccess, resetVentureAccessCache } = require("@/lib/ventureAccessFacts");

const db = require("@/lib/db").default;

const CODE = "VNT-1";
const ACCESS_SQL = (sql) => sql.includes("FROM ventures") || sql.includes("FROM venture_members");

beforeEach(() => {
  resetVentureAccessCache();
  queries.length = 0;
  mockDb.execute.mockClear();
  state.venture = { code: CODE, status: "active", is_archived: false };
  state.isMember = true;
  state.isAssigned = false;
  state.failVentureRead = false;
  state.relationshipUnavailable = false;
  delete process.env.VENTURE_ACCESS_CACHE_TTL_MS;
});

describe("one answer, every screen", () => {
  test("the first check costs two round trips, the screens after it cost none", async () => {
    const first = await requireVentureAccess(CODE, db);
    expect(first.session).toBeTruthy();
    // The Venture's facts, then the viewer's relationship: the two questions a
    // screen cannot answer locally.
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
    expect(queries.every(ACCESS_SQL)).toBe(true);

    await requireVentureAccess(CODE, db);
    await requireVentureAccess(CODE, db);
    await requireVentureAccess(CODE, db);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  test("screens that load in parallel share one query instead of racing their own", async () => {
    const results = await Promise.all([
      requireVentureAccess(CODE, db),
      requireVentureAccess(CODE, db),
      requireVentureAccess(CODE, db),
    ]);

    expect(mockDb.execute).toHaveBeenCalledTimes(2);
    expect(results.every((result) => result.session)).toBe(true);
  });

  test("what one surface learned about the Venture serves the lifecycle gate too", async () => {
    const lifecycle = await resolveVentureLifecycle(CODE, db);
    expect(lifecycle).toEqual({ status: "active", is_archived: false });
    expect(mockDb.execute).toHaveBeenCalledTimes(1);

    // The lifecycle already resolved the code: the access check only has to ask
    // about the viewer.
    await requireVentureAccess(CODE, db);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  test("an internal id reaches the same answer as the human code", async () => {
    const uuid = "2b7feb6c-763a-48e1-84a0-d768cd4abfbf";
    state.venture = { code: CODE, status: "active", is_archived: false };

    const result = await requireVentureAccess(uuid, db);
    expect(result.session).toBeTruthy();
    expect(queries[0]).toContain("WHERE id = ?");

    // And the relationship was looked up under the CODE the Venture resolved to.
    expect(queries[1]).toContain("FROM venture_members");
    expect(mockDb.execute.mock.calls[1][0].args.slice(0, 2)).toEqual([CODE, "USR-founder"]);
  });
});

describe("who gets in", () => {
  test("a member is admitted, a stranger is turned away", async () => {
    expect((await requireVentureAccess(CODE, db)).session).toBeTruthy();

    resetVentureAccessCache();
    state.isMember = false;
    state.isAssigned = false;
    expect((await requireVentureAccess(CODE, db)).session).toBeNull();
  });

  test("a delegated staff assignment is enough", async () => {
    state.isMember = false;
    state.isAssigned = true;
    expect((await requireVentureAccess(CODE, db)).session).toBeTruthy();
  });

  test("an unknown Venture grants nothing", async () => {
    state.venture = null;
    expect((await requireVentureAccess(CODE, db)).session).toBeNull();
  });
});

describe("a failure is never an answer", () => {
  test("a dropped connection is not remembered, and never admits anyone", async () => {
    state.failVentureRead = true;
    await expect(requireVentureAccess(CODE, db)).rejects.toThrow();

    // Recovered: the very next check re-asks instead of replaying the failure.
    state.failVentureRead = false;
    expect((await requireVentureAccess(CODE, db)).session).toBeTruthy();
  });

  test("a relationship the database cannot answer denies rather than admits", async () => {
    state.relationshipUnavailable = true;
    expect((await requireVentureAccess(CODE, db)).session).toBeNull();
  });
});

describe("the window", () => {
  test("expires, so a stale answer cannot outlive it", async () => {
    process.env.VENTURE_ACCESS_CACHE_TTL_MS = "1";
    await requireVentureAccess(CODE, db);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await requireVentureAccess(CODE, db);
    expect(mockDb.execute).toHaveBeenCalledTimes(4);
  });

  test("a removal drops the answer immediately, well inside the window", async () => {
    expect((await requireVentureAccess(CODE, db)).session).toBeTruthy();

    // The person is removed from the roster.
    state.isMember = false;
    invalidateVentureAccess(CODE);

    expect((await requireVentureAccess(CODE, db)).session).toBeNull();
  });
});
