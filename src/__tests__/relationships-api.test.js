/**
 * Integration tests for GET /api/me/relationships
 * (src/app/api/me/relationships/route.js).
 *
 * Pins the ONE participation rule that drives the personal sidebar, the
 * participant dashboard and the workspace hub: a modern membership row counts
 * whatever its lifecycle status (a completed seat stays open, read-only), the
 * older group/program links count when no modern row exists, and a program that
 * no longer exists grants nothing. db is mocked with SQL-substring matching.
 */

const executedQueries = [];

// Default in-memory behaviour; individual tests can swap it via mockExecute and
// restore it afterwards.
const defaultImpl = async ({ sql, args }) => {
  executedQueries.push({ sql, args });
  if (sql.includes("WITH contact AS")) {
    return {
      rows: [
        {
          program_id: "P-1",
          source: "membership",
          status: "active",
          program_name: "Alpha",
          program_exists: true,
          contact_email: "user1@example.com",
        },
      ],
    };
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

jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn().mockResolvedValue({
    cid: "user-1",
    name: "User One",
    email: "user1@example.com",
    role: "participant",
  }),
}));

const mockBackfill = jest.fn().mockResolvedValue(undefined);
jest.mock("@/models/contactIdentity", () => ({
  backfillNeutralParticipantRoles: (...args) => mockBackfill(...args),
}));

const { GET } = require("@/app/api/me/relationships/route");

const readJson = async (res) => res.json();

beforeEach(() => {
  executedQueries.length = 0;
  mockBackfill.mockClear();
});

