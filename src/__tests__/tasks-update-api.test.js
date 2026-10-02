/**
 * Characterisation tests for PUT /api/tasks — the update decisions not already
 * covered by tasks-api.test.js (which pins the date rules, the cascade, the
 * carry-over safety and the project reset).
 *
 * This suite pins the lock guards, the status/strict-owner rules, the blocker
 * force flag, and the assignment branches (un-assign / self-assign / pending
 * assignment). The model layer is mocked.
 */

const mockModels = {
  getActiveBlockersForTaskWithTitle: jest.fn(async () => ({ rows: [] })),
  getActiveBlockersOnSubtasks: jest.fn(async () => ({ rows: [] })),
  getProjectMembership: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  insertProjectApprovalRequest: jest.fn(),
  getPendingAssignmentId: jest.fn(async () => ({ rows: [] })),
  insertTaskAssignment: jest.fn(),
  getContactNameByCid: jest.fn(async () => ({ rows: [] })),
  insertNotification: jest.fn(),
  getIntentResponsibleId: jest.fn(async () => ({ rows: [] })),
  completeSubtasks: jest.fn(async () => ({ rowsAffected: 0 })),
  getActiveSuperAdminCids: jest.fn(async () => ({ rows: [] })),
  insertNotificationWithCreatedAt: jest.fn(),
  countIncompleteSubtasks: jest.fn(async () => ({ rows: [{ total: 1 }] })),
  getActiveBlockersForTask: jest.fn(async () => ({ rows: [] })),
  markTaskCompleted: jest.fn(async () => ({ rowsAffected: 0 })),
  reopenCompletedTask: jest.fn(),
  reopenCompletedSubtasks: jest.fn(),
  updateTaskFields: jest.fn(),
  incrementTaskRescheduleCount: jest.fn(),
  insertTaskAuditLog: jest.fn(),
  updateTaskEndDate: jest.fn(),
  getTaskEndDateRowById: jest.fn(async () => ({ rows: [] })),
};

const mockTask = { rows: [] };
const mockFacade = {
  getTaskById: jest.fn(async () => mockTask.task || null),
  getTaskTitleById: jest.fn(async () => "Task"),
  getTaskEndDateById: jest.fn(async () => null),
};

jest.mock("@/models/tasks", () => ({ ...mockModels, ...mockFacade }));
jest.mock("@/models/taskCarryover", () => ({
  completeCarryoverAncestors: jest.fn(async () => {}),
}));
jest.mock("@/models/contactGroups", () => ({
  validateTaskAssignment: jest.fn(async () => ({ allowed: true })),
}));
jest.mock("@/models/standupUpsert", () => ({
  rebuildStandupTasks: jest.fn(async () => {}),
}));
jest.mock("@/models/taskAudit", () => ({
  logTaskEvent: jest.fn(async () => {}),
  ACTION_TYPES: {
    TASK_CREATED: "created",
    TASK_UPDATED: "updated",
    TASK_COMPLETED: "completed",
    TASK_CARRIED_OVER: "carried_over",
    TASK_ASSIGNED: "assigned",
  },
}));
jest.mock("@/services/tasks/auditLog", () => ({
  logAuditEvent: jest.fn(async () => {}),
  isTaskLocked: jest.fn(async () => false),
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [], rowsAffected: 1 })) },
  initDb: jest.fn(async () => true),
}));

const mockSession = { cid: "user-1", name: "Staff One", role: "staff" };
jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => mockSession),
}));

const { validateTaskAssignment } = require("@/models/contactGroups");
const { isTaskLocked } = require("@/services/tasks/auditLog");
const { PUT } = require("@/app/api/tasks/route");
const readJson = (res) => res.json();
const jsonReq = (body) =>
  new Request("http://localhost/api/tasks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const ownTask = (over = {}) => ({
  id: 1,
  user_id: "user-1",
  assigned_to: null,
  supervisor_id: null,
  status: "pending",
  title: "Task",
  description: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.cid = "user-1";
  mockSession.role = "staff";
  mockTask.task = ownTask();
  isTaskLocked.mockResolvedValue(false);
  mockModels.getProjectMembership.mockResolvedValue({ rows: [{ id: 1 }] });
  mockModels.getPendingAssignmentId.mockResolvedValue({ rows: [] });
  validateTaskAssignment.mockResolvedValue({ allowed: true });
});

