/**
 * SECURITY — regression tests for Lot 1: venture object-level authorization,
 * and for the middleware allowlist alignment.
 *
 * Before this lot, an editor of venture A could read or destroy a row of
 * venture B simply by sending B's row id in the request, because the route only
 * proved access to the venture in the URL. These tests pin the ownership checks
 * and the middleware's public API list.
 */

const { proxy } = require("@/proxy");
const { ventureOwned } = require("@/lib/ventureOwnership");

describe("proxy — the public API allowlist matches the public pages", () => {
  const anon = (pathname) => ({
    nextUrl: { pathname },
    url: `https://app.example${pathname}`,
    cookies: { get: () => undefined },
  });

  it("lets anonymous visitors reach the public registration API", () => {
    expect(proxy(anon("/api/public/register")).status).not.toBe(401);
    expect(proxy(anon("/api/public/group-info")).status).not.toBe(401);
  });

  it("lets the public group-lookup API through without a session", () => {
    expect(proxy(anon("/api/families")).status).not.toBe(401);
  });

  it("lets the public certificate verification API through", () => {
    expect(proxy(anon("/api/verify/certificate/abc")).status).not.toBe(401);
  });

  it("still refuses an anonymous call to a private venture API", () => {
    expect(proxy(anon("/api/ventures/VNT-1/tasks")).status).toBe(401);
    expect(proxy(anon("/api/ventures/VNT-1/members")).status).toBe(401);
  });
});

describe("ventureOwned — the scope comparison", () => {
  it("accepts the venture's own id and rejects another venture's", () => {
    expect(ventureOwned({ venture_id: 7 }, 7)).toBe(true);
    expect(ventureOwned({ venture_id: "VNT-1" }, "VNT-1")).toBe(true);
    expect(ventureOwned({ venture_id: 9 }, 7)).toBe(false);
    expect(ventureOwned({ venture_id: 9 }, "VNT-1")).toBe(false);
  });

  it("refuses a row with no venture id, and any null row", () => {
    expect(ventureOwned({ id: 5 }, 7)).toBe(false);
    expect(ventureOwned(null, 7)).toBe(false);
  });
});

describe("PATCH/DELETE /api/ventures/[id]/tasks — cross-venture ids are refused", () => {
  jest.mock("@/lib/db", () => ({
    __esModule: true,
    default: { execute: jest.fn().mockResolvedValue({ rows: [] }) },
    initDb: jest.fn().mockResolvedValue(true),
  }));

  jest.mock("@/lib/auth", () => ({
    requireAuth: jest.fn().mockResolvedValue(null),
    getSession: jest.fn().mockResolvedValue({ cid: "c1", name: "Actor", role: "super_admin" }),
  }));

  jest.mock("@/lib/ventureScopedAccess", () => ({
    requireVentureScopedAccess: jest.fn().mockResolvedValue({
      session: { cid: "c1", name: "Actor", role: "super_admin" },
      path: "super-admin",
    }),
  }));

  jest.mock("@/models/ventureWorkspace", () => ({
    getVentureDbIdForTasks: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
    insertVentureTaskReview: jest.fn(),
  }));

  jest.mock("@/lib/ventureArchive", () => ({
    archiveTask: jest.fn().mockResolvedValue({ ok: true }),
  }));

  jest.mock("@/lib/ventures", () => ({
    listTasks: jest.fn().mockResolvedValue([]),
    getTask: jest.fn(),
    getMilestone: jest.fn().mockResolvedValue(null),
    createTask: jest.fn().mockResolvedValue({ id: 1 }),
    updateTask: jest.fn().mockResolvedValue({ updated: true }),
    listTaskComments: jest.fn().mockResolvedValue([]),
    addTaskComment: jest.fn(),
    deleteTaskComment: jest.fn(),
    listTaskAttachments: jest.fn().mockResolvedValue([]),
    addTaskAttachment: jest.fn(),
    deleteTaskAttachment: jest.fn(),
  }));

  const { PATCH, DELETE } = require("@/app/api/ventures/[id]/tasks/route");
  const { getTask, updateTask } = require("@/lib/ventures");
  const { archiveTask } = require("@/lib/ventureArchive");

  const ctx = { params: Promise.resolve({ id: "VNT-1" }) };
  const patchReq = (body) => ({
    url: "http://localhost/api/ventures/VNT-1/tasks?id=5",
    json: async () => body,
  });
  const deleteReq = () => ({ url: "http://localhost/api/ventures/VNT-1/tasks?id=5" });

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/models/ventureWorkspace").getVentureDbIdForTasks.mockResolvedValue({ rows: [{ id: 1 }] });
  });

  it("refuses to update a task that belongs to another venture", async () => {
    getTask.mockResolvedValue({ id: 5, venture_id: 999 });

    const res = await PATCH(patchReq({ title: "Hijacked" }), ctx);

    expect(res.status).toBe(404);
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("still updates a task that belongs to this venture", async () => {
    getTask.mockResolvedValue({ id: 5, venture_id: 1 });

    const res = await PATCH(patchReq({ title: "Fine" }), ctx);

    expect(res.status).toBe(200);
    expect(updateTask).toHaveBeenCalledWith(5, { title: "Fine" });
  });

  it("refuses to archive a task that belongs to another venture", async () => {
    getTask.mockResolvedValue({ id: 5, venture_id: 999 });

    const res = await DELETE(deleteReq(), ctx);

    expect(res.status).toBe(404);
    expect(archiveTask).not.toHaveBeenCalled();
  });
});
