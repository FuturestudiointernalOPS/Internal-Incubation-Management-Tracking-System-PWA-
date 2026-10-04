/**
 * Shared wiring for the Tasks API integration tests.
 *
 * The db mock answers per SQL fragment and mutates a fake task table, so it is
 * a factory rather than a module constant: the suite owns the state it reads
 * and writes. Register it as `jest.mock("@/lib/db", () => mockTasks.dbMock())`
 * — the `mock` prefix is what lets babel-plugin-jest-hoist accept the
 * out-of-scope reference, and the factory only runs once a route requires
 * "@/lib/db", after this module is loaded.
 *
 * Jest's module registry is per test file, so every suite that requires this
 * helper gets its OWN dbState.
 */

const dbState = {
  tasks: [],
  blockers: [],
  nextId: 500,
};

const requireAuth = jest.fn().mockResolvedValue(null);
const getSession = jest.fn().mockResolvedValue({
  cid: "staff-1",
  name: "Staff One",
  role: "staff",
});

const jsonReq = (body, method = "POST") =>
  new Request("http://localhost/api/tasks", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

function dbMock() {
  return {
    __esModule: true,
    default: {
      execute: jest.fn(async ({ sql, args }) => {
                const state = global.__dbState;
                if (!state) return { rows: [] };
                // getTaskById: SELECT * FROM tasks WHERE id = ?
                if (sql.includes("SELECT * FROM tasks WHERE id = ?")) {
                  const id = Number(args[0]);
                  return { rows: state.tasks.filter((task) => task.id === id) };
                }
                // Sibling incomplete count: SELECT COUNT(*) AS total ... WHERE parent_task_id = ?
                if (sql.includes("COUNT(*) AS total") && sql.includes("parent_task_id = ?")) {
                  const parentTaskId = Number(args[0]);
                  const total = state.tasks.filter(
                    (task) =>
                      task.parent_task_id === parentTaskId &&
                      !["completed", "archived"].includes(task.status),
                  ).length;
                  return { rows: [{ total }] };
                }
                // Active blockers on a task
                if (
                  sql.includes("SELECT id FROM blockers WHERE task_id = ?") &&
                  sql.includes("status = 'active'")
                ) {
                  const taskId = Number(args[0]);
                  return {
                    rows: state.blockers.filter(
                      (blocker) => blocker.task_id === taskId && blocker.status === "active",
                    ),
                  };
                }
                // Parent auto-complete: UPDATE tasks SET status = 'completed' ... WHERE id = ?
                if (
                  sql.trim().startsWith("UPDATE tasks SET status = 'completed'") &&
                  sql.includes("WHERE id = ?")
                ) {
                  const id = Number(args[args.length - 1]);
                  const task = state.tasks.find((candidate) => candidate.id === id);
                  if (task && task.status !== "archived" && task.status !== "completed") {
                    task.status = "completed";
                    return { rowsAffected: 1 };
                  }
                  return { rowsAffected: 0 };
                }
                // Cascade-complete subtasks: UPDATE tasks SET status = 'completed' ... WHERE parent_task_id = ?
                if (
                  sql.trim().startsWith("UPDATE tasks SET status = 'completed'") &&
                  sql.includes("WHERE parent_task_id = ?")
                ) {
                  const parentTaskId = Number(args[0]);
                  state.tasks
                    .filter(
                      (task) =>
                        task.parent_task_id === parentTaskId &&
                        task.status !== "completed" &&
                        task.status !== "archived",
                    )
                    .forEach((task) => {
                      task.status = "completed";
                    });
                  return { rowsAffected: 1 };
                }
                // Parent reopen: UPDATE tasks SET status = 'in_progress' ... WHERE id = ?
                if (
                  sql.trim().startsWith("UPDATE tasks SET status = 'in_progress'") &&
                  sql.includes("WHERE id = ?")
                ) {
                  const id = Number(args[args.length - 1]);
                  const task = state.tasks.find((candidate) => candidate.id === id);
                  if (task && task.status === "completed") {
                    task.status = "in_progress";
                    return { rowsAffected: 1 };
                  }
                  return { rowsAffected: 0 };
                }
                // Generic UPDATE with parameterized status
                if (sql.trim().startsWith("UPDATE tasks SET")) {
                  const id = Number(args[args.length - 1]);
                  const task = state.tasks.find((candidate) => candidate.id === id);
                  if (task && sql.includes("status = ?")) {
                    const statusIdx = sql.indexOf("status = ?");
                    const paramCount = sql.slice(0, statusIdx).split("?").length - 1;
                    task.status = args[paramCount];
                    if (sql.includes("completed_at = CURRENT_TIMESTAMP")) {
                      task.completed_at = new Date().toISOString();
                    }
                    if (sql.includes("completed_at = NULL")) {
                      task.completed_at = null;
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
}

function authMock() {
  return { requireAuth, getSession };
}

function auditLogMock() {
  return {
    logAuditEvent: jest.fn().mockResolvedValue(true),
    isTaskLocked: jest.fn().mockResolvedValue(false),
  };
}

function taskAuditMock() {
  return {
    logTaskEvent: jest.fn().mockResolvedValue(true),
    ACTION_TYPES: {
      TASK_CREATED: "task_created",
      TASK_COMPLETED: "task_completed",
      TASK_CARRIED_OVER: "task_carried_over",
      TASK_UPDATED: "task_updated",
      TASK_ASSIGNED: "task_assigned",
      TASK_REASSIGNED: "task_reassigned",
    },
  };
}

function standupUpsertMock() {
  return {
    standupUpsert: jest.fn().mockResolvedValue({ standupId: 1, action: "created" }),
    rebuildStandupTasks: jest.fn().mockResolvedValue({ action: "skipped" }),
  };
}

function tasksModelMock() {
  return {
    ...jest.requireActual("@/models/tasks"),
    getTaskById: jest.fn(async (id) => {
      const task = global.__dbState.tasks.find((candidate) => candidate.id === Number(id));
      return task || null;
    }),
    getTaskTitleById: jest.fn(async (id) => {
      const task = global.__dbState.tasks.find((candidate) => candidate.id === Number(id));
      return task ? task.title : null;
    }),
    getTaskEndDateById: jest.fn(async (id) => {
      const task = global.__dbState.tasks.find((candidate) => candidate.id === Number(id));
      return task ? task.end_date || null : null;
    }),
    taskExists: jest.fn(async (id) =>
      global.__dbState.tasks.some((candidate) => candidate.id === Number(id)),
    ),
  };
}

/** The whole beforeEach: an empty task table, and the global the mock reads. */
function reset() {
  dbState.tasks.length = 0;
  dbState.blockers.length = 0;
  dbState.nextId = 500;
  global.__dbState = dbState;
}

module.exports = {
  dbState,
  dbMock,
  authMock,
  auditLogMock,
  taskAuditMock,
  standupUpsertMock,
  tasksModelMock,
  jsonReq,
  readJson,
  reset,
};
