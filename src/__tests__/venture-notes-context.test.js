/**
 * Contract tests — contextual notes (Vinance 3, Phase 2 slice).
 *
 * Guards:
 *   - POST /api/ventures/[id]/notes stores attachments JSONB additively
 *     (title/body/scope columns unchanged)
 *   - GET supports additive scope filters (?scope_type=&scope_id=) so object
 *     views load exactly their own notes; default (no params) is unchanged
 *   - staff-only semantics preserved (founders without assignment get 404)
 */

const executed = [];

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("SELECT venture_id FROM ventures WHERE id::text")) {
      return { rows: [{ venture_id: "VNT-TEST" }] };
    }
    if (sql.includes("FROM venture_staff_assignments WHERE venture_id = ?")) {
      return { rows: [] };
    }
    if (sql.includes("FROM venture_notes WHERE venture_id = ?")) {
      return { rows: [
        { id: 1, title: "Milestone note", body: "b", scope_ref_type: "milestone", scope_ref_id: "m1", author_name: "Staff", created_at: "2026-01-01T00:00:00Z", attachments: null },
        { id: 2, title: "Task note", body: "b2", scope_ref_type: "task", scope_ref_id: "t9", author_name: "Coach", created_at: "2026-01-02T00:00:00Z", attachments: null },
      ] };
    }
    if (sql.includes("INSERT INTO venture_notes")) {
      return { rows: [{ id: 99 }] };
    }
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  requireAuth: jest.fn().mockResolvedValue(null),
}));

const mockAuth = require("@/lib/auth");

const VENTURE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const { GET, POST } = require("@/app/api/ventures/[id]/notes/route");
const readJson = async (res) => res.json();
const ctx = { params: { id: VENTURE_ID } };

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
  mockAuth.getSession.mockReset();
  mockAuth.getSession.mockResolvedValue({ cid: "sa-1", name: "Super", role: "super_admin" });
});

describe("GET /api/ventures/[id]/notes — contextual scope filters", () => {
  test("default read is unchanged (all notes)", async () => {
    const res = await GET(new Request("http://localhost/api/ventures/VNT-TEST/notes"), ctx);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.notes.length).toBe(2);
    const q = executed.find((e) => e.sql.includes("FROM venture_notes WHERE venture_id = ?"));
    expect(q.sql).not.toContain("scope_ref_type = ?");
  });

  test("?scope_type + ?scope_id filter to exactly that object's notes", async () => {
    const res = await GET(new Request("http://localhost/api/ventures/VNT-TEST/notes?scope_type=milestone&scope_id=m1"), ctx);
    expect(res.status).toBe(200);
    const q = executed.find((e) => e.sql.includes("FROM venture_notes WHERE venture_id = ?"));
    expect(q.sql).toContain("AND scope_ref_type = ?");
    expect(q.sql).toContain("AND scope_ref_id = ?");
    expect(q.args).toEqual(["VNT-TEST", "milestone", "m1"]);
  });
});

describe("POST /api/ventures/[id]/notes — attachments", () => {
  test("stores attachments JSONB while keeping the legacy columns", async () => {
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          title: "Review context",
          body: "See the attached validation link.",
          scope_ref_type: "milestone",
          scope_ref_id: "m1",
          attachments: [{ name: "Validation link", url: "https://docs.example/validation", type: "link" }, { name: "Report.pdf", url: "/files/report.pdf", type: "application/pdf", size: 2048 }],
        }),
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.id).toBe(99);

    const insert = executed.find((e) => e.sql.includes("INSERT INTO venture_notes"));
    expect(insert.sql).toContain("attachments");
    const attachments = JSON.parse(insert.args[7]);
    expect(attachments).toEqual([
      { name: "Validation link", url: "https://docs.example/validation", type: "link", size: null },
      { name: "Report.pdf", url: "/files/report.pdf", type: "application/pdf", size: 2048 },
    ]);
  });

  test("no attachments → insert keeps the exact legacy shape", async () => {
    await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ title: "Plain", body: "Note", scope_ref_type: "journey_stage", scope_ref_id: "s1" }),
      }),
      ctx,
    );
    const insert = executed.find((e) => e.sql.includes("INSERT INTO venture_notes"));
    expect(insert.sql).not.toContain("attachments");
    expect(insert.args.length).toBe(7);
  });
});

describe("POST /api/ventures/[id]/notes — staff-only preserved", () => {
  test("founder without assignment cannot create notes (404)", async () => {
    mockAuth.getSession.mockResolvedValue({ cid: "founder-1", name: "Founder", role: "founder" });
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ title: "X", body: "Y" }),
      }),
      ctx,
    );
    if (res.status !== 404) {
      // eslint-disable-next-line no-console
      console.log("founder debug", res.status, await readJson(res));
    }
    expect(res.status).toBe(404);
  });
});
