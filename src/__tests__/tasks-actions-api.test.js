/**
 * Characterisation tests for the task action routes:
 *   src/app/api/tasks/{approve,reconcile,assignments,assignment-action}/route.js
 *
 * Pins the decision paths (statuses, bodies, which statements run), not the
 * implementation, so it stays valid after the use cases move to the service
 * layer. The db layer is mocked with SQL-substring matching.
 */

const executedQueries = [];
const mockState = {
  task: null,
  taskAccess: null,
  assignment: null,
  assignmentTask: null,
  failApprovalTable: false,
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args }) => {
      executedQueries.push({ sql, args: args || [] });

      // --- task lookups --------------------------------------------------
      if (sql === "SELECT * FROM tasks WHERE id = ?") {
        return { rows: mockState.task ? [mockState.task] : [] };
      }
      if (sql === "SELECT title FROM tasks WHERE id = ?") {
        return { rows: [{ title: mockState.task?.title || "Task" }] };
      }
      if (sql === "SELECT user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?") {
        return { rows: mockState.taskAccess ? [mockState.taskAccess] : [] };
      }
      if (sql === "SELECT context_type, context_id FROM tasks WHERE id = ?") {
        return { rows: [{ context_type: "staff", context_id: null }] };
      }

      // --- assignments ---------------------------------------------------
      if (sql === "SELECT * FROM task_assignments WHERE id = ?") {
        return { rows: mockState.assignment ? [mockState.assignment] : [] };
      }
      if (sql.includes("SELECT title, project_id, created_week, created_year FROM tasks")) {
        return { rows: mockState.assignmentTask ? [mockState.assignmentTask] : [] };
      }
      if (sql.includes("SELECT ta.*, t.title as task_title")) {
        return { rows: [{ id: 1, status: "pending", task_title: "Task" }] };
      }
      if (sql.includes("SELECT name, role FROM contacts WHERE cid = ?")) {
        return { rows: [{ name: "Assignee", role: "staff" }] };
      }
      if (sql.includes("SELECT actor_id FROM task_assignment_log")) {
        return { rows: [{ actor_id: "assigner-1" }] };
      }

      // Schema-drift simulation: the approval-request table is missing.
      if (sql.includes("UPDATE project_approval_requests")) {
        if (mockState.failApprovalTable) throw new Error("relation does not exist");
        return { rows: [], rowsAffected: 1 };
      }

      // --- writes (all default to a one-row effect) ----------------------
      return { rows: [], rowsAffected: 1 };
    }),
  },
  initDb: jest.fn(async () => true),
}));

const mockSession = { cid: "user-1", name: "Staff One", role: "staff" };

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => mockSession),
}));

jest.mock("@/models/contactGroups", () => ({
  validateTaskAssignment: jest.fn(async () => ({ allowed: true })),
}));

const { requireAuth } = require("@/lib/auth");
const { validateTaskAssignment } = require("@/models/contactGroups");

const approve = require("@/app/api/tasks/approve/route");
const reconcile = require("@/app/api/tasks/reconcile/route");
const assignments = require("@/app/api/tasks/assignments/route");
const assignmentAction = require("@/app/api/tasks/assignment-action/route");