describe("PUT /api/tasks — access and lock", () => {
  test("requires an id", async () => {
    const res = await PUT(jsonReq({ title: "x" }));
    expect(res.status).toBe(400);
  });

  test("a task the caller cannot access is a 403", async () => {
    mockTask.task = ownTask({ user_id: "other", assigned_to: "other2", supervisor_id: "other3" });
    const res = await PUT(jsonReq({ id: 1, title: "x" }));
    expect(res.status).toBe(403);
  });

  test("a locked task refuses a title change (403, locked)", async () => {
    isTaskLocked.mockResolvedValue(true);
    const res = await PUT(jsonReq({ id: 1, title: "New title" }));
    const data = await readJson(res);
    expect(res.status).toBe(403);
    expect(data.locked).toBe(true);
    expect(mockModels.updateTaskFields).not.toHaveBeenCalled();
  });

  test("only the creator or assignee may change the status", async () => {
    // The caller is the supervisor (so access passes) but neither creator nor assignee.
    mockTask.task = ownTask({ user_id: "owner-x", assigned_to: "assignee-x", supervisor_id: "user-1" });
    const res = await PUT(jsonReq({ id: 1, user_id: "user-1", status: "completed" }));
    expect(res.status).toBe(403);
  });

  test("a non-owner metadata change is refused after the write", async () => {
    mockTask.task = ownTask({ user_id: "owner-x", assigned_to: "assignee-x", supervisor_id: "user-1" });
    const res = await PUT(jsonReq({ id: 1, title: "New" }));
    expect(res.status).toBe(403);
    // Faithful to the original: the write happens before this final guard.
    expect(mockModels.updateTaskFields).toHaveBeenCalled();
  });

  test("no fields to update is a 400", async () => {
    const res = await PUT(jsonReq({ id: 1, user_id: "user-1" }));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/tasks — completion guards", () => {
  test("active blockers need an explicit force_complete (200, hasActiveBlockers)", async () => {
    mockModels.getActiveBlockersForTaskWithTitle.mockResolvedValue({
      rows: [{ id: 1, title: "Blocker" }],
    });
    const res = await PUT(jsonReq({ id: 1, user_id: "user-1", status: "completed" }));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.hasActiveBlockers).toBe(true);
    expect(mockModels.updateTaskFields).not.toHaveBeenCalled();
  });

  test("force_complete bypasses the blocker guard", async () => {
    mockModels.getActiveBlockersForTaskWithTitle.mockResolvedValue({
      rows: [{ id: 1, title: "Blocker" }],
    });
    const res = await PUT(
      jsonReq({ id: 1, user_id: "user-1", status: "completed", force_complete: true }),
    );
    expect(res.status).toBe(200);
    expect(mockModels.updateTaskFields).toHaveBeenCalled();
  });

  test("a completed task cannot be flipped to carried_over (409)", async () => {
    mockTask.task = ownTask({ status: "completed" });
    const res = await PUT(jsonReq({ id: 1, user_id: "user-1", status: "carried_over" }));
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/tasks — assignment branches", () => {
  test("un-assigning clears the assignee directly", async () => {
    mockTask.task = ownTask({ assigned_to: "someone" });
    const res = await PUT(jsonReq({ id: 1, user_id: "user-1", assigned_to: "" }));
    expect(res.status).toBe(200);
    const [, args] = mockModels.updateTaskFields.mock.calls[0];
    expect(args).toContain(null);
  });

  test("self-assigning sets the assignee directly", async () => {
    const res = await PUT(jsonReq({ id: 1, user_id: "user-1", assigned_to: "user-1" }));
    expect(res.status).toBe(200);
    const [fields] = mockModels.updateTaskFields.mock.calls[0];
    expect(fields).toContain("assigned_to = ?");
    expect(mockModels.insertTaskAssignment).not.toHaveBeenCalled();
  });

  test("assigning to another opens a pending assignment (assigned_to not set)", async () => {
    const res = await PUT(jsonReq({ id: 1, user_id: "user-1", assigned_to: "other" }));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, message: "Pending assignment created" });
    expect(mockModels.insertTaskAssignment).toHaveBeenCalledWith(1, "user-1", "other");
    expect(mockModels.updateTaskFields).not.toHaveBeenCalled();
  });

  test("a contact-group denial refuses the assignment (403)", async () => {
    validateTaskAssignment.mockResolvedValue({ allowed: false, reason: "nope" });
    const res = await PUT(jsonReq({ id: 1, user_id: "user-1", assigned_to: "other" }));
    expect(res.status).toBe(403);
    expect(mockModels.insertTaskAssignment).not.toHaveBeenCalled();
  });
});
