/**
 * TASK DEPENDENCY GATE — the Venture cannot move blocked work forward.
 *
 * The rule these pin down:
 *   - a Venture-side actor may not start or finish a task while a task it
 *     depends on is not done — the refusal NAMES the blocker;
 *   - Future Studio staff plan ahead and are exempt (same rule as booking a
 *     session against a milestone);
 *   - a completed task frees what it was holding back, in the same request;
 *   - the board read carries each task's dependencies, so the UI can say why.
 */

const mockGetUnmet = jest.fn();
const mockSetDependencies = jest.fn();
const mockSyncBlock = jest.fn();
const mockRelease = jest.fn();
const mockEdges = jest.fn();
let mockIsStaff = false;

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn().mockResolvedValue({ rows: [] }) },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn().mockResolvedValue({ cid: "c1", name: "Actor", role: "founder" }),
}));

jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn().mockResolvedValue({
    session: { cid: "c1", name: "Actor", role: "founder" },
    path: "capability+scope",
  }),
}));

jest.mock("@/lib/ventureAuth", () => ({
  isStaffActorForVenture: jest.fn(async () => mockIsStaff),
}));

jest.mock("@/models/ventureWorkspace", () => ({
  getVentureDbIdForTasks: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
  insertVentureTaskReview: jest.fn(),
}));

jest.mock("@/lib/ventureArchive", () => ({ archiveTask: jest.fn().mockResolvedValue({ ok: true }) }));

jest.mock("@/lib/ventures", () => ({
  listTasks: jest.fn().mockResolvedValue([]),
  getTask: jest.fn().mockResolvedValue({ id: 5, venture_id: 1, title: "Task B", status: "todo", review_required: false }),
  getMilestone: jest.fn().mockResolvedValue(null),
  createTask: jest.fn().mockResolvedValue({ id: 5 }),
  updateTask: jest.fn().mockResolvedValue({ updated: true }),
  listTaskComments: jest.fn().mockResolvedValue([]),
  addTaskComment: jest.fn(),
  deleteTaskComment: jest.fn(),
  listTaskAttachments: jest.fn().mockResolvedValue([]),
  addTaskAttachment: jest.fn(),
  deleteTaskAttachment: jest.fn(),
  getUnmetTaskDependencies: (...args) => mockGetUnmet(...args),
  setTaskDependencies: (...args) => mockSetDependencies(...args),
  syncTaskBlockState: (...args) => mockSyncBlock(...args),
  releaseTasksBlockedBy: (...args) => mockRelease(...args),
  listVentureTaskDependencyEdges: (...args) => mockEdges(...args),
}));

const { GET, PATCH } = require("@/app/api/ventures/[id]/tasks/route");
const { getTask, updateTask, listTasks } = require("@/lib/ventures");

const ctx = { params: Promise.resolve({ id: "VNT-1" }) };
const patchReq = (body) => ({ url: "http://localhost/api/ventures/VNT-1/tasks?id=5", json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  mockIsStaff = false;
  mockGetUnmet.mockResolvedValue([]);
  mockSetDependencies.mockResolvedValue({ success: true, count: 0 });
  mockSyncBlock.mockResolvedValue({ status: "todo" });
  mockRelease.mockResolvedValue({ released: [] });
  mockEdges.mockResolvedValue([]);
  getTask.mockResolvedValue({ id: 5, venture_id: 1, title: "Task B", status: "todo", review_required: false });
  updateTask.mockResolvedValue({ updated: true });
});

