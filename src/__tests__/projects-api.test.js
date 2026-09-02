/**
 * Integration tests for the Projects API (src/app/api/projects/route.js).
 *
 * Covers the current behavior: POST create + lead assignment + notification,
 * GET list with member/task aggregation, PUT field updates + lead sync, and
 * DELETE cascade. The db layer is mocked with SQL-substring matching, so the
 * suite also guards the Wave-2 model extraction: as long as the extracted
 * queries stay byte-identical the assertions keep passing.
 */

const executedQueries = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args }) => {
      executedQueries.push({ sql, args });
      // POST: INSERT project returning id
      if (sql.includes("INSERT INTO v2_projects")) {
        return { rows: [{ id: 77 }], lastInsertRowid: 77 };
      }
      // POST/PUT: upsert project lead membership
      if (sql.includes("INSERT INTO project_members")) {
        return { rows: [], rowsAffected: 1 };
      }
      // POST: notify assigned lead
      if (sql.includes("INSERT INTO v2_notifications")) {
        return { rows: [], rowsAffected: 1 };
      }
      // GET: project list (main query)
      if (sql.includes("FROM v2_projects p") && sql.includes("program_name")) {
        return {
          rows: [
            {
              id: 1,
              program_id: "10",
              name: "Website",
              status: "Active",
              meta: '{"description":"build it"}',
              owner_id: "user-1",
              created_at: "2026-01-01T00:00:00Z",
            },
            {
              id: 2,
              program_id: "10",
              name: "Mobile app",
              status: "Active",
              meta: null,
              owner_id: "user-2",
              created_at: "2026-01-02T00:00:00Z",
            },
          ],
        };
      }
      // GET: members grouped by project
      if (sql.includes("FROM project_members WHERE project_id::text IN")) {
        return {
          rows: [
            { project_id: "1", user_cid: "user-1", role: "lead" },
            { project_id: "2", user_cid: "user-2", role: "collaborator" },
          ],
        };
      }
      // GET: task stats grouped by project
      if (sql.includes("FROM tasks WHERE project_id::text IN")) {
        return { rows: [{ pid: "1", total: 4, completed: 2 }] };
      }
      // PUT: current meta fetch
      if (sql.includes("SELECT meta FROM v2_projects")) {
        return { rows: [{ meta: '{"description":"old"}' }] };
      }
      // PUT: DELETE old leads
      if (sql.includes("DELETE FROM project_members")) {
        return { rows: [], rowsAffected: 1 };
      }
      // Everything else (UPDATE/DELETE project etc.)
      return { rows: [], rowsAffected: 1 };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

const mockSession = { cid: "user-1", name: "Staff One", role: "staff" };

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn().mockResolvedValue(mockSession),
  requireProjectAccess: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
}));

const { GET, POST, PUT, DELETE } = require("@/app/api/projects/route");

const readJson = async (res) => res.json();
const jsonReq = (body, method = "POST") =>
  new Request("http://localhost/api/projects", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  executedQueries.length = 0;
});

describe("POST /api/projects", () => {
  test("rejects a project without a name", async () => {
    const res = await POST(jsonReq({ program_id: "10", status: "Active" }));
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.success).toBe(false);
    expect(data.error.toLowerCase()).toContain("name");
  });

  test("creates a project and assigns leads + sends notification", async () => {
    const res = await POST(
      jsonReq({
        name: "Website",
        program_id: "10",
        assigned_pm_ids: ["pm-1", "pm-2"],
        priority: "high",
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.project_id).toBe(77);

    const inserts = executedQueries.filter((q) =>
      q.sql.includes("INSERT INTO v2_projects"),
    );
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sql).toContain(
      "INSERT INTO v2_projects (program_id, name, status, start_date, end_date, priority, meta, owner_id)",
    );
    expect(inserts[0].args[1]).toBe("Website");
    expect(inserts[0].args[2]).toBe("Active");
    expect(inserts[0].args[5]).toBe("high");

    // Two leads upserted as members + two notifications
    const memberInserts = executedQueries.filter((q) =>
      q.sql.includes("INSERT INTO project_members"),
    );
    expect(memberInserts).toHaveLength(2);
    expect(memberInserts[0].args).toEqual(["77", "pm-1"]);
    const notifs = executedQueries.filter((q) =>
      q.sql.includes("INSERT INTO v2_notifications"),
    );
    expect(notifs).toHaveLength(2);
  });
});

