/**
 * Task submissions (Phase 2, D5) — submit + staff review workflow.
 *
 * Coverage:
 *  - founder can submit work (append-only version) and read history;
 *  - founders CANNOT review submissions (403);
 *  - staff review approval flips the task to "accepted";
 *  - empty submissions are rejected.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn(),
}));

jest.mock("@/lib/api/createHandler", () => ({
  __esModule: true,
  default: (fn) => fn,
  createHandler: (fn) => fn,
}));

const db = require("@/lib/db").default;
const { requireVentureAccess } = require("@/lib/ventureAuth");
const { GET, POST } = require("@/app/api/ventures/[id]/tasks/[taskId]/submissions/route");

const VENTURE_PARAM = "VNT-P2TEST";
const DB_ID = "11111111-1111-1111-1111-111111111111";

function fakeExecute() {
  db.execute.mockImplementation(async ({ sql, args = [] }) => {
    if (sql.includes("SELECT id FROM ventures WHERE venture_id = ?")) {
      return { rows: [{ id: DB_ID }] };
    }
    if (sql.includes("SELECT * FROM venture_tasks WHERE id = ?")) {
      return { rows: [{ id: 42, venture_id: DB_ID, status: "backlog", review_required: true }] };
    }
    if (sql.includes("COALESCE(MAX(version), 0) + 1")) {
      return { rows: [{ next_version: "1" }] };
    }
    if (sql.includes("RETURNING id") && sql.includes("venture_task_submissions")) {
      return { rows: [{ id: 9 }] };
    }
    if (sql.includes("FROM venture_task_submissions WHERE task_id = ? ORDER BY version ASC")) {
      return { rows: [] };
    }
    return { rows: [], rowsAffected: 1 };
  });
}

function setSession(role, cid) {
  requireVentureAccess.mockResolvedValue({ session: { role, cid, name: role } });
}

beforeEach(() => {
  jest.clearAllMocks();
  fakeExecute();
});

describe("GET /api/ventures/[id]/tasks/[taskId]/submissions", () => {
  it("returns submission history for a Venture member", async () => {
    setSession("founder", "F-1");
    const res = await GET(new Request("http://localhost/x"), { params: { id: VENTURE_PARAM, taskId: "42" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.submissions).toEqual([]);
    expect(data.latest).toBeNull();
  });

  it("404s when the task does not belong to the Venture", async () => {
    db.execute.mockImplementation(async ({ sql }) => {
      if (sql.includes("SELECT id FROM ventures WHERE venture_id = ?")) return { rows: [{ id: DB_ID }] };
      if (sql.includes("SELECT * FROM venture_tasks WHERE id = ?")) return { rows: [{ id: 42, venture_id: "OTHER-VENTURE" }] };
      return { rows: [] };
    });
    setSession("founder", "F-1");
    const res = await GET(new Request("http://localhost/x"), { params: { id: VENTURE_PARAM, taskId: "42" } });
    expect(res.status).toBe(404);
  });
});

describe("POST submit", () => {
  it("lets a founder append a submission version and moves the task to in_progress", async () => {
    setSession("founder", "F-1");
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", file_url: "https://cdn/x/report.pdf", file_name: "report.pdf", file_type: "application/pdf", notes: "20 interviews" }),
      }),
      { params: { id: VENTURE_PARAM, taskId: "42" } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.submission_id).toBe(9);

    const executed = db.execute.mock.calls.map((c) => c[0].sql);
    const insert = executed.find((s) => s.includes("INSERT INTO venture_task_submissions"));
    expect(insert).toContain("version");
    expect(executed.some((s) => s.includes("UPDATE venture_tasks SET status = 'in_progress'"))).toBe(true);
  });

  it("rejects submissions with neither a file nor notes", async () => {
    setSession("founder", "F-1");
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", file_url: "", notes: "" }),
      }),
      { params: { id: VENTURE_PARAM, taskId: "42" } },
    );
    expect(res.status).toBe(400);
  });
});

describe("POST review", () => {
  it("denies founders", async () => {
    setSession("founder", "F-1");
    db.execute.mockImplementation(async ({ sql, args = [] }) => {
      if (sql.includes("SELECT id FROM ventures WHERE venture_id = ?")) return { rows: [{ id: DB_ID }] };
      if (sql.includes("SELECT * FROM venture_tasks WHERE id = ?")) return { rows: [{ id: 42, venture_id: DB_ID }] };
      if (sql.includes("SELECT * FROM venture_task_submissions WHERE id = ? AND task_id = ?")) return { rows: [{ id: 9, task_id: 42 }] };
      return { rows: [] };
    });
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", submission_id: 9, decision: "approved" }),
      }),
      { params: { id: VENTURE_PARAM, taskId: "42" } },
    );
    expect(res.status).toBe(403);
  });

  it("lets staff approve and marks the task accepted", async () => {
    setSession("super_admin", "SA-1");
    db.execute.mockImplementation(async ({ sql, args = [] }) => {
      if (sql.includes("SELECT id FROM ventures WHERE venture_id = ?")) return { rows: [{ id: DB_ID }] };
      if (sql.includes("SELECT * FROM venture_tasks WHERE id = ?")) return { rows: [{ id: 42, venture_id: DB_ID }] };
      if (sql.includes("SELECT * FROM venture_task_submissions WHERE id = ? AND task_id = ?")) return { rows: [{ id: 9, task_id: 42 }] };
      if (sql.includes("FROM venture_task_submissions WHERE task_id = ? ORDER BY version ASC")) return { rows: [] };
      return { rows: [], rowsAffected: 1 };
    });
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", submission_id: 9, decision: "approved", comment: "Good work" }),
      }),
      { params: { id: VENTURE_PARAM, taskId: "42" } },
    );
    expect(res.status).toBe(200);
    const executed = db.execute.mock.calls.map((c) => c[0]);
    expect(executed.some((s) => s.sql.includes("SET review_decision = ?"))).toBe(true);
    const taskUpdate = executed.find((s) => s.sql.includes("UPDATE venture_tasks SET status = ?"));
    expect(taskUpdate).toBeTruthy();
    expect(taskUpdate.args[0]).toBe("accepted");
  });
});
