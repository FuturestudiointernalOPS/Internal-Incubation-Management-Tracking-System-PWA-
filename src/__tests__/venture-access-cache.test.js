/**
 * The Venture's access facts are asked ONCE and shared by every screen.
 *
 * The legacy membership gate (`requireVentureAccess`) is gone — Lot 5 moved
 * every route onto `requireVentureScopedAccess`. What remains, and what this
 * suite now pins, is the shared FACT layer both gates read:
 *
 *   • the Venture's own facts (its code, its lifecycle);
 *   • the viewer's relationship to it (member? delegated staff?).
 *
 * The guarantees are unchanged:
 *   • a second screen asking the same thing within the window costs NOTHING;
 *   • screens loading in parallel share one query instead of racing their own;
 *   • a failure is never remembered, and never becomes a granted access;
 *   • a removal is not remembered either — the window is a backstop, not a wait;
 *   • the window does expire, so the answer cannot go stale for long.
 */

const queries = [];

const state = {
  venture: { id: "internal-1", code: "VNT-1", status: "active", is_archived: false },
  isMember: true,
  isAssigned: false,
  failVentureRead: false,
  relationshipUnavailable: false,
};

const mockDb = {
  execute: jest.fn(async (query) => {
    const sql = typeof query === "string" ? query : query.sql || "";
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

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "USR-founder", role: "participant" }),
}));

const { resolveVentureLifecycle, hasActiveVentureAssignment } = require("@/lib/ventureAuth");
const {
  getVentureFacts,
  getViewerRelationship,
  invalidateVentureAccess,
  resetVentureAccessCache,
} = require("@/services/ventures/accessFacts");

const CODE = "VNT-1";
const INTERNAL = "internal-1";
const VIEWER = "USR-founder";

beforeEach(() => {
  resetVentureAccessCache();
  queries.length = 0;
  mockDb.execute.mockClear();
  state.venture = { id: INTERNAL, code: CODE, status: "active", is_archived: false };
  state.isMember = true;
  state.isAssigned = false;
  state.failVentureRead = false;
  state.relationshipUnavailable = false;
  delete process.env.VENTURE_ACCESS_CACHE_TTL_MS;
});

describe("one answer, every screen", () => {
  test("the first pair costs two round trips, the screens after it cost none", async () => {
    await getVentureFacts(CODE);
    await getViewerRelationship(CODE, VIEWER);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);

    await getVentureFacts(CODE);
    await getViewerRelationship(CODE, VIEWER);
    await getVentureFacts(CODE);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  test("screens that load in parallel share one query instead of racing their own", async () => {
    await Promise.all([
      getVentureFacts(CODE),
      getVentureFacts(CODE),
      getVentureFacts(CODE),
      getViewerRelationship(CODE, VIEWER),
      getViewerRelationship(CODE, VIEWER),
    ]);

    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  test("what one surface learned about the Venture serves the lifecycle gate too", async () => {
    const lifecycle = await resolveVentureLifecycle(CODE);
    expect(lifecycle).toEqual({ status: "active", is_archived: false });
    expect(mockDb.execute).toHaveBeenCalledTimes(1);

    // The lifecycle already resolved the code: the relationship only has to ask
    // about the viewer.
    await getViewerRelationship(CODE, VIEWER);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  test("an internal id reaches the same answer as the human code", async () => {
    const uuid = "2b7feb6c-763a-48e1-84a0-d768cd4abfbf";
    state.venture = { id: uuid, code: CODE, status: "active", is_archived: false };

    const relationship = await getViewerRelationship(uuid, VIEWER);
    expect(relationship.is_member).toBe(true);
    expect(queries[0]).toContain("WHERE id = ?");

    // The relationship is looked up under the INTERNAL id (Phase 0) — the id the
    // membership and assignment tables key on, read off the Venture's own row.
    expect(queries[1]).toContain("FROM venture_members");
    expect(mockDb.execute.mock.calls[1][0].args.slice(0, 2)).toEqual([uuid, VIEWER]);
  });
});

describe("who gets in", () => {
  test("a member is admitted, a stranger is not", async () => {
    expect((await getViewerRelationship(CODE, VIEWER)).is_member).toBe(true);

    state.isMember = false;
    state.isAssigned = false;
    // A removal invalidates the cached answer, exactly like the roster write.
    invalidateVentureAccess(CODE);
    const relationship = await getViewerRelationship(CODE, VIEWER);
    expect(relationship.is_member).toBe(false);
    expect(relationship.is_assigned).toBe(false);
  });

  test("a delegated staff assignment is enough for the staff-actor rule", async () => {
    state.isMember = false;
    state.isAssigned = true;
    expect(await hasActiveVentureAssignment(CODE, VIEWER)).toBe(true);
  });

  test("an unknown Venture grants nothing", async () => {
    state.venture = null;
    expect(await getVentureFacts(CODE)).toBeNull();
    const relationship = await getViewerRelationship(CODE, VIEWER);
    expect(relationship.is_member).toBe(false);
    expect(relationship.is_assigned).toBe(false);
  });
});

describe("a failure is never an answer", () => {
  test("a dropped connection is not remembered", async () => {
    state.failVentureRead = true;
    await expect(getVentureFacts(CODE)).rejects.toThrow();

    // Recovered: the very next read re-asks instead of replaying the failure.
    state.failVentureRead = false;
    expect(await getVentureFacts(CODE)).toBeTruthy();
  });

  test("a relationship the database cannot answer denies rather than admits", async () => {
    state.relationshipUnavailable = true;
    const relationship = await getViewerRelationship(CODE, VIEWER);
    expect(relationship.is_member).toBe(false);
    expect(relationship.is_assigned).toBe(false);
  });
});

describe("the window", () => {
  test("expires, so a stale answer cannot outlive it", async () => {
    process.env.VENTURE_ACCESS_CACHE_TTL_MS = "1";
    await getVentureFacts(CODE);
    expect(mockDb.execute).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await getVentureFacts(CODE);
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  test("a removal drops the answer immediately, well inside the window", async () => {
    expect((await getViewerRelationship(CODE, VIEWER)).is_member).toBe(true);

    // The person is removed from the roster.
    state.isMember = false;
    invalidateVentureAccess(CODE);

    expect((await getViewerRelationship(CODE, VIEWER)).is_member).toBe(false);
  });
});
