/**
 * Characterisation tests for /api/blockers and /api/blockers/discuss after the
 * split into `@/services/tasks/blockers`.
 *
 * They pin the rules the routes used to hold inline: the read scope, the
 * create/resolve/edit/delete ownership rules, the closed-task guard and the
 * discussion fan-out. The model layer is mocked.
 */

const mockBlockers = {
  getBlockersForUser: jest.fn(async () => ({ rows: [] })),
  getAllBlockers: jest.fn(async () => ({ rows: [] })),
  getTaskForBlockerCheck: jest.fn(async () => ({ rows: [] })),
  createBlocker: jest.fn(async () => ({ rows: [{ id: 7 }] })),
  markTaskBlocked: jest.fn(async () => ({})),
  notifySuperAdminsOfBlocker: jest.fn(async () => ({})),
  getBlockerById: jest.fn(async () => ({ rows: [] })),
  resolveBlocker: jest.fn(async () => ({})),
  getOtherActiveBlockersForTask: jest.fn(async () => ({ rows: [] })),
  revertTaskFromBlocked: jest.fn(async () => ({})),
  updateBlockerFields: jest.fn(async () => ({})),
  deleteBlocker: jest.fn(async () => ({})),
  getBlockerDiscussions: jest.fn(async () => ({ rows: [] })),
  getBlockerForDiscussion: jest.fn(async () => ({ rows: [] })),
  createBlockerDiscussion: jest.fn(async () => ({ rows: [{ id: 3, created_at: "now" }] })),
  notifyBlockerCreatorOfDiscussion: jest.fn(async () => ({})),
  notifySuperAdminOfDiscussion: jest.fn(async () => ({})),
};

jest.mock("@/models/blockers", () => mockBlockers);
jest.mock("@/models/tasks", () => ({
  getTaskTitleById: jest.fn(async () => "Task"),
}));
jest.mock("@/services/tasks/auditLog", () => ({
  logAuditEvent: jest.fn(async () => true),
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

const mockSession = { cid: "user-1", name: "Staff One", role: "staff" };
const mockIsSupervisorOf = jest.fn(async () => false);
jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => mockSession),
  isSupervisorOf: (...args) => mockIsSupervisorOf(...args),
}));

const { logAuditEvent } = require("@/services/tasks/auditLog");
const { POST, PUT, DELETE, GET } = require("@/app/api/blockers/route");
const { POST: discussPOST } = require("@/app/api/blockers/discuss/route");

const req = (method, body) =>
  new Request("http://localhost/api/blockers", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

const jsonReq = (body) => req("POST", body);

const openTask = (over = {}) => ({
  rows: [
    {
      id: 1,
      status: "in_progress",
      user_id: "user-1",
      assigned_to: null,
      supervisor_id: null,
      ...over,
    },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.cid = "user-1";
  mockSession.role = "staff";
  mockIsSupervisorOf.mockResolvedValue(false);
  mockBlockers.getTaskForBlockerCheck.mockResolvedValue(openTask());
  mockBlockers.createBlocker.mockResolvedValue({ rows: [{ id: 7 }] });
  mockBlockers.getBlockerById.mockResolvedValue({ rows: [] });
  mockBlockers.getOtherActiveBlockersForTask.mockResolvedValue({ rows: [] });
});

describe("POST /api/blockers", () => {
  test("a missing task is a 404 and nothing is written", async () => {
    mockBlockers.getTaskForBlockerCheck.mockResolvedValue({ rows: [] });
    const res = await POST(jsonReq({ task_id: 1, user_id: "user-1", title: "B" }));
    expect(res.status).toBe(404);
    expect(mockBlockers.createBlocker).not.toHaveBeenCalled();
  });

  test("a caller who is neither owner, assignee nor supervisor is refused (403)", async () => {
    mockBlockers.getTaskForBlockerCheck.mockResolvedValue(
      openTask({ user_id: "other", assigned_to: "other2", supervisor_id: "other3" }),
    );
    const res = await POST(jsonReq({ task_id: 1, user_id: "user-1", title: "B" }));
    expect(res.status).toBe(403);
    expect(mockBlockers.createBlocker).not.toHaveBeenCalled();
  });

  test("a closed task refuses a blocker (400)", async () => {
    mockBlockers.getTaskForBlockerCheck.mockResolvedValue(openTask({ status: "completed" }));
    const res = await POST(jsonReq({ task_id: 1, user_id: "user-1", title: "B" }));
    expect(res.status).toBe(400);
    expect(mockBlockers.createBlocker).not.toHaveBeenCalled();
  });

  test("creating a blocker marks the task blocked, audits and notifies", async () => {
    const res = await POST(jsonReq({ task_id: 1, user_id: "user-1", title: "B" }));
    expect(res.status).toBe(200);
    expect(mockBlockers.createBlocker).toHaveBeenCalled();
    expect(mockBlockers.markTaskBlocked).toHaveBeenCalledWith(1);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: "blocker", action: "created" }),
    );
    expect(mockBlockers.notifySuperAdminsOfBlocker).toHaveBeenCalled();
  });
});

