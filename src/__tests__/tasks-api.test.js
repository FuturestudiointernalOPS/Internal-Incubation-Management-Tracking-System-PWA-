/**
 * Integration tests for the Tasks API — date validation and
 * subtask ⇄ parent completion cascade (bugs #7 and #8).
 *
 * Runs the real route handlers with a mocked DB layer.
 */

const dbState = {
  tasks: [],
  blockers: [],
  nextId: 500,
};

jest.mock("@/lib/db", () => {
  return {
    __esModule: true,
    default: {
      execute: jest.fn(async ({ sql, args }) => {
        const state = global.__dbState;
        if (!state) return { rows: [] };
        // getTaskById: SELECT * FROM tasks WHERE id = ?
        if (sql.includes("SELECT * FROM tasks WHERE id = ?")) {
          const id = Number(args[0]);
          return { rows: state.tasks.filter((t) => t.id === id) };
        }
        // Sibling incomplete count: SELECT COUNT(*) AS total ... WHERE parent_task_id = ?
        if (sql.includes("COUNT(*) AS total") && sql.includes("parent_task_id = ?")) {
          const pid = Number(args[0]);
          const total = state.tasks.filter(
            (t) =>
              t.parent_task_id === pid &&
              !["completed", "archived"].includes(t.status),
          ).length;
          return { rows: [{ total }] };
        }
        // Active blockers on a task
        if (
          sql.includes("SELECT id FROM blockers WHERE task_id = ?") &&
          sql.includes("status = 'active'")
        ) {
          const tid = Number(args[0]);
          return {
            rows: state.blockers.filter(
              (b) => b.task_id === tid && b.status === "active",
            ),
          };
        }
        // Parent auto-complete: UPDATE tasks SET status = 'completed' ... WHERE id = ?
        if (
          sql.trim().startsWith("UPDATE tasks SET status = 'completed'") &&
          sql.includes("WHERE id = ?")
        ) {
          const id = Number(args[args.length - 1]);
          const t = state.tasks.find((x) => x.id === id);
          if (t && t.status !== "archived" && t.status !== "completed") {
            t.status = "completed";
            return { rowsAffected: 1 };
          }
          return { rowsAffected: 0 };
        }
        // Cascade-complete subtasks: UPDATE tasks SET status = 'completed' ... WHERE parent_task_id = ?
        if (
          sql.trim().startsWith("UPDATE tasks SET status = 'completed'") &&
          sql.includes("WHERE parent_task_id = ?")
        ) {
          const pid = Number(args[0]);
          state.tasks
            .filter(
              (t) =>
                t.parent_task_id === pid &&
                t.status !== "completed" &&
                t.status !== "archived",
            )
            .forEach((t) => {
              t.status = "completed";
            });
          return { rowsAffected: 1 };
        }
        // Parent reopen: UPDATE tasks SET status = 'in_progress' ... WHERE id = ?
        if (
          sql.trim().startsWith("UPDATE tasks SET status = 'in_progress'") &&
          sql.includes("WHERE id = ?")
        ) {
          const id = Number(args[args.length - 1]);
          const t = state.tasks.find((x) => x.id === id);
          if (t && t.status === "completed") {
            t.status = "in_progress";
            return { rowsAffected: 1 };
          }
          return { rowsAffected: 0 };
        }
        // Generic UPDATE with parameterized status
        if (sql.trim().startsWith("UPDATE tasks SET")) {
          const id = Number(args[args.length - 1]);
          const t = state.tasks.find((x) => x.id === id);
          if (t && sql.includes("status = ?")) {
            const statusIdx = sql.indexOf("status = ?");
            const paramCount = sql.slice(0, statusIdx).split("?").length - 1;
            t.status = args[paramCount];
            if (sql.includes("completed_at = CURRENT_TIMESTAMP")) {
              t.completed_at = new Date().toISOString();
            }
            if (sql.includes("completed_at = NULL")) {
              t.completed_at = null;
            }
          }
          return { rowsAffected: 1 };
        }
        // INSERT ... RETURNING id
        if (sql.includes("RETURNING id")) {
          return { rows: [{ id: state.nextId++ }] };
        }
        return { rows: [] };
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

jest.mock("@/lib/audit", () => ({
  logAuditEvent: jest.fn().mockResolvedValue(true),
  isTaskLocked: jest.fn().mockResolvedValue(false),
}));

jest.mock("@/lib/taskAudit", () => ({
  logTaskEvent: jest.fn().mockResolvedValue(true),
  ACTION_TYPES: {
    TASK_CREATED: "task_created",
    TASK_COMPLETED: "task_completed",
    TASK_CARRIED_OVER: "task_carried_over",
    TASK_UPDATED: "task_updated",
    TASK_ASSIGNED: "task_assigned",
    TASK_REASSIGNED: "task_reassigned",
  },
}));

jest.mock("@/lib/standupUpsert", () => ({
  standupUpsert: jest.fn().mockResolvedValue({ standupId: 1, action: "created" }),
  rebuildStandupTasks: jest.fn().mockResolvedValue({ action: "skipped" }),
}));

jest.mock("@/lib/db/queries/tasks", () => ({
  getTaskById: jest.fn(async (id) => {
    const t = global.__dbState.tasks.find((x) => x.id === Number(id));
    return t || null;
  }),
  getTaskTitleById: jest.fn(async (id) => {
    const t = global.__dbState.tasks.find((x) => x.id === Number(id));
    return t ? t.title : null;
  }),
  getTaskEndDateById: jest.fn(async (id) => {
    const t = global.__dbState.tasks.find((x) => x.id === Number(id));
    return t ? t.end_date || null : null;
  }),
  taskExists: jest.fn(async (id) =>
    global.__dbState.tasks.some((x) => x.id === Number(id)),
  ),
}));

const { POST, PUT } = require("@/app/api/tasks/route");

const jsonReq = (body, method = "POST") =>
  new Request("http://localhost/api/tasks", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

beforeEach(() => {
  dbState.tasks.length = 0;
  dbState.blockers.length = 0;
  dbState.nextId = 500;
  global.__dbState = dbState;
});

describe("POST /api/tasks — date validation", () => {
  // ISO week helpers mirroring the route's UTC-based getWeekNumber().
  // Dates/weeks are computed relative to "today" so these tests are
  // time-independent (they previously hard-coded week 33 of 2026 and
  // rotted once that week was no longer the current one).
  const isoWeek = (date) => {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  };
  const fmtDate = (date) => date.toISOString().split("T")[0];
  const daysFromNow = (n) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + n);
    return fmtDate(d);
  };
  const now = new Date();

  const base = {
    user_id: "staff-1",
    user_name: "Staff One",
    title: "Ship onboarding",
    created_week: isoWeek(now),
    created_year: now.getFullYear(),
  };

  test("rejects a start date in the past for a current-week task", async () => {
    const res = await POST(
      jsonReq({
        ...base,
        start_date: "2020-01-01",
        end_date: daysFromNow(5),
      }),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.success).toBe(false);
    expect(data.error.toLowerCase()).toContain("past");
  });

  test("rejects a due date earlier than the start date", async () => {
    const res = await POST(
      jsonReq({
        ...base,
        start_date: daysFromNow(4),
        end_date: daysFromNow(1),
      }),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error.toLowerCase()).toContain("due date");
  });

  test("rejects malformed date formats", async () => {
    const res = await POST(
      jsonReq({
        ...base,
        start_date: "20/08/2026",
      }),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.success).toBe(false);
  });

  test("accepts valid future dates and creates the task", async () => {
    const res = await POST(
      jsonReq({
        ...base,
        start_date: daysFromNow(1),
        end_date: daysFromNow(3),
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.id).toBe(500);
  });
});

describe("PUT /api/tasks — date validation", () => {
  beforeEach(() => {
    dbState.tasks.push({
      id: 1,
      user_id: "staff-1",
      user_name: "Staff One",
      title: "Parent",
      status: "in_progress",
      parent_task_id: null,
      created_week: 33,
      created_year: 2026,
      start_date: "2026-08-13",
      end_date: "2026-08-20",
    });
  });

  test("rejects setting a due date before the existing start date", async () => {
    const res = await PUT(
      jsonReq(
        {
          id: 1,
          end_date: "2026-08-01",
          user_id: "staff-1",
        },
        "PUT",
      ),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error.toLowerCase()).toContain("due date");
  });

  test("rejects setting a start date after the existing due date", async () => {
    const res = await PUT(
      jsonReq(
        {
          id: 1,
          start_date: "2026-09-01",
          user_id: "staff-1",
        },
        "PUT",
      ),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.success).toBe(false);
  });

  test("allows start date equal to due date", async () => {
    const res = await PUT(
      jsonReq(
        {
          id: 1,
          end_date: "2026-08-13",
          user_id: "staff-1",
        },
        "PUT",
      ),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
  });
});

describe("PUT /api/tasks — subtask ⇄ parent completion cascade", () => {
  beforeEach(() => {
    dbState.tasks.push(
      {
        id: 1,
        user_id: "staff-1",
        user_name: "Staff One",
        title: "Parent task",
        status: "in_progress",
        parent_task_id: null,
        created_week: 33,
        created_year: 2026,
        start_date: "2026-08-13",
        end_date: "2026-08-20",
      },
      {
        id: 2,
        user_id: "staff-1",
        user_name: "Staff One",
        title: "Sub A",
        status: "in_progress",
        parent_task_id: 1,
        created_week: 33,
        created_year: 2026,
      },
      {
        id: 3,
        user_id: "staff-1",
        user_name: "Staff One",
        title: "Sub B",
        status: "in_progress",
        parent_task_id: 1,
        created_week: 33,
        created_year: 2026,
      },
    );
  });

  test("parent stays open while a subtask is still incomplete", async () => {
    // Complete only Sub A
    const res = await PUT(
      jsonReq({ id: 2, status: "completed", user_id: "staff-1" }, "PUT"),
    );
    expect(res.status).toBe(200);
    const parent = dbState.tasks.find((t) => t.id === 1);
    expect(parent.status).toBe("in_progress");
  });

  test("parent auto-completes when ALL subtasks are completed", async () => {
    await PUT(jsonReq({ id: 2, status: "completed", user_id: "staff-1" }, "PUT"));
    const res = await PUT(
      jsonReq({ id: 3, status: "completed", user_id: "staff-1" }, "PUT"),
    );
    expect(res.status).toBe(200);
    const parent = dbState.tasks.find((t) => t.id === 1);
    expect(parent.status).toBe("completed");
  });

  test("parent reopens when a completed subtask is reopened", async () => {
    // Complete both subtasks (parent auto-completes)
    await PUT(jsonReq({ id: 2, status: "completed", user_id: "staff-1" }, "PUT"));
    await PUT(jsonReq({ id: 3, status: "completed", user_id: "staff-1" }, "PUT"));
    expect(dbState.tasks.find((t) => t.id === 1).status).toBe("completed");

    // Reopen Sub B → parent must reopen
    const res = await PUT(
      jsonReq({ id: 3, status: "in_progress", user_id: "staff-1" }, "PUT"),
    );
    expect(res.status).toBe(200);
    expect(dbState.tasks.find((t) => t.id === 1).status).toBe("in_progress");
  });

  test("parent with no subtasks is unaffected by the cascade", async () => {
    dbState.tasks.push({
      id: 9,
      user_id: "staff-1",
      user_name: "Staff One",
      title: "Standalone",
      status: "in_progress",
      parent_task_id: null,
      created_week: 33,
      created_year: 2026,
    });
    const res = await PUT(
      jsonReq({ id: 9, status: "completed", user_id: "staff-1" }, "PUT"),
    );
    expect(res.status).toBe(200);
    expect(dbState.tasks.find((t) => t.id === 9).status).toBe("completed");
  });

  test("parent with active blockers is NOT auto-completed", async () => {
    dbState.blockers.push({
      id: 1,
      task_id: 1,
      title: "Waiting on legal",
      status: "active",
    });
    await PUT(jsonReq({ id: 2, status: "completed", user_id: "staff-1" }, "PUT"));
    await PUT(jsonReq({ id: 3, status: "completed", user_id: "staff-1" }, "PUT"));
    expect(dbState.tasks.find((t) => t.id === 1).status).toBe("in_progress");
  });
});
