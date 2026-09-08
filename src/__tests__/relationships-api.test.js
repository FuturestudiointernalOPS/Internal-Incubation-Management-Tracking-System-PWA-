/**
 * Integration tests for GET /api/me/relationships
 * (src/app/api/me/relationships/route.js).
 *
 * Pins the current behavior of the endpoint that drives the personal
 * sidebar: isProgramParticipant detection (participant_programs OR
 * v2_participants), venture membership listing, and the neutral-role
 * backfill trigger. db is mocked with SQL-substring matching, so the
 * Wave-3 model extraction is verified as long as SQL stays identical.
 */

const executedQueries = [];

// Default in-memory behaviour; individual tests can swap it via mockExecute and
// restore it afterwards.
const defaultImpl = async ({ sql, args }) => {
  executedQueries.push({ sql, args });
  if (sql.includes("FROM participant_programs WHERE participant_id = ?")) {
    // No participant_programs row → falls through to v2_participants
    return { rows: [] };
  }
  if (sql.includes("FROM v2_participants WHERE user_id = ?")) {
    return { rows: [{ id: "p-1" }] };
  }
  if (sql.includes("FROM venture_members vm")) {
    return {
      rows: [
        {
          venture_id: "VNT-1",
          name: "Acme",
          status: "active",
        },
      ],
    };
  }
  return { rows: [] };
};

const mockExecute = jest.fn(defaultImpl);

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockExecute },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn().mockResolvedValue({
    cid: "user-1",
    name: "User One",
    role: "participant",
  }),
}));

const mockBackfill = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/contactIdentity", () => ({
  backfillNeutralParticipantRoles: (...args) => mockBackfill(...args),
}));

const { GET } = require("@/app/api/me/relationships/route");

const readJson = async (res) => res.json();

beforeEach(() => {
  executedQueries.length = 0;
  mockBackfill.mockClear();
});

describe("GET /api/me/relationships", () => {
  test("detects program participation and lists ventures", async () => {
    const res = await GET(new Request("http://localhost/api/me/relationships"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.isProgramParticipant).toBe(true);
    expect(data.isVentureMember).toBe(true);
    expect(data.ventures).toEqual([
      { venture_id: "VNT-1", name: "Acme", status: "active" },
    ]);

    // participant_programs checked first, then v2_participants fallback
    expect(executedQueries[0].sql).toContain(
      "SELECT 1 FROM participant_programs WHERE participant_id = ? LIMIT 1",
    );
    expect(executedQueries[0].args).toEqual(["user-1"]);
    expect(executedQueries[1].sql).toContain("FROM v2_participants");
    expect(executedQueries[1].args).toEqual(["user-1", "user-1"]);

    // Ventures query scoped to the session cid, excludes removed memberships
    const ventureQuery = executedQueries.find((q) =>
      q.sql.includes("FROM venture_members vm"),
    );
    expect(ventureQuery.sql).toContain("vm.contact_id = ?");
    expect(ventureQuery.sql).toContain("vm.removed_at IS NULL");
    expect(ventureQuery.args).toEqual(["user-1"]);

    // Neutral-role backfill is triggered on every call
    expect(mockBackfill).toHaveBeenCalled();
  });

  test("isProgramParticipant stays false when neither table matches", async () => {
    const emptyImpl = async ({ sql }) => {
      if (sql.includes("FROM participant_programs")) return { rows: [] };
      if (sql.includes("FROM v2_participants")) return { rows: [] };
      if (sql.includes("FROM venture_members vm")) return { rows: [] };
      return { rows: [] };
    };
    mockExecute.mockImplementation(emptyImpl);
    try {
      const res = await GET(new Request("http://localhost/api/me/relationships"));
      const data = await readJson(res);
      expect(data.isProgramParticipant).toBe(false);
      expect(data.isVentureMember).toBe(false);
      expect(data.ventures).toEqual([]);
    } finally {
      mockExecute.mockImplementation(defaultImpl);
    }
  });

  test("returns 401 when there is no session", async () => {
    const authMock = require("@/lib/auth");
    authMock.getSession.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/api/me/relationships"));
    expect(res.status).toBe(401);
    const data = await readJson(res);
    expect(data.success).toBe(false);
  });
});
