/**
 * Integration tests for the Tasks API — date validation and
 * subtask ⇄ parent completion cascade (bugs #7 and #8).
 *
 * Runs the real route handlers with a mocked DB layer. The status-safety guards
 * are in tasks-api.safety.test.js; the wiring lives in
 * ./helpers/tasksApiHarness.
 */

const mockTasks = require("./helpers/tasksApiHarness");

jest.mock("@/lib/db", () => mockTasks.dbMock());
jest.mock("@/server/auth/guards", () => ({ requireAuth: mockTasks.authMock().requireAuth }));
jest.mock("@/server/auth/session", () => ({ getSession: mockTasks.authMock().getSession }));
jest.mock("@/services/tasks/auditLog", () => mockTasks.auditLogMock());
jest.mock("@/models/taskAudit", () => mockTasks.taskAuditMock());
jest.mock("@/models/standupUpsert", () => mockTasks.standupUpsertMock());
jest.mock("@/models/tasks", () => mockTasks.tasksModelMock());

const { POST, PUT } = require("@/app/api/tasks/route");

const { dbState, jsonReq, readJson, reset } = mockTasks;

beforeEach(() => {
  reset();
});

describe("POST /api/tasks — date validation", () => {
  // ISO week helpers mirroring the route's UTC-based getWeekNumber().
  // Dates/weeks are computed relative to "today" so these tests are
  // time-independent (they previously hard-coded week 33 of 2026 and
  // rotted once that week was no longer the current one).
  const isoWeek = (date) => {
    const utcDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    return Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);
  };
  const fmtDate = (date) => date.toISOString().split("T")[0];
  const daysFromNow = (days) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return fmtDate(date);
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
    const parent = dbState.tasks.find((task) => task.id === 1);
    expect(parent.status).toBe("in_progress");
  });

  test("parent auto-completes when ALL subtasks are completed", async () => {
    await PUT(jsonReq({ id: 2, status: "completed", user_id: "staff-1" }, "PUT"));
    const res = await PUT(
      jsonReq({ id: 3, status: "completed", user_id: "staff-1" }, "PUT"),
    );
    expect(res.status).toBe(200);
    const parent = dbState.tasks.find((task) => task.id === 1);
    expect(parent.status).toBe("completed");
  });

  test("parent reopens when a completed subtask is reopened", async () => {
    // Complete both subtasks (parent auto-completes)
    await PUT(jsonReq({ id: 2, status: "completed", user_id: "staff-1" }, "PUT"));
    await PUT(jsonReq({ id: 3, status: "completed", user_id: "staff-1" }, "PUT"));
    expect(dbState.tasks.find((task) => task.id === 1).status).toBe("completed");

    // Reopen Sub B → parent must reopen
    const res = await PUT(
      jsonReq({ id: 3, status: "in_progress", user_id: "staff-1" }, "PUT"),
    );
    expect(res.status).toBe(200);
    expect(dbState.tasks.find((task) => task.id === 1).status).toBe("in_progress");
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
    expect(dbState.tasks.find((task) => task.id === 9).status).toBe("completed");
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
    expect(dbState.tasks.find((task) => task.id === 1).status).toBe("in_progress");
  });
});
