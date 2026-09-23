/**
 * Contract tests — getCalendarVentureSessions (Vinance 3, Phase 3).
 *
 * Locks the visibility contract of the personal-calendar Venture session
 * source in src/models/workspace.js:
 *
 *   1. one scope query: venture_members (contact_id OR user_cid, not removed)
 *      UNION venture_staff_assignments (staff_contact_id, active) — user id
 *      passed three times
 *   2. scope codes expanded to internal ids, only when the scope is non-empty
 *   3. sessions = own coach sessions OR venture-facing sessions of the scope,
 *      never cancelled/no-show, always with a start_time
 *   4. no scope → "__no_venture_scope__" sentinel (coach leg still works, the
 *      IN list can never match a real venture)
 *   5. falsy userId → { rows: [] } with no query at all
 *
 * The db double records every { sql, args } pair, so assertions run against
 * the exact query text/args the model would send.
 */

const executed = [];

const mockRows = { scope: [], expanded: [], sessions: [] };

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("FROM venture_members")) return { rows: mockRows.scope };
    if (sql.includes("FROM ventures WHERE venture_id IN")) return { rows: mockRows.expanded };
    if (sql.includes("FROM venture_sessions")) return { rows: mockRows.sessions };
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

const USER_ID = "user-1";
const MEMBER_VENTURE = "VNT-ALPHA";
const STAFF_VENTURE = "VNT-BETA";
const MEMBER_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SENTINEL = "__no_venture_scope__";

const { getCalendarVentureSessions } = require("@/models/workspace");

const scopeQuery = () => executed.find((query) => query.sql.includes("FROM venture_members"));
const expansionQuery = () => executed.find((query) => query.sql.includes("FROM ventures WHERE venture_id IN"));
const sessionsQuery = () => executed.find((query) => query.sql.includes("FROM venture_sessions"));
const placeholders = (sql) => (sql.match(/\?/g) || []).length;
const flatten = (sql) => sql.replace(/\s+/g, " ").trim();

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
  mockRows.scope = [];
  mockRows.expanded = [];
  mockRows.sessions = [];
});

describe("getCalendarVentureSessions — visibility contract", () => {
  test("falsy userId returns an empty result without touching the db", async () => {
    for (const userId of [null, undefined, ""]) {
      const res = await getCalendarVentureSessions(userId);
      expect(res).toEqual({ rows: [] });
    }
    expect(executed).toHaveLength(0);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  test("the scope query receives the user id three times and the sessions query leads with it", async () => {
    mockRows.scope = [{ venture_id: MEMBER_VENTURE }];
    mockRows.expanded = [{ id: MEMBER_UUID }];
    mockRows.sessions = [{ id: 7, title: "Kickoff", status: "scheduled" }];

    const res = await getCalendarVentureSessions(USER_ID);
    expect(res.rows).toEqual(mockRows.sessions);

    const scope = scopeQuery();
    expect(scope).toBeDefined();
    expect(scope.args).toEqual([USER_ID, USER_ID, USER_ID]);
    expect(scope.sql).toContain("FROM venture_members");
    expect(scope.sql).toContain("FROM venture_staff_assignments");
    expect(scope.sql).toContain("UNION");
    expect(scope.sql).toContain("contact_id = ?");
    expect(scope.sql).toContain("user_cid = ?");
    expect(scope.sql).toContain("staff_contact_id = ?");
    expect(scope.sql).toContain("removed_at IS NULL");
    expect(flatten(scope.sql)).toContain("status = 'active'");

    expect(sessionsQuery().args[0]).toBe(USER_ID);
  });

  test("member + staff scope resolves both key styles with no duplicates", async () => {
    mockRows.scope = [
      { venture_id: MEMBER_VENTURE },
      { venture_id: MEMBER_VENTURE },
      { venture_id: STAFF_VENTURE },
    ];
    mockRows.expanded = [{ id: MEMBER_UUID }, { id: MEMBER_UUID }];
    mockRows.sessions = [{ id: 1, title: "Review", status: "scheduled" }];

    await getCalendarVentureSessions(USER_ID);

    const expansion = expansionQuery();
    expect(expansion).toBeDefined();
    expect(expansion.args).toEqual(expect.arrayContaining([MEMBER_VENTURE, STAFF_VENTURE]));
    expect(placeholders(expansion.sql)).toBe(expansion.args.length);

    const inList = sessionsQuery().args.slice(1);
    expect(inList).toEqual(expect.arrayContaining([MEMBER_VENTURE, STAFF_VENTURE, MEMBER_UUID]));
    expect(inList).toHaveLength(3);
    expect(new Set(inList).size).toBe(inList.length);
  });

  test("the sessions query drops cancelled/no-show rows and requires a start time", async () => {
    mockRows.sessions = [{ id: 1, title: "Done", status: "completed" }];

    const res = await getCalendarVentureSessions(USER_ID);

    const sessions = sessionsQuery();
    expect(flatten(sessions.sql)).toMatch(/start_time IS NOT NULL/);
    expect(flatten(sessions.sql)).toMatch(/status NOT IN \('cancelled', 'no_show'\)/);
    expect(placeholders(sessions.sql)).toBe(sessions.args.length);
    expect(res.rows).toEqual(mockRows.sessions);
  });

  test("the sessions query keeps the coach leg and the venture_facing guard", async () => {
    mockRows.scope = [{ venture_id: MEMBER_VENTURE }];
    mockRows.expanded = [{ id: MEMBER_UUID }];

    await getCalendarVentureSessions(USER_ID);

    const flat = flatten(sessionsQuery().sql);
    expect(flat).toContain("coach_contact_id = ?");
    expect(flat).toContain("venture_facing = TRUE");
    // The IN list only ever widens the venture-facing leg — the coach leg is
    // compared to the user id itself, never to a venture scope value.
    expect(flat).toContain(
      "WHERE start_time IS NOT NULL AND status NOT IN ('cancelled', 'no_show') AND (coach_contact_id = ? OR (venture_facing = TRUE AND venture_id IN (",
    );
    expect(sessionsQuery().args[0]).toBe(USER_ID);
  });

  test("empty scope falls back to the sentinel and still keeps the coach leg", async () => {
    mockRows.scope = [];
    mockRows.expanded = [];

    const res = await getCalendarVentureSessions(USER_ID);

    expect(res).toEqual({ rows: [] });
    expect(expansionQuery()).toBeUndefined();
    expect(executed).toHaveLength(2);

    const sessions = sessionsQuery();
    expect(sessions.args).toEqual([USER_ID, SENTINEL]);
    expect(flatten(sessions.sql)).toContain("coach_contact_id = ?");
    expect(placeholders(sessions.sql)).toBe(2);
  });
});
