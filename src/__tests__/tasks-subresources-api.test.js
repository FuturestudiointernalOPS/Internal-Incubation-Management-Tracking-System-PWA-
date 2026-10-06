/**
 * Characterisation tests for the task sub-resource routes:
 *   src/app/api/tasks/{comments,resources,duplicate,logs,notify-deadlines}/route.js
 *
 * Pins the decision paths (statuses, bodies, which statements run), not the
 * implementation. The db layer is mocked with SQL-substring matching.
 */

const executedQueries = [];
const mockState = {
  access: null,
  comments: [],
  commentSender: null,
  resource: null,
  task: null,
  newTask: null,
  subtasks: [],
  logRows: [],
  dueTasks: [],
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args }) => {
      executedQueries.push({ sql, args: args || [] });

      // --- task lookups --------------------------------------------------
      if (sql === "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?") {
        return { rows: mockState.access ? [mockState.access] : [] };
      }
      if (sql === "SELECT id FROM tasks WHERE id = ?") {
        return { rows: mockState.task ? [{ id: 1 }] : [] };
      }
      if (sql === "SELECT * FROM tasks WHERE id = ?") {
        if (Number(args[0]) === 500) {
          return { rows: mockState.newTask ? [mockState.newTask] : [] };
        }
        return { rows: mockState.task ? [mockState.task] : [] };
      }
      if (sql === "SELECT user_id, assigned_to, title FROM tasks WHERE id = ?") {
        return {
          rows: [{ user_id: "owner-1", assigned_to: "assignee-1", title: "Task" }],
        };
      }
      if (sql.includes("SELECT * FROM tasks WHERE parent_task_id = ?")) {
        return { rows: mockState.subtasks };
      }

      // --- comments ------------------------------------------------------
      if (sql.includes("SELECT id, task_id, sender_id, sender_name, body, parent_id")) {
        return { rows: mockState.comments };
      }
      if (sql === "SELECT sender_id FROM v2_task_comments WHERE id = ?") {
        return { rows: mockState.commentSender ? [mockState.commentSender] : [] };
      }
      if (sql.includes("INSERT INTO v2_task_comments")) {
        return { rows: [{ id: 9, created_at: "2026-01-01T00:00:00Z" }] };
      }
      if (sql.includes("SELECT cid, name FROM contacts")) {
        return { rows: [{ cid: "mention-1", name: "Mention One" }] };
      }

      // --- resources -----------------------------------------------------
      if (sql.includes("SELECT task_id FROM task_resources WHERE id = ?")) {
        return { rows: mockState.resource ? [mockState.resource] : [] };
      }
      if (sql.includes("INSERT INTO task_resources")) {
        return { rows: [{ id: 42 }] };
      }

      // --- logs ----------------------------------------------------------
      if (sql.includes("SELECT * FROM task_assignment_log WHERE task_id = ?")) {
        return { rows: mockState.logRows };
      }

      // --- deadlines -----------------------------------------------------
      if (sql.includes("FROM tasks t")) {
        return { rows: mockState.dueTasks };
      }

      // --- copy insert ---------------------------------------------------
      if (sql.includes("INSERT INTO tasks")) {
        return { rows: [{ id: 500 }] };
      }

      return { rows: [], rowsAffected: 1 };
    }),
  },
  initDb: jest.fn(async () => true),
}));

const mockSession = { cid: "user-1", name: "Staff One", role: "staff" };

jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => mockSession),
}));

const comments = require("@/app/api/tasks/comments/route");
const resources = require("@/app/api/tasks/resources/route");
const duplicate = require("@/app/api/tasks/duplicate/route");
const logs = require("@/app/api/tasks/logs/route");
const deadlines = require("@/app/api/tasks/notify-deadlines/route");

const jsonReq = (url, body, method = "POST") =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const readJson = (res) => res.json();

const count = (substring) =>
  executedQueries.filter((query) => query.sql.includes(substring)).length;

beforeEach(() => {
  executedQueries.length = 0;
  mockState.access = null;
  mockState.comments = [];
  mockState.commentSender = null;
  mockState.resource = null;
  mockState.task = null;
  mockState.newTask = null;
  mockState.subtasks = [];
  mockState.logRows = [];
  mockState.dueTasks = [];
  mockSession.cid = "user-1";
  mockSession.name = "Staff One";
  mockSession.role = "staff";
});