describe("GET /api/projects", () => {
  test("returns projects with parsed meta, members and task stats", async () => {
    const res = await GET(
      new Request("http://localhost/api/projects?program_id=10"),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.projects).toHaveLength(2);

    const p1 = data.projects.find((p) => p.id === 1);
    expect(p1.meta).toEqual({ description: "build it" });
    expect(p1.members).toEqual([{ user_cid: "user-1", role: "lead" }]);
    expect(p1.task_summary).toEqual({ total: 4, completed: 2 });

    // Project without stats rows defaults to zeros
    const p2 = data.projects.find((p) => p.id === 2);
    expect(p2.task_summary).toEqual({ total: 0, completed: 0 });

    // Archived excluded by default, ordered newest first
    const listQuery = executedQueries.find((q) =>
      q.sql.includes("FROM v2_projects p"),
    );
    expect(listQuery.sql).toContain("p.status != 'Archived'");
    expect(listQuery.sql).toContain("ORDER BY p.created_at DESC");
  });

  test("non-staff roles are limited to their own projects (403)", async () => {
    mockSession.role = "participant";
    try {
      const res = await GET(
        new Request("http://localhost/api/projects?user_cid=someone-else"),
      );
      expect(res.status).toBe(403);
      const data = await readJson(res);
      expect(data.success).toBe(false);
    } finally {
      mockSession.role = "staff";
    }
  });
});

describe("PUT /api/projects", () => {
  test("rejects when id is missing", async () => {
    const res = await PUT(jsonReq({ name: "Renamed" }, "PUT"));
    expect(res.status).toBe(400);
  });

  test("rejects when there are no fields to update", async () => {
    const res = await PUT(jsonReq({ id: "1" }, "PUT"));
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error.toLowerCase()).toContain("no fields");
  });

  test("updates simple fields (no meta changes) and returns updated", async () => {
    const res = await PUT(
      jsonReq({ id: "1", name: "Renamed", status: "Closed" }, "PUT"),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data).toEqual({ success: true, action: "updated" });

    const update = executedQueries.find((q) =>
      q.sql.startsWith("UPDATE v2_projects"),
    );
    expect(update.sql).toContain('SET name = ?, status = ? WHERE id::text = ?');
    expect(update.args).toEqual(["Renamed", "Closed", "1"]);
  });

  test("syncs leads in the members table when assigned_pm_ids is provided", async () => {
    const res = await PUT(
      jsonReq({ id: "1", assigned_pm_ids: ["pm-9"] }, "PUT"),
    );
    expect(res.status).toBe(200);

    // Fetches current meta first, then deletes old leads, then inserts new one
    const metaFetch = executedQueries.find((q) =>
      q.sql.includes("SELECT meta FROM v2_projects"),
    );
    expect(metaFetch).toBeDefined();
    const deletes = executedQueries.filter((q) =>
      q.sql.includes("DELETE FROM project_members"),
    );
    expect(deletes).toHaveLength(1);
    const memberInserts = executedQueries.filter((q) =>
      q.sql.includes("INSERT INTO project_members"),
    );
    expect(memberInserts).toHaveLength(1);
    expect(memberInserts[0].args).toEqual(["1", "pm-9"]);
  });
});

describe("DELETE /api/projects", () => {
  test("rejects when id is missing", async () => {
    const res = await DELETE(new Request("http://localhost/api/projects?id="));
    expect(res.status).toBe(400);
  });

  test("removes members then the project", async () => {
    const res = await DELETE(new Request("http://localhost/api/projects?id=5"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data).toEqual({ success: true, action: "deleted" });

    const memberDelete = executedQueries.find(
      (q) => q.sql.includes("DELETE FROM project_members") && q.args[0] === "5",
    );
    expect(memberDelete).toBeDefined();
    const projectDelete = executedQueries.find(
      (q) => q.sql.startsWith("DELETE FROM v2_projects") && q.args[0] === "5",
    );
    expect(projectDelete).toBeDefined();
  });
});