describe("PUT /api/blockers", () => {
  const blocker = { rows: [{ id: 5, user_id: "user-1", title: "B", task_id: 1 }] };

  test("only the creator may resolve (403)", async () => {
    mockBlockers.getBlockerById.mockResolvedValue({
      rows: [{ ...blocker.rows[0], user_id: "someone-else" }],
    });
    const res = await PUT(req("PUT", { id: 5, status: "resolved" }));
    expect(res.status).toBe(403);
    expect(mockBlockers.resolveBlocker).not.toHaveBeenCalled();
  });

  test("resolving reverts the task when no other active blocker remains", async () => {
    mockBlockers.getBlockerById.mockResolvedValue(blocker);
    mockBlockers.getOtherActiveBlockersForTask.mockResolvedValue({ rows: [] });
    const res = await PUT(req("PUT", { id: 5, status: "resolved" }));
    expect(res.status).toBe(200);
    expect(mockBlockers.resolveBlocker).toHaveBeenCalled();
    expect(mockBlockers.revertTaskFromBlocked).toHaveBeenCalledWith(1);
  });

  test("resolving keeps the task blocked while another active blocker remains", async () => {
    mockBlockers.getBlockerById.mockResolvedValue(blocker);
    mockBlockers.getOtherActiveBlockersForTask.mockResolvedValue({ rows: [{ id: 6 }] });
    await PUT(req("PUT", { id: 5, status: "resolved" }));
    expect(mockBlockers.revertTaskFromBlocked).not.toHaveBeenCalled();
  });

  test("a non-creator cannot edit the fields (403)", async () => {
    mockBlockers.getBlockerById.mockResolvedValue({
      rows: [{ ...blocker.rows[0], user_id: "someone-else" }],
    });
    const res = await PUT(req("PUT", { id: 5, title: "New" }));
    expect(res.status).toBe(403);
    expect(mockBlockers.updateBlockerFields).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/blockers", () => {
  test("a non-creator non-SA cannot delete (403)", async () => {
    mockBlockers.getBlockerById.mockResolvedValue({
      rows: [{ id: 5, user_id: "someone-else" }],
    });
    const res = await DELETE(new Request("http://localhost/api/blockers?id=5", { method: "DELETE" }));
    expect(res.status).toBe(403);
    expect(mockBlockers.deleteBlocker).not.toHaveBeenCalled();
  });

  test("the creator deletes their blocker", async () => {
    mockBlockers.getBlockerById.mockResolvedValue({ rows: [{ id: 5, user_id: "user-1" }] });
    const res = await DELETE(new Request("http://localhost/api/blockers?id=5", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect(mockBlockers.deleteBlocker).toHaveBeenCalledWith("5");
  });
});

describe("GET /api/blockers — read scope", () => {
  test("a non-SA caller viewing another without supervision is refused (403)", async () => {
    mockIsSupervisorOf.mockResolvedValue(false);
    const res = await GET(new Request("http://localhost/api/blockers?user_id=other"));
    expect(res.status).toBe(403);
    expect(mockBlockers.getAllBlockers).not.toHaveBeenCalled();
  });

  test("a supervisor reads the supervisee's blockers", async () => {
    mockIsSupervisorOf.mockResolvedValue(true);
    const res = await GET(new Request("http://localhost/api/blockers?user_id=other"));
    expect(res.status).toBe(200);
    expect(mockBlockers.getBlockersForUser).toHaveBeenCalledWith(
      "other",
      expect.objectContaining({ isSupervisor: true }),
    );
  });

  test("a super admin gets the unrestricted list", async () => {
    mockSession.role = "super_admin";
    const res = await GET(new Request("http://localhost/api/blockers?status=active"));
    expect(res.status).toBe(200);
    expect(mockBlockers.getAllBlockers).toHaveBeenCalled();
    expect(mockBlockers.getBlockersForUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/blockers/discuss", () => {
  test("a missing blocker is a 404", async () => {
    mockBlockers.getBlockerForDiscussion.mockResolvedValue({ rows: [] });
    const res = await discussPOST(jsonReq({ blocker_id: 1, sender_id: "u", body: "hi" }));
    expect(res.status).toBe(404);
  });

  test("a message notifies the creator and the super-admin bell", async () => {
    mockBlockers.getBlockerForDiscussion.mockResolvedValue({
      rows: [{ id: 1, user_id: "owner", title: "B", task_id: 1 }],
    });
    const res = await discussPOST(
      jsonReq({ blocker_id: 1, sender_id: "user-1", sender_name: "Me", body: "hi" }),
    );
    expect(res.status).toBe(200);
    expect(mockBlockers.notifyBlockerCreatorOfDiscussion).toHaveBeenCalled();
    expect(mockBlockers.notifySuperAdminOfDiscussion).toHaveBeenCalled();
  });
});