describe("comments", () => {
  test("GET requires a task_id", async () => {
    const res = await comments.GET(
      new Request("http://localhost/api/tasks/comments"),
    );
    expect(res.status).toBe(400);
  });

  test("GET 404s when the task does not exist", async () => {
    const res = await comments.GET(
      new Request("http://localhost/api/tasks/comments?task_id=1"),
    );
    expect(res.status).toBe(404);
  });

  test("GET refuses a task the caller does not own (403)", async () => {
    mockSession.role = "participant";
    mockState.access = { user_id: "other", assigned_to: null, supervisor_id: null };
    const res = await comments.GET(
      new Request("http://localhost/api/tasks/comments?task_id=1"),
    );
    expect(res.status).toBe(403);
  });

  test("GET returns the comments", async () => {
    mockState.access = { user_id: "user-1", assigned_to: null, supervisor_id: null };
    mockState.comments = [{ id: 1, body: "hi" }];
    const res = await comments.GET(
      new Request("http://localhost/api/tasks/comments?task_id=1"),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.comments).toHaveLength(1);
  });

  test("POST validates the required fields", async () => {
    const res = await comments.POST(
      jsonReq("/api/tasks/comments", { task_id: 1, sender_id: "user-1" }),
    );
    expect(res.status).toBe(400);
  });

  test("POST 404s when the task does not exist", async () => {
    const res = await comments.POST(
      jsonReq("/api/tasks/comments", {
        task_id: 1,
        sender_id: "user-1",
        body: "hello",
      }),
    );
    expect(res.status).toBe(404);
  });

  test("POST creates the comment and fans out to owner, assignee and mentions", async () => {
    mockState.access = { user_id: "user-1", assigned_to: null, supervisor_id: null };
    mockState.task = { id: 1 };
    const res = await comments.POST(
      jsonReq("/api/tasks/comments", {
        task_id: 1,
        sender_id: "ignored",
        sender_name: "Sender",
        body: "hi @Mention One",
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, id: 9, created_at: "2026-01-01T00:00:00Z" });

    // The sender is the session user, not the client-supplied sender_id.
    const insert = executedQueries.find((query) =>
      query.sql.includes("INSERT INTO v2_task_comments"),
    );
    expect(insert.args[1]).toBe("user-1");
    const recipients = executedQueries
      .filter((query) => query.sql.includes("INSERT INTO v2_notifications"))
      .map((query) => query.args[0]);
    expect(recipients.sort()).toEqual(["assignee-1", "mention-1", "owner-1"]);
  });

  test("DELETE requires an id", async () => {
    const res = await comments.DELETE(
      new Request("http://localhost/api/tasks/comments"),
    );
    expect(res.status).toBe(400);
  });

  test("DELETE refuses a comment the caller did not write (403)", async () => {
    mockState.commentSender = { sender_id: "someone-else" };
    const res = await comments.DELETE(
      new Request("http://localhost/api/tasks/comments?id=1"),
    );
    expect(res.status).toBe(403);
  });

  test("DELETE removes the caller's own comment", async () => {
    mockState.commentSender = { sender_id: "user-1" };
    const res = await comments.DELETE(
      new Request("http://localhost/api/tasks/comments?id=1"),
    );
    expect(res.status).toBe(200);
    expect(count("DELETE FROM v2_task_comments")).toBe(1);
  });

  test("PUT 404s on an unknown comment", async () => {
    const res = await comments.PUT(
      jsonReq("/api/tasks/comments", { id: 1, user_id: "user-1", body: "x" }),
      undefined,
    );
    expect(res.status).toBe(404);
  });

  test("PUT refuses a comment the caller did not write (403)", async () => {
    mockState.commentSender = { sender_id: "someone-else" };
    const res = await comments.PUT(
      jsonReq("/api/tasks/comments", { id: 1, user_id: "user-1", body: "x" }),
    );
    expect(res.status).toBe(403);
  });

  test("PUT edits the caller's own comment", async () => {
    mockState.commentSender = { sender_id: "user-1" };
    const res = await comments.PUT(
      jsonReq("/api/tasks/comments", { id: 1, user_id: "user-1", body: "new" }),
    );
    expect(res.status).toBe(200);
    expect(count("UPDATE v2_task_comments SET body")).toBe(1);
  });
});

describe("resources", () => {
  test("POST validates task_id and url", async () => {
    const res = await resources.POST(
      jsonReq("/api/tasks/resources", { task_id: 1 }),
    );
    expect(res.status).toBe(400);
  });

  test("POST 404s when the task does not exist", async () => {
    const res = await resources.POST(
      jsonReq("/api/tasks/resources", { task_id: 1, url: "http://x" }),
    );
    expect(res.status).toBe(404);
  });

  test("POST 403s for a task the caller does not own", async () => {
    mockSession.role = "participant";
    mockState.access = { user_id: "other", assigned_to: null, supervisor_id: null };
    const res = await resources.POST(
      jsonReq("/api/tasks/resources", { task_id: 1, url: "http://x" }),
    );
    expect(res.status).toBe(403);
  });

  test("POST attaches the resource", async () => {
    mockState.access = { user_id: "user-1", assigned_to: null, supervisor_id: null };
    const res = await resources.POST(
      jsonReq("/api/tasks/resources", { task_id: 1, url: "http://x", name: "Link" }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, id: 42, message: "Resource added successfully" });
  });

  test("DELETE 404s on an unknown resource", async () => {
    const res = await resources.DELETE(
      new Request("http://localhost/api/tasks/resources?id=1"),
    );
    expect(res.status).toBe(404);
  });

  test("DELETE 404s when the owning task is gone", async () => {
    mockState.resource = { task_id: 1 };
    const res = await resources.DELETE(
      new Request("http://localhost/api/tasks/resources?id=1"),
    );
    expect(res.status).toBe(404);
  });

  test("DELETE removes the resource when the caller may access the task", async () => {
    mockState.resource = { task_id: 1 };
    mockState.access = { user_id: "user-1", assigned_to: null, supervisor_id: null };
    const res = await resources.DELETE(
      new Request("http://localhost/api/tasks/resources?id=1"),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, message: "Resource deleted successfully" });
    expect(count("DELETE FROM task_resources")).toBe(1);
  });
});

