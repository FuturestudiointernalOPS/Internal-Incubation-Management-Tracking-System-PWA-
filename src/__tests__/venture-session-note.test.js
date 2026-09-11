/**
 * Contract tests — compulsory session note + milestone filing (Vinance 3).
 *
 * Guards:
 *   - create_session without a note is refused (400) and creates nothing
 *   - the note is stored on the session (description) — a session always
 *     carries its internal note
 *   - when the session is booked on a milestone, the note is filed on that
 *     milestone (venture_notes, scope_ref_type = "milestone"), so notes never
 *     exist outside a milestone
 *   - a session without milestone context does not create any note
 */

const executed = [];
const mockCreateSession = jest.fn(async (args) => {
  executed.push({ session: args });
  return { id: 42 };
});

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("SELECT venture_id FROM ventures WHERE venture_id = ? OR id::text = ?")) {
      return { rows: [{ venture_id: "VNT-TEST" }] };
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
  getSession: jest.fn().mockResolvedValue({ cid: "sa-1", name: "Super", role: "super_admin" }),
  requireAuth: jest.fn().mockResolvedValue(null),
}));

// The handler wrapper only adds auth/initDb in production; here it is a pass-through.
jest.mock("@/lib/api/createHandler", () => ({
  createHandler: (fn) => fn,
}));

jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn().mockResolvedValue({ allowed: true }),
}));

jest.mock("@/lib/ventureCoach", () => ({
  resolveCoachContact: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/ventures", () => ({
  listSessions: jest.fn().mockResolvedValue([]),
  getSession: jest.fn().mockResolvedValue(null),
  createSession: (...args) => mockCreateSession(...args),
  updateSession: jest.fn(),
  cancelSession: jest.fn(),
  rescheduleSession: jest.fn(),
  deleteSession: jest.fn(),
  addSessionNote: jest.fn(),
  recordAttendance: jest.fn(),
  createActionItem: jest.fn(),
  updateActionItem: jest.fn(),
}));

jest.mock("@/lib/ventureNotify", () => ({
  notifyVentureCoach: jest.fn().mockResolvedValue(true),
  notifyAndEmailVentureFounders: jest.fn().mockResolvedValue(true),
}));

const VENTURE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const { POST } = require("@/app/api/ventures/[id]/sessions/route");
const ctx = { params: { id: VENTURE_ID } };

function request(body) {
  const req = new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });
  req.session = { cid: "sa-1", name: "Super", role: "super_admin" };
  return req;
}

beforeEach(() => {
  executed.length = 0;
  mockCreateSession.mockClear();
});

describe("POST /api/ventures/[id]/sessions — compulsory session note", () => {
  test("a session without a note is refused", async () => {
    const res = await POST(
      request({
        action: "create_session",
        title: "Pitch deck review",
        start_time: "2099-01-01T10:00:00Z",
        end_time: "2099-01-01T11:00:00Z",
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test("a blank note is refused", async () => {
    const res = await POST(
      request({
        action: "create_session",
        title: "Pitch deck review",
        description: "   ",
        start_time: "2099-01-01T10:00:00Z",
        end_time: "2099-01-01T11:00:00Z",
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test("the note is stored on the session and filed on the milestone", async () => {
    const res = await POST(
      request({
        action: "create_session",
        title: "Customer validation review",
        description: "Review the 20 interview findings.",
        start_time: "2099-01-01T10:00:00Z",
        end_time: "2099-01-01T11:00:00Z",
        journey_stage_id: "s1",
        milestone_ref: "m1",
      }),
      ctx,
    );
    const data = await res.json();
    expect(data.success).toBe(true);

    // The session itself carries the note.
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockCreateSession.mock.calls[0][0].description).toBe("Review the 20 interview findings.");

    // And the note is filed on the milestone — never outside one.
    const noteInsert = executed.find((e) => e.sql && e.sql.includes("INSERT INTO venture_notes"));
    expect(noteInsert).toBeDefined();
    expect(noteInsert.args).toEqual(
      expect.arrayContaining(["VNT-TEST", "sa-1", "milestone", "m1", "Review the 20 interview findings."]),
    );
  });

  test("a session with no milestone context creates no note", async () => {
    await POST(
      request({
        action: "create_session",
        title: "General check-in",
        description: "Weekly progress call.",
        start_time: "2099-01-01T10:00:00Z",
        end_time: "2099-01-01T11:00:00Z",
      }),
      ctx,
    );
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(executed.find((e) => e.sql && e.sql.includes("INSERT INTO venture_notes"))).toBeUndefined();
  });
});