describe("GET /api/me/relationships", () => {
  test("a modern membership makes the person a participant and lists ventures", async () => {
    const res = await GET(new Request("http://localhost/api/me/relationships"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.isProgramParticipant).toBe(true);
    expect(data.programs).toEqual([
      expect.objectContaining({ program_id: "P-1", status: "active", completed: false, readOnly: false }),
    ]);
    expect(data.isVentureMember).toBe(true);
    expect(data.ventures).toEqual([
      { venture_id: "VNT-1", name: "Acme", status: "active" },
    ]);

    // Ventures query scoped to the session cid (user_cid OR contact_id),
    // excludes removed memberships
    const ventureQuery = executedQueries.find((query) =>
      query.sql.includes("FROM venture_members vm"),
    );
    expect(ventureQuery.sql).toContain("vm.user_cid = ? OR vm.contact_id = ?");
    expect(ventureQuery.sql).toContain("vm.removed_at IS NULL");
    expect(ventureQuery.args).toEqual(["user-1", "user-1"]);

    // The row carries no founder signal → not a founder the sidebar can act on
    expect(data.isFounder).toBe(false);

    // Neutral-role backfill is triggered on every call
    expect(mockBackfill).toHaveBeenCalled();
  });

  test("a COMPLETED seat keeps the door open, read-only", async () => {
    const completedImpl = async ({ sql }) => {
      if (sql.includes("WITH contact AS")) {
        return {
          rows: [
            {
              program_id: "P-1",
              source: "membership",
              status: "completed",
              program_name: "Alpha",
              program_exists: true,
            },
          ],
        };
      }
      return { rows: [] };
    };
    mockExecute.mockImplementation(completedImpl);
    try {
      const data = await readJson(await GET(new Request("http://localhost/api/me/relationships")));
      expect(data.isProgramParticipant).toBe(true);
      expect(data.programs).toEqual([
        expect.objectContaining({ program_id: "P-1", status: "completed", completed: true, readOnly: true }),
      ]);
    } finally {
      mockExecute.mockImplementation(defaultImpl);
    }
  });

  test("an older group link opens the door when no modern row exists", async () => {
    const legacyImpl = async ({ sql, args }) => {
      executedQueries.push({ sql, args });
      if (sql.includes("WITH contact AS")) {
        return {
          rows: [
            {
              program_id: "P-2",
              source: "legacy",
              status: null,
              program_name: "Beta",
              program_exists: true,
              contact_group: "Cohort A",
            },
          ],
        };
      }
      return { rows: [] };
    };
    mockExecute.mockImplementation(legacyImpl);
    try {
      const data = await readJson(await GET(new Request("http://localhost/api/me/relationships")));
      expect(data.isProgramParticipant).toBe(true);
      expect(data.programs).toEqual([
        expect.objectContaining({ program_id: "P-2", legacy: true, readOnly: false }),
      ]);
    } finally {
      mockExecute.mockImplementation(defaultImpl);
    }
  });

  test("a seat pointing at a program that no longer exists grants nothing", async () => {
    const missingImpl = async ({ sql }) => {
      if (sql.includes("WITH contact AS")) {
        return {
          rows: [{ program_id: "P-9", source: "membership", status: "active", program_exists: false }],
        };
      }
      return { rows: [] };
    };
    mockExecute.mockImplementation(missingImpl);
    try {
      const data = await readJson(await GET(new Request("http://localhost/api/me/relationships")));
      expect(data.isProgramParticipant).toBe(false);
      expect(data.programs).toEqual([]);
    } finally {
      mockExecute.mockImplementation(defaultImpl);
    }
  });

  test("isProgramParticipant stays false when nothing matches", async () => {
    const emptyImpl = async ({ sql }) => {
      if (sql.includes("WITH contact AS")) return { rows: [] };
      if (sql.includes("FROM venture_members vm")) return { rows: [] };
      return { rows: [] };
    };
    mockExecute.mockImplementation(emptyImpl);
    try {
      const res = await GET(new Request("http://localhost/api/me/relationships"));
      const data = await readJson(res);
      expect(data.isProgramParticipant).toBe(false);
      expect(data.programs).toEqual([]);
      expect(data.isVentureMember).toBe(false);
      expect(data.ventures).toEqual([]);
    } finally {
      mockExecute.mockImplementation(defaultImpl);
    }
  });

  test("isFounder follows the owning/founder-typed membership", async () => {
    const founderImpl = async ({ sql }) => {
      if (sql.includes("WITH contact AS")) return { rows: [] };
      if (sql.includes("FROM venture_members vm")) {
        return {
          rows: [
            { venture_id: "VNT-1", name: "Acme", status: "active", member_type: "founder", is_owner: false },
            { venture_id: "VNT-2", name: "Beta", status: "active", member_type: "team_member", is_owner: 1 },
          ],
        };
      }
      return { rows: [] };
    };
    mockExecute.mockImplementation(founderImpl);
    try {
      const res = await GET(new Request("http://localhost/api/me/relationships"));
      const data = await readJson(res);
      expect(data.isVentureMember).toBe(true);
      expect(data.isFounder).toBe(true);
    } finally {
      mockExecute.mockImplementation(defaultImpl);
    }
  });

  test("a team member is a venture member but not a founder", async () => {
    const teamImpl = async ({ sql }) => {
      if (sql.includes("WITH contact AS")) return { rows: [] };
      if (sql.includes("FROM venture_members vm")) {
        return {
          rows: [
            { venture_id: "VNT-3", name: "Gamma", status: "active", member_type: "team_member", is_owner: 0 },
          ],
        };
      }
      return { rows: [] };
    };
    mockExecute.mockImplementation(teamImpl);
    try {
      const res = await GET(new Request("http://localhost/api/me/relationships"));
      const data = await readJson(res);
      expect(data.isVentureMember).toBe(true);
      expect(data.isFounder).toBe(false);
    } finally {
      mockExecute.mockImplementation(defaultImpl);
    }
  });

  test("returns 401 when there is no session", async () => {
    const authMock = require("@/server/auth/session");
    authMock.getSession.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/api/me/relationships"));
    expect(res.status).toBe(401);
    const data = await readJson(res);
    expect(data.success).toBe(false);
  });
});