describe("duplicate", () => {
  test("requires task_id", async () => {
    const res = await duplicate.POST(jsonReq("/api/tasks/duplicate", {}));
    expect(res.status).toBe(400);
  });

  test("404s when the task does not exist", async () => {
    const res = await duplicate.POST(
      jsonReq("/api/tasks/duplicate", { task_id: 1 }),
    );
    expect(res.status).toBe(404);
  });

  test("403s for a task the caller does not own", async () => {
    mockSession.role = "participant";
    mockState.task = { id: 1, user_id: "other", assigned_to: null, supervisor_id: null };
    const res = await duplicate.POST(
      jsonReq("/api/tasks/duplicate", { task_id: 1 }),
    );
    expect(res.status).toBe(403);
  });

  test("copies the task and its subtasks", async () => {
    mockState.task = { id: 1, user_id: "user-1", title: "Original" };
    mockState.newTask = { id: 500, title: "Original (Copy)" };
    mockState.subtasks = [{ id: 2, title: "Sub" }];
    const res = await duplicate.POST(
      jsonReq("/api/tasks/duplicate", { task_id: 1 }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.task).toEqual({ id: 500, title: "Original (Copy)" });
    // One parent copy + one subtask copy
    expect(count("INSERT INTO tasks")).toBe(2);
  });
});

describe("logs", () => {
  test("requires task_id", async () => {
    const res = await logs.GET(new Request("http://localhost/api/tasks/logs"));
    expect(res.status).toBe(400);
  });

  test("404s when the task does not exist", async () => {
    const res = await logs.GET(
      new Request("http://localhost/api/tasks/logs?task_id=1"),
    );
    expect(res.status).toBe(404);
  });

  test("403s for a task the caller cannot access", async () => {
    mockSession.role = "participant";
    mockState.access = { user_id: "other", assigned_to: null, supervisor_id: null };
    const res = await logs.GET(
      new Request("http://localhost/api/tasks/logs?task_id=1"),
    );
    expect(res.status).toBe(403);
  });

  test("returns the assignment log", async () => {
    mockState.access = { user_id: "user-1", assigned_to: null, supervisor_id: null };
    mockState.logRows = [{ id: 1, action_type: "TASK_CREATED" }];
    const res = await logs.GET(
      new Request("http://localhost/api/tasks/logs?task_id=1"),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.logs).toHaveLength(1);
  });
});

describe("notify-deadlines", () => {
  const original = process.env.CRON_SECRET;

  beforeAll(() => {
    process.env.CRON_SECRET = "test-secret";
  });
  afterAll(() => {
    process.env.CRON_SECRET = original;
  });

  test("refuses a request without the cron secret", async () => {
    const res = await deadlines.POST(
      new Request("http://localhost/api/tasks/notify-deadlines", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  test("notifies the assignee of each task due within 24 hours", async () => {
    mockState.dueTasks = [
      {
        id: 7,
        title: "Due soon",
        assigned_to: "user-9",
        user_id: "user-1",
        end_date: new Date(Date.now() + 3600000).toISOString(),
      },
    ];
    const res = await deadlines.POST(
      new Request("http://localhost/api/tasks/notify-deadlines", {
        method: "POST",
        headers: { "x-cron-secret": "test-secret" },
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, notified: 1 });
    const notif = executedQueries.find((query) =>
      query.sql.includes("INSERT INTO v2_notifications"),
    );
    expect(notif.args[0]).toBe("user-9");
  });
});
