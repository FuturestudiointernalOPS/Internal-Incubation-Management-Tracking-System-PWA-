/**
 * Characterisation tests for GET /api/tasks (the listing read path).
 *
 * Pins the scoping decisions (own-tasks-only, the id-lookup access check, the
 * brief short-circuit, the batch enrichment) rather than the implementation, so
 * it stays valid after the read path moves to the service layer. The model layer
 * is mocked, so the assertions are about decisions, not SQL.
 */

const mockModels = {
  getTaskRowById: jest.fn(),
  getBlockersForTask: jest.fn(),
  getSubtasksForTask: jest.fn(),
  getTasksByFilters: jest.fn(),
  getBlockersForTasks: jest.fn(),
  getSubtasksForTasks: jest.fn(),
  getResourcesForTasks: jest.fn(),
  getCommentCountsForTasks: jest.fn(),
};

jest.mock("@/models/tasks", () => mockModels);

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

const { GET } = require("@/app/api/tasks/route");
const readJson = (res) => res.json();
const getReq = (url) => new Request(`http://localhost${url}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.cid = "user-1";
  mockSession.role = "staff";
  mockModels.getTaskRowById.mockResolvedValue({ rows: [] });
  mockModels.getTasksByFilters.mockResolvedValue({ rows: [] });
  mockModels.getBlockersForTask.mockResolvedValue({ rows: [] });
  mockModels.getSubtasksForTask.mockResolvedValue({ rows: [] });
  mockModels.getBlockersForTasks.mockResolvedValue({ rows: [] });
  mockModels.getSubtasksForTasks.mockResolvedValue({ rows: [] });
  mockModels.getResourcesForTasks.mockResolvedValue({ rows: [] });
  mockModels.getCommentCountsForTasks.mockResolvedValue({ rows: [] });
});

describe("GET /api/tasks — scoping", () => {
  test("a non-super-admin asking for another user's tasks is refused (403)", async () => {
    const res = await GET(getReq("/api/tasks?user_id=someone-else"));
    expect(res.status).toBe(403);
    expect(mockModels.getTasksByFilters).not.toHaveBeenCalled();
  });

  test("a non-portfolio caller cannot filter by a foreign assignee (403)", async () => {
    mockSession.role = "participant";
    const res = await GET(getReq("/api/tasks?assigned_to=someone-else"));
    expect(res.status).toBe(403);
  });

  test("a non-portfolio caller with no filter is scoped to their own tasks", async () => {
    mockSession.role = "participant";
    await GET(getReq("/api/tasks"));
    expect(mockModels.getTasksByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "self", effectiveUserId: "user-1" }),
    );
  });

  test("a portfolio caller with no filter is scoped to their own tasks by default", async () => {
    await GET(getReq("/api/tasks"));
    expect(mockModels.getTasksByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ isSuperAdmin: false, scope: "self", effectiveUserId: null }),
    );
  });

  test("a super-admin is unscoped", async () => {
    mockSession.role = "super_admin";
    await GET(getReq("/api/tasks"));
    expect(mockModels.getTasksByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ isSuperAdmin: true }),
    );
  });
});

describe("GET /api/tasks?id= — single-task lookup", () => {
  test("a missing task is a 404", async () => {
    mockModels.getTaskRowById.mockResolvedValue({ rows: [] });
    const res = await GET(getReq("/api/tasks?id=9"));
    expect(res.status).toBe(404);
  });

  test("a task the caller does not own/assign/supervise is refused (403)", async () => {
    mockSession.role = "participant";
    mockModels.getTaskRowById.mockResolvedValue({
      rows: [{ id: 9, user_id: "other", assigned_to: null, supervisor_id: null }],
    });
    const res = await GET(getReq("/api/tasks?id=9"));
    expect(res.status).toBe(403);
  });

  test("the owner gets the task with its blockers and subtasks", async () => {
    mockModels.getTaskRowById.mockResolvedValue({
      rows: [{ id: 9, user_id: "user-1", title: "T" }],
    });
    mockModels.getBlockersForTask.mockResolvedValue({ rows: [{ id: 1 }] });
    mockModels.getSubtasksForTask.mockResolvedValue({ rows: [{ id: 2 }] });
    const res = await GET(getReq("/api/tasks?id=9"));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].blockers).toEqual([{ id: 1 }]);
    expect(data.tasks[0].subtasks).toEqual([{ id: 2 }]);
    // The list path is not used for an id lookup.
    expect(mockModels.getTasksByFilters).not.toHaveBeenCalled();
  });
});

describe("GET /api/tasks — enrichment", () => {
  test("brief=true skips the blocker/subtask fan-out", async () => {
    mockModels.getTasksByFilters.mockResolvedValue({ rows: [{ id: 10 }] });
    const res = await GET(getReq("/api/tasks?brief=true"));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.tasks).toEqual([{ id: 10 }]);
    expect(mockModels.getBlockersForTasks).not.toHaveBeenCalled();
  });

  test("the full fetch attaches blockers, subtasks, resources and comment counts", async () => {
    mockModels.getTasksByFilters.mockResolvedValue({ rows: [{ id: 10 }] });
    mockModels.getBlockersForTasks.mockResolvedValue({
      rows: [{ task_id: 10, id: 1, title: "Blocker" }],
    });
    mockModels.getSubtasksForTasks.mockResolvedValue({
      rows: [{ id: 11, parent_task_id: 10 }],
    });
    mockModels.getResourcesForTasks.mockResolvedValue({
      rows: [{ task_id: 10, id: "r1", url: "http://x" }],
    });
    mockModels.getCommentCountsForTasks.mockResolvedValue({
      rows: [{ task_id: 10, cnt: "2" }],
    });

    const res = await GET(getReq("/api/tasks"));
    const data = await readJson(res);
    const task = data.tasks[0];
    expect(task.blockers).toHaveLength(1);
    expect(task.subtasks).toHaveLength(1);
    expect(task.resources).toHaveLength(1);
    expect(task.commentCount).toBe(2);
    // The subtask carries its own resources/comment count.
    expect(task.subtasks[0].resources).toEqual([]);
    expect(task.subtasks[0].commentCount).toBe(0);
  });
});
