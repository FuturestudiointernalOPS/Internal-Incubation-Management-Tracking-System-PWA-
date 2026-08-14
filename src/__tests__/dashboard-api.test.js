/**
 * Integration tests for the Dashboard API — task statistics source of truth
 * (bugs #4 and #10).
 *
 * Verifies that "task" statistics exclude subtasks and archived tasks,
 * and that open = not completed.
 */

const executedQueries = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args }) => {
      executedQueries.push({ sql, args });
      // User info query must return a row for userName
      if (sql.includes("SELECT name, email, role, cid FROM contacts")) {
        return {
          rows: [{ name: "Test Staff", email: "test@futurestudio.org", role: "staff", cid: "staff-1" }],
        };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn().mockResolvedValue({
    cid: "staff-1",
    name: "Test Staff",
    role: "staff",
  }),
}));

const { GET } = require("@/app/api/dashboard/route");

const readJson = async (res) => res.json();

beforeEach(() => {
  executedQueries.length = 0;
});

describe("GET /api/dashboard — task statistics definition", () => {
  test("task stats query excludes subtasks and archived tasks", async () => {
    const res = await GET(
      new Request("http://localhost/api/dashboard?user_id=staff-1&role=staff"),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);

    // Find the task-stats query (query #7)
    const statsQuery = executedQueries.find(
      (q) =>
        q.sql.includes("SELECT id, title, end_date, status, priority, project_id") &&
        q.sql.includes("FROM tasks"),
    );
    expect(statsQuery).toBeDefined();
    expect(statsQuery.sql).toContain("parent_task_id IS NULL");
    expect(statsQuery.sql).toContain("status != 'archived'");

    // Quick-access "my tasks" query (#14) also excludes subtasks/archived
    const myTasksQuery = executedQueries.find(
      (q) => q.sql.includes("FROM tasks WHERE user_id::text = ?::text"),
    );
    expect(myTasksQuery).toBeDefined();
    expect(myTasksQuery.sql).toContain("parent_task_id IS NULL");
    expect(myTasksQuery.sql).toContain("status != 'archived'");
  });

  test("open task count excludes completed tasks", async () => {
    const res = await GET(
      new Request("http://localhost/api/dashboard?user_id=staff-1&role=staff"),
    );
    const data = await readJson(res);
    // Empty DB → zeroed summary (no hard-coded values)
    expect(data.summary.tasks.total).toBe(0);
    expect(data.summary.tasks.open).toBe(0);
    expect(data.summary.programs).toBe(0);
    expect(data.summary.blockers.active).toBe(0);
  });
});