describe("the hard gate — a blocked task cannot move forward for the Venture", () => {
  test("a blocked task refuses to start, and NAMES the blocker", async () => {
    mockGetUnmet.mockResolvedValue([{ id: 9, title: "Identify ICPs", status: "in_progress" }]);
    const res = await PATCH(patchReq({ status: "in_progress" }), ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Identify ICPs");
    expect(body.blocked_by).toEqual(["Identify ICPs"]);
    expect(updateTask).not.toHaveBeenCalled();
  });

  test("a blocked task refuses to be finished, too", async () => {
    mockGetUnmet.mockResolvedValue([{ id: 9, title: "Identify ICPs", status: "in_progress" }]);
    const res = await PATCH(patchReq({ status: "done" }), ctx);
    expect(res.status).toBe(409);
    expect(updateTask).not.toHaveBeenCalled();
  });

  test("Future Studio staff plan ahead — the same move is allowed", async () => {
    mockIsStaff = true;
    mockGetUnmet.mockResolvedValue([{ id: 9, title: "Identify ICPs", status: "in_progress" }]);
    const res = await PATCH(patchReq({ status: "in_progress" }), ctx);
    expect(res.status).toBe(200);
    expect(updateTask).toHaveBeenCalled();
  });

  test("parking a task (todo / blocked) is never gated", async () => {
    mockGetUnmet.mockResolvedValue([{ id: 9, title: "Identify ICPs", status: "in_progress" }]);
    const res = await PATCH(patchReq({ status: "blocked" }), ctx);
    expect(res.status).toBe(200);
    expect(updateTask).toHaveBeenCalledWith(5, { status: "blocked" });
  });

  test("an unblocked task moves freely", async () => {
    const res = await PATCH(patchReq({ status: "in_progress" }), ctx);
    expect(res.status).toBe(200);
  });
});

describe("editing dependencies from the task form", () => {
  test("the picked blockers are saved, then the task's blocked state follows", async () => {
    mockGetUnmet.mockResolvedValue([]);
    const res = await PATCH(patchReq({ blocked_by: [9, "10"] }), ctx);
    expect(res.status).toBe(200);
    expect(mockSetDependencies).toHaveBeenCalledWith({ ventureId: 1, taskId: 5, blockedByTaskIds: [9, "10"] });
    expect(mockSyncBlock).toHaveBeenCalledWith({ ventureId: 1, taskId: 5 });
  });

  test("a refused set (a loop) is reported and nothing else is written", async () => {
    mockSetDependencies.mockRejectedValueOnce(new Error("Circular dependency detected."));
    const res = await PATCH(patchReq({ blocked_by: [9] }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/circular/i);
    expect(updateTask).not.toHaveBeenCalled();
  });

  test("a completion frees the tasks it was blocking, in the same request", async () => {
    mockIsStaff = true;
    const res = await PATCH(patchReq({ status: "done" }), ctx);
    expect(res.status).toBe(200);
    expect(mockRelease).toHaveBeenCalledWith({ ventureId: 1, blockerTaskId: 5 });
  });
});

describe("the board read carries each task's dependencies", () => {
  test("a task held by an unfinished blocker is flagged, with the blocker's name", async () => {
    listTasks.mockResolvedValue([
      { id: 5, title: "Task B", status: "blocked", is_archived: false },
      { id: 9, title: "Identify ICPs", status: "in_progress", is_archived: false },
    ]);
    mockEdges.mockResolvedValue([{ source_id: "9", target_id: "5" }]);
    const res = await GET({ url: "http://localhost/api/ventures/VNT-1/tasks" }, ctx);
    const body = await res.json();
    const target = body.tasks.find((task) => task.id === 5);
    expect(target.blocked_by_ids).toEqual(["9"]);
    expect(target.dependency_blocked).toBe(true);
    expect(target.blocked_by_titles).toEqual(["Identify ICPs"]);
  });

  test("a dependency that is done no longer flags the task", async () => {
    listTasks.mockResolvedValue([
      { id: 5, title: "Task B", status: "todo", is_archived: false },
      { id: 9, title: "Identify ICPs", status: "done", is_archived: false },
    ]);
    mockEdges.mockResolvedValue([{ source_id: "9", target_id: "5" }]);
    const res = await GET({ url: "http://localhost/api/ventures/VNT-1/tasks" }, ctx);
    const body = await res.json();
    const target = body.tasks.find((task) => task.id === 5);
    expect(target.dependency_blocked).toBe(false);
  });
});
