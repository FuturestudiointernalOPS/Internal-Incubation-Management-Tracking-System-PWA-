/**
 * Integration tests for POST /api/tasks/carryover — Phase 1 carry-over fixes.
 *
 * Guards under test:
 *   - completed tasks are never cloned nor flipped to carried_over (409)
 *   - a task whose newest open copy already lives in the target week is not
 *     cloned a second time (idempotency)
 *   - the chain walk never follows completed/archived copies
 *   - the legitimate carry-over path still clones once and flips its source
 *
 * Runs the real route handler against a mocked DB layer.
 */

const mockExecuted = [];
let mockNextId = 900;
const mockState = { tasks: [] };

jest.mock("@/lib/db", () => {
  return {
    __esModule: true,
    default: {
      execute: jest.fn(async ({ sql, args }) => {
        mockExecuted.push({ sql, args: args || [] });
        // Original task lookup
        if (sql.includes("SELECT * FROM tasks WHERE id = ?")) {
          const id = Number(args[0]);
          return { rows: mockState.tasks.filter((t) => t.id === id) };
        }
        // Chain walk — newest OPEN clone (completed/archived copies are skipped)
        if (
          sql.includes("carried_over_from_task_id = ?") &&
          sql.includes("ORDER BY created_week DESC")
        ) {
          const sourceId = Number(args[0]);
          return {
            rows: mockState.tasks
              .filter(
                (t) =>
                  t.carried_over_from_task_id === sourceId &&
                  !["completed", "archived"].includes(t.status),
              )
              .sort(
                (a, b) =>
                  b.created_year - a.created_year ||
                  b.created_week - a.created_week ||
                  b.id - a.id,
              )
              .slice(0, 1),
          };
        }
        // Clone insert — created_week=args[6], created_year=args[7], source=args[8]
        if (sql.includes("INSERT INTO tasks") && sql.includes("RETURNING id")) {
          const id = mockNextId++;
          mockState.tasks.push({
            id,
            user_id: args[0],
            user_name: args[1] || "",
            title: args[2],
            description: args[3],
            project_id: args[4],
            category: args[5],
            created_week: Number(args[6]),
            created_year: Number(args[7]),
            carried_over_from_task_id: Number(args[8]),
            parent_task_id: null,
            start_date: args[9] || null,
            end_date: args[10] || null,
            assigned_to: args[11] || null,
            priority: args[13] || null,
            context_type: args[14] || "staff",
            context_id: args[15] || null,
            supervisor_id: args[16] || null,
            status: "in_progress",
          });
          return { rows: [{ id }] };
        }
        // Mark source as carried_over (guarded update)
        if (
          sql.includes("status = 'carried_over'") &&
          sql.includes("completed_at IS NULL")
        ) {
          const id = Number(args[0]);
          const t = mockState.tasks.find((x) => x.id === id);
          if (
            t &&
            !["completed", "archived"].includes(t.status) &&
            t.completed_at == null
          ) {
            t.status = "carried_over";
            return { rowsAffected: 1 };
          }
          return { rowsAffected: 0 };
        }
        return { rows: [], rowsAffected: 0 };
      }),
    },
    initDb: jest.fn().mockResolvedValue(true),
  };
});

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn().mockResolvedValue({
    cid: "staff-1",
    name: "Staff One",
    role: "staff",
  }),
}));

const { POST } = require("@/app/api/tasks/carryover/route");

const jsonReq = (body) =>
  new Request("http://localhost/api/tasks/carryover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

const seed = (task) => {
  mockState.tasks.push({
    user_id: "staff-1",
    user_name: "Staff One",
    title: "Task",
    description: null,
    project_id: null,
    category: null,
    status: "in_progress",
    parent_task_id: null,
    created_week: 34,
    created_year: 2026,
    carried_over_from_task_id: null,
    start_date: null,
    end_date: null,
    assigned_to: null,
    priority: null,
    context_type: "staff",
    context_id: null,
    supervisor_id: null,
    completed_at: null,
    ...task,
  });
};

beforeEach(() => {
  mockExecuted.length = 0;
  mockState.tasks.length = 0;
  mockNextId = 900;
});

describe("POST /api/tasks/carryover — Phase 1 guards", () => {
  test("refuses to carry a completed task (409) and creates no clone", async () => {
    seed({
      id: 1,
      title: "Finished work",
      status: "completed",
      completed_at: "2026-08-20T07:50:00.000Z",
    });
    const res = await POST(
      jsonReq({
        task_id: 1,
        target_week: 35,
        target_year: 2026,
        user_id: "staff-1",
        user_name: "Staff One",
      }),
    );
    expect(res.status).toBe(409);
    const data = await readJson(res);
    expect(data.success).toBe(false);
    expect(mockExecuted.some((e) => e.sql.includes("INSERT INTO tasks"))).toBe(
      false,
    );
  });

  test("is idempotent when the newest open copy already lives in the target week", async () => {
    seed({ id: 2, title: "Already here", created_week: 35, created_year: 2026 });
    const res = await POST(
      jsonReq({
        task_id: 2,
        target_week: 35,
        target_year: 2026,
        user_id: "staff-1",
        user_name: "Staff One",
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.action).toBe("already_carried_over");
    expect(data.id).toBe(2);
    expect(mockExecuted.some((e) => e.sql.includes("INSERT INTO tasks"))).toBe(
      false,
    );
  });

  test("chain walk never follows completed copies — it clones the newest open copy", async () => {
    // id 3 carried in week 35 (open), week-36 copy was completed, week-37 copy is open
    seed({ id: 3, title: "Chain base", created_week: 34, created_year: 2026 });
    seed({
      id: 4,
      title: "Chain base",
      created_week: 35,
      created_year: 2026,
      carried_over_from_task_id: 3,
    });
    seed({
      id: 5,
      title: "Chain base",
      status: "completed",
      completed_at: "2026-08-25T00:00:00.000Z",
      created_week: 36,
      created_year: 2026,
      carried_over_from_task_id: 4,
    });
    seed({
      id: 6,
      title: "Chain base",
      created_week: 37,
      created_year: 2026,
      carried_over_from_task_id: 4,
    });

    const res = await POST(
      jsonReq({
        task_id: 3,
        target_week: 38,
        target_year: 2026,
        user_id: "staff-1",
        user_name: "Staff One",
      }),
    );
    expect(res.status).toBe(200);
    const insert = mockExecuted.find((e) => e.sql.includes("INSERT INTO tasks"));
    expect(insert).toBeDefined();
    // New clone must point at the newest OPEN copy (id 6), not the completed one (id 5)
    expect(Number(insert.args[8])).toBe(6);
    // The completed copy (5) must never be flipped
    expect(mockState.tasks.find((t) => t.id === 5).status).toBe("completed");
  });

  test("legitimate carry-over clones once and flips its open source", async () => {
    seed({ id: 7, title: "Real carry", created_week: 34, created_year: 2026 });
    const res = await POST(
      jsonReq({
        task_id: 7,
        target_week: 35,
        target_year: 2026,
        user_id: "staff-1",
        user_name: "Staff One",
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.action).toBe("carried_over");
    const inserts = mockExecuted.filter((e) => e.sql.includes("INSERT INTO tasks"));
    expect(inserts.length).toBe(1);
    expect(mockState.tasks.find((t) => t.id === 7).status).toBe("carried_over");
  });
});
