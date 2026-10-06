/**
 * Characterisation tests for POST /api/tasks — the creation decisions.
 *
 * Complements tasks-api.test.js (which pins the date validation): this suite
 * pins the scoping, the project/category fallbacks, the closed-project and
 * Super-Admin guards, the contact-group gate, the pending-assignment path and
 * the supervisor management gate. The model layer is mocked.
 */

const mockModels = {
  getParentProjectCategory: jest.fn(async () => ({ rows: [] })),
  getProjectStatus: jest.fn(async () => ({ rows: [] })),
  getProjectOwnerId: jest.fn(async () => ({ rows: [] })),
  getSuperAdminContact: jest.fn(async () => ({ rows: [] })),
  createTask: jest.fn(async () => ({ rows: [{ id: 42 }] })),
  countIncompleteSubtasks: jest.fn(async () => ({ rows: [{ total: 1 }] })),
  getActiveBlockersForTask: jest.fn(async () => ({ rows: [] })),
  markTaskCompleted: jest.fn(),
  reopenCompletedTask: jest.fn(),
  getActiveSuperAdmins: jest.fn(async () => ({ rows: [] })),
  insertNotificationWithCreatedAt: jest.fn(),
  getContactRoleByCid: jest.fn(async () => ({ rows: [{ role: "staff" }] })),
  insertTaskAssignment: jest.fn(),
  insertNotification: jest.fn(),
  getContactNameByCid: jest.fn(async () => ({ rows: [] })),
  updateTaskEndDate: jest.fn(),
};

jest.mock("@/models/contactGroups", () => ({
  validateTaskAssignment: jest.fn(async () => ({ allowed: true })),
}));
jest.mock("@/models/tasks", () => ({
  ...mockModels,
  getTaskTitleById: jest.fn(async () => "Parent"),
  getTaskEndDateById: jest.fn(async () => null),
}));
jest.mock("@/models/standupUpsert", () => ({ standupUpsert: jest.fn(async () => ({})) }));
jest.mock("@/models/taskAudit", () => ({
  logTaskEvent: jest.fn(async () => {}),
  ACTION_TYPES: { TASK_CREATED: "created", TASK_UPDATED: "updated" },
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
jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => mockSession),
}));

const { validateTaskAssignment } = require("@/models/contactGroups");
const { POST } = require("@/app/api/tasks/route");
const jsonReq = (body) =>
  new Request("http://localhost/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const base = {
  title: "A task",
  created_week: 20,
  created_year: 2026,
};

const createdWith = () => mockModels.createTask.mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.cid = "user-1";
  mockSession.role = "staff";
  mockModels.createTask.mockResolvedValue({ rows: [{ id: 42 }] });
  mockModels.getSuperAdminContact.mockResolvedValue({ rows: [] });
  mockModels.getProjectStatus.mockResolvedValue({ rows: [] });
  mockModels.getProjectOwnerId.mockResolvedValue({ rows: [] });
  mockModels.getContactRoleByCid.mockResolvedValue({ rows: [{ role: "staff" }] });
  validateTaskAssignment.mockResolvedValue({ allowed: true });
});

describe("POST /api/tasks — scoping", () => {
  test("requires user_id, title, created_week and created_year", async () => {
    const res = await POST(jsonReq({ title: "x" }));
    expect(res.status).toBe(400);
  });

  test("a participant creating for another user is pinned to themselves", async () => {
    mockSession.role = "participant";
    const res = await POST(jsonReq({ ...base, user_id: "someone-else" }));
    expect(res.status).toBe(200);
    expect(createdWith().user_id).toBe("user-1");
  });

  test("a participant's supervisor_id is ignored (management field)", async () => {
    mockSession.role = "participant";
    await POST(jsonReq({ ...base, user_id: "user-1", supervisor_id: "boss" }));
    expect(createdWith().supervisor_id).toBeNull();
  });

  test("a staff caller's supervisor_id is honoured", async () => {
    await POST(jsonReq({ ...base, user_id: "user-1", supervisor_id: "boss" }));
    expect(createdWith().supervisor_id).toBe("boss");
  });
});

describe("POST /api/tasks — project rules", () => {
  test("a task with neither project nor category defaults to General", async () => {
    await POST(jsonReq({ ...base, user_id: "user-1" }));
    expect(createdWith().category).toBe("General");
  });

  test("a sub-task inherits the parent's project and category", async () => {
    mockModels.getParentProjectCategory.mockResolvedValue({
      rows: [{ project_id: "P9", category: "Ops" }],
    });
    await POST(jsonReq({ ...base, user_id: "user-1", parent_task_id: 5 }));
    expect(createdWith().project_id).toBe("P9");
    expect(createdWith().category).toBe("Ops");
  });

  test("creating on a closed project is refused (400)", async () => {
    mockModels.getProjectStatus.mockResolvedValue({ rows: [{ status: "Closed" }] });
    const res = await POST(jsonReq({ ...base, user_id: "user-1", project_id: "P1" }));
    expect(res.status).toBe(400);
    expect(mockModels.createTask).not.toHaveBeenCalled();
  });
});

describe("POST /api/tasks — assignment", () => {
  test("assigning to a Super Admin is refused (400)", async () => {
    mockModels.getSuperAdminContact.mockResolvedValue({ rows: [{ cid: "sa" }] });
    const res = await POST(
      jsonReq({ ...base, user_id: "user-1", assigned_to: "sa" }),
    );
    expect(res.status).toBe(400);
  });

  test("assigning to somebody else opens a pending assignment (assigned_to stays null)", async () => {
    const res = await POST(
      jsonReq({ ...base, user_id: "user-1", assigned_to: "other" }),
    );
    expect(res.status).toBe(200);
    expect(createdWith().assigned_to).toBeNull();
    expect(mockModels.insertTaskAssignment).toHaveBeenCalledWith(42, "user-1", "other");
    expect(mockModels.insertNotification).toHaveBeenCalled();
  });

  test("a contact-group denial refuses the assignment (403)", async () => {
    validateTaskAssignment.mockResolvedValue({ allowed: false, reason: "nope" });
    const res = await POST(
      jsonReq({ ...base, user_id: "user-1", assigned_to: "other" }),
    );
    expect(res.status).toBe(403);
    expect(mockModels.createTask).not.toHaveBeenCalled();
  });

  test("an unassigned project task defaults to the project owner (as a pending assignment)", async () => {
    mockModels.getProjectOwnerId.mockResolvedValue({ rows: [{ owner_id: "owner-1" }] });
    await POST(jsonReq({ ...base, user_id: "user-1", project_id: "P1" }));
    // The owner is somebody else, so the task opens a pending assignment rather
    // than being assigned directly.
    expect(createdWith().assigned_to).toBeNull();
    expect(mockModels.insertTaskAssignment).toHaveBeenCalledWith(42, "user-1", "owner-1");
  });
});
