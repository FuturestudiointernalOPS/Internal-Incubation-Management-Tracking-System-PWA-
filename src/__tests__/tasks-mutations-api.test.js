/**
 * Characterisation tests for DELETE and PATCH /api/tasks — the two remaining
 * short handlers of the tasks monolith.
 *
 * Pins the decision paths (access, locking, the carry-over protection, the
 * accept/decline response) rather than the implementation. The model layer and
 * the infra helpers are mocked.
 */

const mockModels = {
  getTaskDeleteInfo: jest.fn(),
  getTaskStandupInfo: jest.fn(),
  deleteBlockersForTaskAndSubtasks: jest.fn(),
  deleteSubtasksForTask: jest.fn(),
  deleteTaskById: jest.fn(),
  getPendingAssignmentById: jest.fn(),
  getPendingAssignmentByTaskAndAssignee: jest.fn(),
  updateAssignmentStatus: jest.fn(),
  assignTaskToUser: jest.fn(),
  getTaskTitleRowById: jest.fn(),
  insertNotification: jest.fn(),
};

const mockAudit = {
  logAuditEvent: jest.fn(async () => {}),
  isTaskLocked: jest.fn(async () => false),
};

const mockStandup = {
  rebuildStandupTasks: jest.fn(async () => {}),
  standupUpsert: jest.fn(async () => ({ action: "upserted" })),
};

jest.mock("@/models/tasks", () => mockModels);
jest.mock("@/services/tasks/auditLog", () => mockAudit);
jest.mock("@/models/standupUpsert", () => mockStandup);
jest.mock("@/models/contactGroups", () => ({
  validateTaskAssignment: jest.fn(async () => ({ allowed: true })),
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [], rowsAffected: 1 })) },
  initDb: jest.fn(async () => true),
}));

const mockSession = { cid: "user-1", name: "Staff One", role: "staff" };

jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => mockSession),
}));

const { DELETE, PATCH } = require("@/app/api/tasks/route");
const readJson = (res) => res.json();
const jsonReq = (url, body, method) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.cid = "user-1";
  mockSession.role = "staff";
  mockAudit.isTaskLocked.mockResolvedValue(false);
  mockModels.getTaskDeleteInfo.mockResolvedValue({ rows: [] });
  mockModels.getTaskStandupInfo.mockResolvedValue({ rows: [] });
  mockModels.getPendingAssignmentById.mockResolvedValue({ rows: [] });
  mockModels.getPendingAssignmentByTaskAndAssignee.mockResolvedValue({ rows: [] });
  mockModels.getTaskTitleRowById.mockResolvedValue({ rows: [{ title: "Task" }] });
});

describe("DELETE /api/tasks", () => {
  test("requires an id", async () => {
    const res = await DELETE(new Request("http://localhost/api/tasks"));
    expect(res.status).toBe(400);
  });

  test("refuses a task the caller does not own/assign/supervise (403)", async () => {
    mockSession.role = "participant";
    mockModels.getTaskDeleteInfo.mockResolvedValue({
      rows: [{ user_id: "other", assigned_to: null, supervisor_id: null, status: "pending" }],
    });
    const res = await DELETE(new Request("http://localhost/api/tasks?id=1"));
    expect(res.status).toBe(403);
    expect(mockModels.deleteTaskById).not.toHaveBeenCalled();
  });

  test("refuses a locked task (403, locked flag)", async () => {
    mockAudit.isTaskLocked.mockResolvedValue(true);
    const res = await DELETE(new Request("http://localhost/api/tasks?id=1"));
    const data = await readJson(res);
    expect(res.status).toBe(403);
    expect(data.locked).toBe(true);
    expect(mockModels.deleteTaskById).not.toHaveBeenCalled();
  });

  test("refuses to delete a carry-over task (403)", async () => {
    mockModels.getTaskDeleteInfo.mockResolvedValue({
      rows: [{ user_id: "user-1", status: "carried_over" }],
    });
    const res = await DELETE(new Request("http://localhost/api/tasks?id=1"));
    expect(res.status).toBe(403);
    expect(mockModels.deleteTaskById).not.toHaveBeenCalled();
  });

  test("deletes the dependants then the task, audits, rebuilds the standup", async () => {
    mockModels.getTaskDeleteInfo.mockResolvedValue({
      rows: [{ user_id: "user-1", status: "pending" }],
    });
    mockModels.getTaskStandupInfo.mockResolvedValue({
      rows: [{ user_id: "user-1", title: "T", created_week: 12, created_year: 2026 }],
    });
    const res = await DELETE(new Request("http://localhost/api/tasks?id=7"));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "deleted" });
    expect(mockModels.deleteBlockersForTaskAndSubtasks).toHaveBeenCalledWith(7);
    expect(mockModels.deleteSubtasksForTask).toHaveBeenCalledWith(7);
    expect(mockModels.deleteTaskById).toHaveBeenCalledWith(7);
    expect(mockAudit.logAuditEvent).toHaveBeenCalled();
    expect(mockStandup.rebuildStandupTasks).toHaveBeenCalledWith("user-1", 12, 2026);
  });
});

describe("PATCH /api/tasks", () => {
  const pending = {
    id: 5,
    assignee_id: "user-1",
    task_id: 10,
    assigner_id: "boss",
  };

  test("requires a valid action", async () => {
    const res = await PATCH(jsonReq("/api/tasks", { action: "maybe", task_id: 10 }, "PATCH"));
    expect(res.status).toBe(400);
  });

  test("requires an assignment id or a task id", async () => {
    const res = await PATCH(jsonReq("/api/tasks", { action: "accept" }, "PATCH"));
    expect(res.status).toBe(400);
  });

  test("a missing pending assignment is a 404", async () => {
    const res = await PATCH(
      jsonReq("/api/tasks", { action: "accept", task_assignment_id: 5 }, "PATCH"),
    );
    expect(res.status).toBe(404);
  });

  test("only the assignee may respond (403)", async () => {
    mockModels.getPendingAssignmentById.mockResolvedValue({
      rows: [{ ...pending, assignee_id: "someone-else" }],
    });
    const res = await PATCH(
      jsonReq("/api/tasks", { action: "accept", task_assignment_id: 5 }, "PATCH"),
    );
    expect(res.status).toBe(403);
  });

  test("accepting marks the assignment accepted and assigns the task", async () => {
    mockModels.getPendingAssignmentById.mockResolvedValue({ rows: [pending] });
    const res = await PATCH(
      jsonReq("/api/tasks", { action: "accept", task_assignment_id: 5 }, "PATCH"),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "accepted" });
    expect(mockModels.updateAssignmentStatus).toHaveBeenCalledWith("accepted", 5);
    expect(mockModels.assignTaskToUser).toHaveBeenCalledWith("user-1", 10);
    expect(mockModels.insertNotification).toHaveBeenCalled();
    expect(mockAudit.logAuditEvent).toHaveBeenCalled();
  });

  test("declining marks the assignment declined and does not assign the task", async () => {
    mockModels.getPendingAssignmentByTaskAndAssignee.mockResolvedValue({ rows: [pending] });
    const res = await PATCH(
      jsonReq("/api/tasks", { action: "decline", task_id: 10 }, "PATCH"),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "declined" });
    expect(mockModels.updateAssignmentStatus).toHaveBeenCalledWith("declined", 5);
    expect(mockModels.assignTaskToUser).not.toHaveBeenCalled();
  });
});