const jsonReq = (body) =>
  new Request("http://localhost/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const getReq = (url) => new Request(`http://localhost${url}`);
const readJson = (res) => res.json();

const count = (substring) =>
  executedQueries.filter((query) => query.sql.includes(substring)).length;

beforeEach(() => {
  executedQueries.length = 0;
  mockState.task = null;
  mockState.taskAccess = null;
  mockState.assignment = null;
  mockState.assignmentTask = null;
  mockState.failApprovalTable = false;
  mockSession.cid = "user-1";
  mockSession.name = "Staff One";
  mockSession.role = "staff";
  requireAuth.mockResolvedValue(null);
  validateTaskAssignment.mockResolvedValue({ allowed: true });
});

describe("POST /api/tasks/approve", () => {
  test("requires task_id, reviewer_id and action", async () => {
    const res = await approve.POST(jsonReq({ task_id: 1 }));
    expect(res.status).toBe(400);
  });

  test("rejects an unknown action", async () => {
    const res = await approve.POST(
      jsonReq({ task_id: 1, reviewer_id: "sa", action: "maybe" }),
    );
    expect(res.status).toBe(400);
  });

  test("a missing task is a 404", async () => {
    mockState.task = null;
    const res = await approve.POST(
      jsonReq({ task_id: 1, reviewer_id: "sa", action: "approve" }),
    );
    expect(res.status).toBe(404);
  });

  test("a task that is not pending approval is a 400", async () => {
    mockState.task = { id: 1, status: "in_progress", title: "T" };
    const res = await approve.POST(
      jsonReq({ task_id: 1, reviewer_id: "sa", action: "approve" }),
    );
    expect(res.status).toBe(400);
  });

  test("approving activates the task and audits the decision", async () => {
    mockState.task = {
      id: 1,
      status: "pending_project_approval",
      title: "Needs review",
      project_id: "P1",
    };
    const res = await approve.POST(
      jsonReq({ task_id: 1, reviewer_id: "sa", action: "approve" }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "approve", taskId: 1 });
    expect(count("approved_by = ?")).toBe(1);
    expect(count("INSERT INTO audit_log")).toBe(1);
  });

  test("rejecting demotes the task to standalone and audits", async () => {
    mockState.task = {
      id: 2,
      status: "pending_project_approval",
      title: "Reject me",
      project_id: "P1",
    };
    const res = await approve.POST(
      jsonReq({
        task_id: 2,
        reviewer_id: "sa",
        action: "reject",
        reason: "duplicate",
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "reject", taskId: 2 });
    expect(count("project_id = NULL")).toBe(1);
    expect(count("INSERT INTO audit_log")).toBe(1);
  });

  test("when the approval table is missing, the write reports it (200) and is not audited", async () => {
    mockState.task = {
      id: 3,
      status: "pending_project_approval",
      title: "Schema drift",
      project_id: "P1",
    };
    mockState.failApprovalTable = true;
    const res = await approve.POST(
      jsonReq({ task_id: 3, reviewer_id: "sa", action: "approve" }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(false);
    expect(data.error).toContain("not available");
    expect(count("INSERT INTO audit_log")).toBe(0);
  });
});

describe("POST /api/tasks/reconcile", () => {
  test("requires a non-empty tasks array", async () => {
    const res = await reconcile.POST(jsonReq({ user_id: "user-1", tasks: [] }));
    expect(res.status).toBe(400);
  });

  test("a non-portfolio caller cannot reconcile somebody else's batch (403)", async () => {
    mockSession.role = "participant";
    const res = await reconcile.POST(
      jsonReq({ user_id: "someone-else", tasks: [{ id: 1, status: "completed" }] }),
    );
    expect(res.status).toBe(403);
  });

  test("reconciles a portfolio caller's batch and audits each row", async () => {
    mockState.task = { id: 1, title: "Done" };
    const res = await reconcile.POST(
      jsonReq({
        user_id: "user-1",
        user_name: "Staff One",
        tasks: [{ id: 1, status: "completed" }],
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.results).toEqual([{ id: 1, success: true, status: "completed" }]);
    expect(count("UPDATE tasks SET status = ?")).toBeGreaterThanOrEqual(1);
    expect(count("INSERT INTO audit_log")).toBe(1);
  });

  test("an invalid status is reported per row, not as a batch failure", async () => {
    const res = await reconcile.POST(
      jsonReq({
        user_id: "user-1",
        tasks: [{ id: 1, status: "exploded" }, { id: 2, status: "completed" }],
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.results[0]).toEqual({
      id: 1,
      success: false,
      error: "Invalid status: exploded",
    });
    expect(data.results[1]).toEqual({ id: 2, success: true, status: "completed" });
  });

  test("a non-portfolio caller cannot reconcile a task they do not own", async () => {
    mockSession.role = "participant";
    mockState.taskAccess = { user_id: "other", assigned_to: null, supervisor_id: null };
    const res = await reconcile.POST(
      jsonReq({
        user_id: "user-1",
        tasks: [{ id: 5, status: "completed" }],
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.results[0]).toEqual({
      id: 5,
      success: false,
      error: "Not your task",
    });
  });
});

describe("GET /api/tasks/assignments", () => {
  test("returns the assignments (pending by default)", async () => {
    const res = await assignments.GET(
      getReq("/api/tasks/assignments?assignee_id=user-1"),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.assignments).toHaveLength(1);
    const query = executedQueries.find((entry) =>
      entry.sql.includes("SELECT ta.*"),
    );
    expect(query.args).toEqual(["user-1", "pending"]);
  });

  test("a non-portfolio caller cannot ask for somebody else's (403)", async () => {
    mockSession.role = "participant";
    const res = await assignments.GET(
      getReq("/api/tasks/assignments?assignee_id=someone-else"),
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/tasks/assignments", () => {
  const pending = (over = {}) => ({
    id: 1,
    task_id: 10,
    assigner_id: "assigner-1",
    assignee_id: "user-1",
    status: "pending",
    ...over,
  });

  test("requires assignment_id and action", async () => {
    const res = await assignments.POST(jsonReq({ assignment_id: 1 }));
    expect(res.status).toBe(400);
  });

  test("an unknown assignment is a 404", async () => {
    const res = await assignments.POST(
      jsonReq({ assignment_id: 1, action: "accept" }),
    );
    expect(res.status).toBe(404);
  });

  test("a no-longer-pending assignment is a 400", async () => {
    mockState.assignment = pending({ status: "accepted" });
    const res = await assignments.POST(
      jsonReq({ assignment_id: 1, action: "accept" }),
    );
    expect(res.status).toBe(400);
  });

  test("only the assignee can respond", async () => {
    mockState.assignment = pending({ assignee_id: "not-me" });
    const res = await assignments.POST(
      jsonReq({ assignment_id: 1, action: "accept" }),
    );
    expect(res.status).toBe(403);
  });

  test("accepting points the task at its assignee and notifies", async () => {
    mockState.assignment = pending();
    mockState.assignmentTask = { title: "Do it", created_week: 34, created_year: 2026 };
    const res = await assignments.POST(
      jsonReq({ assignment_id: 1, action: "accept" }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "accepted" });
    expect(count("UPDATE task_assignments SET status = 'accepted'")).toBe(1);
    expect(count("UPDATE tasks SET assigned_to = ?")).toBe(1);
    expect(count("INSERT INTO v2_notifications")).toBe(1);
  });

  test("declining clears the assignment and notifies the assigner", async () => {
    mockState.assignment = pending();
    mockState.assignmentTask = { title: "Do it" };
    const res = await assignments.POST(
      jsonReq({ assignment_id: 1, action: "decline" }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "declined" });
    expect(count("UPDATE task_assignments SET status = 'declined'")).toBe(1);
    const notif = executedQueries.find((query) =>
      query.sql.includes("INSERT INTO v2_notifications"),
    );
    expect(notif.args[0]).toBe("assigner-1");
  });

  test("reassign requires a new assignee", async () => {
    mockState.assignment = pending();
    const res = await assignments.POST(
      jsonReq({ assignment_id: 1, action: "reassign" }),
    );
    expect(res.status).toBe(400);
  });

  test("only the assigner (or Super Admin) may reassign", async () => {
    mockState.assignment = pending({ assigner_id: "somebody-else" });
    const res = await assignments.POST(
      jsonReq({ assignment_id: 1, action: "reassign", new_assignee_id: "new-1" }),
    );
    expect(res.status).toBe(403);
  });

  test("the contact group must allow the reassignment", async () => {
    mockState.assignment = pending({ assigner_id: "user-1" });
    validateTaskAssignment.mockResolvedValue({ allowed: false, reason: "no shared group" });
    const res = await assignments.POST(
      jsonReq({ assignment_id: 1, action: "reassign", new_assignee_id: "new-1" }),
    );
    expect(res.status).toBe(403);
  });

  test("reassigning a pending assignment retires it and creates a new one", async () => {
    mockState.assignment = pending({ assigner_id: "user-1" });
    mockState.assignmentTask = { title: "Do it" };
    const res = await assignments.POST(
      jsonReq({ assignment_id: 1, action: "reassign", new_assignee_id: "new-1" }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "reassigned" });
    expect(count("UPDATE task_assignments SET status = 'declined'")).toBe(1);
    expect(count("INSERT INTO task_assignments (task_id, assigner_id, assignee_id)")).toBe(1);
    expect(count("INSERT INTO v2_notifications")).toBe(1);
  });

  test("an unknown action is a 400", async () => {
    mockState.assignment = pending();
    const res = await assignments.POST(
      jsonReq({ assignment_id: 1, action: "explode" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/tasks/assignment-action", () => {
  test("requires task_id, user_id and a known action", async () => {
    expect((await assignmentAction.POST(jsonReq({}))).status).toBe(400);
    expect(
      (
        await assignmentAction.POST(
          jsonReq({ task_id: 1, user_id: "user-1", action: "explode" }),
        )
      ).status,
    ).toBe(400);
  });

  test("a missing task is a 404", async () => {
    const res = await assignmentAction.POST(
      jsonReq({ task_id: 1, user_id: "user-1", action: "accepted" }),
    );
    expect(res.status).toBe(404);
  });

  test("only the assigned person may act", async () => {
    mockState.task = { id: 1, title: "T", assigned_to: "someone-else" };
    const res = await assignmentAction.POST(
      jsonReq({ task_id: 1, user_id: "user-1", action: "accepted" }),
    );
    expect(res.status).toBe(403);
  });

  test("accepting moves the task to in_progress and audits twice", async () => {
    mockState.task = {
      id: 1,
      title: "T",
      assigned_to: "user-1",
      status: "pending",
      project_id: "P1",
    };
    const res = await assignmentAction.POST(
      jsonReq({ task_id: 1, user_id: "user-1", action: "accepted" }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({
      success: true,
      action: "accepted",
      message: "Task accepted and moved to in_progress",
    });
    expect(count("status = 'in_progress'")).toBe(1);
    expect(count("INSERT INTO audit_log")).toBe(1);
  });

  test("declining clears the assignment and notifies the original assigner", async () => {
    mockState.task = {
      id: 1,
      title: "T",
      assigned_to: "user-1",
      status: "in_progress",
      project_id: "P1",
    };
    const res = await assignmentAction.POST(
      jsonReq({ task_id: 1, user_id: "user-1", action: "declined" }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({
      success: true,
      action: "declined",
      message: "Task declined and assignment cleared",
    });
    const notif = executedQueries.find((query) =>
      query.sql.includes("INSERT INTO v2_notifications"),
    );
    expect(notif.args[0]).toBe("assigner-1");
  });

  test("completing the assignment completes the task", async () => {
    mockState.task = {
      id: 1,
      title: "T",
      assigned_to: "user-1",
      status: "in_progress",
      project_id: "P1",
    };
    const res = await assignmentAction.POST(
      jsonReq({ task_id: 1, user_id: "user-1", action: "completed_assignment" }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({
      success: true,
      action: "completed",
      message: "Task marked as completed",
    });
    expect(count("status = 'completed'")).toBeGreaterThanOrEqual(1);
  });
});
