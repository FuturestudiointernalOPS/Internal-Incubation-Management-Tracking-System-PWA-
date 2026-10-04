/**
 * Integration tests for the Tasks API — the status-safety guards on PUT.
 *
 * A finished task must stay finished: completed → carried_over is refused, and
 * reopening a completed task clears its completion timestamp. Reassigning into
 * a project the actor does not belong to resets the status, and that reset has
 * to name the column once — Postgres refuses a SET list that names it twice, so
 * a duplicated column silently lost the save.
 *
 * The date validation and the completion cascade are in tasks-api.test.js; the
 * wiring lives in ./helpers/tasksApiHarness.
 */

const mockTasks = require("./helpers/tasksApiHarness");

jest.mock("@/lib/db", () => mockTasks.dbMock());
jest.mock("@/lib/auth", () => mockTasks.authMock());
jest.mock("@/services/tasks/auditLog", () => mockTasks.auditLogMock());
jest.mock("@/models/taskAudit", () => mockTasks.taskAuditMock());
jest.mock("@/models/standupUpsert", () => mockTasks.standupUpsertMock());
jest.mock("@/models/tasks", () => mockTasks.tasksModelMock());

const { PUT } = require("@/app/api/tasks/route");

const { dbState, jsonReq, readJson, reset } = mockTasks;

beforeEach(() => {
  reset();
});

describe("PUT /api/tasks — carry-over status safety (Phase 1)", () => {
  beforeEach(() => {
    dbState.tasks.push({
      id: 1,
      user_id: "staff-1",
      user_name: "Staff One",
      title: "Already completed",
      status: "completed",
      completed_at: "2026-08-20T07:50:00.000Z",
      parent_task_id: null,
      created_week: 33,
      created_year: 2026,
    });
  });

  test("refuses completed → carried_over (a finished task must stay finished)", async () => {
    const res = await PUT(
      jsonReq({ id: 1, status: "carried_over", user_id: "staff-1" }, "PUT"),
    );
    expect(res.status).toBe(409);
    const data = await readJson(res);
    expect(data.success).toBe(false);
    expect(data.error.toLowerCase()).toContain("completed");
    // State untouched
    const task = dbState.tasks.find((candidate) => candidate.id === 1);
    expect(task.status).toBe("completed");
    expect(task.completed_at).toBe("2026-08-20T07:50:00.000Z");
  });

  test("reopening a completed task clears its completion timestamp", async () => {
    const res = await PUT(
      jsonReq({ id: 1, status: "in_progress", user_id: "staff-1" }, "PUT"),
    );
    expect(res.status).toBe(200);
    const task = dbState.tasks.find((candidate) => candidate.id === 1);
    expect(task.status).toBe("in_progress");
    expect(task.completed_at).toBeNull();
  });

  test("still allows an open task to be marked carried_over", async () => {
    const open = dbState.tasks[0];
    open.status = "in_progress";
    open.completed_at = null;
    const res = await PUT(
      jsonReq({ id: 1, status: "carried_over", user_id: "staff-1" }, "PUT"),
    );
    expect(res.status).toBe(200);
    expect(dbState.tasks.find((task) => task.id === 1).status).toBe("carried_over");
  });
});

describe("PUT /api/tasks — reassigning into a project the actor does not belong to", () => {
  test("resets the status, naming that column once", async () => {
    dbState.tasks.push({
      id: 1,
      user_id: "staff-1",
      user_name: "Staff One",
      title: "Draft brief",
      status: "todo",
      project_id: 7,
      parent_task_id: null,
    });
    const db = require("@/lib/db").default;
    db.execute.mockClear();

    const res = await PUT(
      jsonReq(
        {
          id: 1,
          user_id: "staff-1",
          user_name: "Staff One",
          status: "in_progress",
          project_id: 42,
        },
        "PUT",
      ),
    );
    expect(res.status).toBe(200);

    const update = db.execute.mock.calls
      .map(([call]) => call)
      .find((call) => String(call.sql).startsWith("UPDATE tasks SET") && String(call.sql).includes("project_id = ?"));
    expect(update).toBeTruthy();

    const sql = String(update.sql);
    const columns = sql
      .slice(sql.indexOf("SET ") + 4, sql.indexOf(" WHERE id = ?"))
      .split(", ")
      .map((entry) => entry.split(" = ")[0]);

    // Postgres refuses a SET list that names one column twice, so the caller's
    // status and this reset could not both be written: the save was lost.
    expect(columns.filter((column, index) => columns.indexOf(column) !== index)).toEqual([]);
    expect(sql).toContain("status = 'pending_project_approval'");
    expect(sql).not.toContain("status = ?");
  });
});
