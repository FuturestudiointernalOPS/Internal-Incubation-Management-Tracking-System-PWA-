/**
 * Contract tests — compulsory session note + milestone filing (Vinance 3).
 *
 * Guards:
 *   - create_session without a note is refused (400) and creates nothing
 *   - the note is stored on the session (description) — a session always
 *     carries its internal note
 *   - a session must belong to a milestone: without milestone_ref the request
 *     is refused (400) and creates nothing
 *   - a session must carry a parseable start_time and must start at least 30
 *     minutes in the future, otherwise 400 and nothing is created
 *   - a deliverable_id must resolve to a deliverable of the booked milestone:
 *     an unknown deliverable, or one from another milestone, is refused (400)
 *     and creates nothing
 *   - the memo is NOT copied onto the milestone: it lives on the session only,
 *     and the milestone record stays the manager's own writing
 *   - a valid session carries its trimmed note, its milestone_ref and its
 *     deliverable_id through to createSession
 */

const executed = [];
const mockCreateSession = jest.fn(async (args) => {
  executed.push({ session: args });
  return { id: 42 };
});
const mockGetDeliverable = jest.fn(async () => null);
const mockGetSession = jest.fn(async () => null);
const mockUpdateSession = jest.fn(async () => ({ updated: true }));

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

// The real guard returns { session, path } on allow — path is how a caller knows
// it was let through as Super Admin. A bare { allowed: true } is not a shape the
// gate ever produces, so the booking gate would read it as a delegated staff
// member and refuse. Mirror the contract.
jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn().mockResolvedValue({
    session: { cid: "sa-1", name: "Super", role: "super_admin" },
    path: "super-admin",
  }),
}));

jest.mock("@/lib/ventureCoach", () => ({
  resolveCoachContact: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/ventures", () => ({
  listSessions: jest.fn().mockResolvedValue([]),
  getSession: (...args) => mockGetSession(...args),
  createSession: (...args) => mockCreateSession(...args),
  getDeliverable: (...args) => mockGetDeliverable(...args),
  updateSession: (...args) => mockUpdateSession(...args),
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
  notifyVentureLeadManagers: jest.fn().mockResolvedValue(true),
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
  mockGetDeliverable.mockReset();
  mockGetDeliverable.mockResolvedValue(null);
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue(null);
  mockUpdateSession.mockClear();
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

    // The memo stays on the SESSION: it is the brief the Venture is told about,
    // and nothing is copied onto the milestone.
    expect(executed.find((e) => e.sql && e.sql.includes("INSERT INTO venture_notes"))).toBeUndefined();
  });

  test("a session without a milestone is refused", async () => {
    const res = await POST(
      request({
        action: "create_session",
        title: "General check-in",
        description: "Weekly progress call.",
        start_time: "2099-01-01T10:00:00Z",
        end_time: "2099-01-01T11:00:00Z",
      }),
      ctx,
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("A session must belong to a milestone.");
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(executed.find((e) => e.sql && e.sql.includes("INSERT INTO venture_notes"))).toBeUndefined();
  });

  test("a session without a date and time is refused", async () => {
    const res = await POST(
      request({
        action: "create_session",
        title: "Customer validation review",
        description: "Review the 20 interview findings.",
        milestone_ref: "m1",
      }),
      ctx,
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("A session date and time are required.");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test("a session starting in less than 30 minutes is refused", async () => {
    const start = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 45 * 60 * 1000).toISOString();
    const res = await POST(
      request({
        action: "create_session",
        title: "Customer validation review",
        description: "Review the 20 interview findings.",
        start_time: start,
        end_time: end,
        milestone_ref: "m1",
      }),
      ctx,
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("A session must start at least 30 minutes from now.");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test("a deliverable from another milestone is refused", async () => {
    mockGetDeliverable.mockResolvedValue({ id: "dv1", milestone_id: "m2" });
    const res = await POST(
      request({
        action: "create_session",
        title: "Customer validation review",
        description: "Review the 20 interview findings.",
        start_time: "2099-01-01T10:00:00Z",
        end_time: "2099-01-01T11:00:00Z",
        milestone_ref: "m1",
        deliverable_id: "dv1",
      }),
      ctx,
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Unknown deliverable for this milestone.");
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(executed.find((e) => e.sql && e.sql.includes("INSERT INTO venture_notes"))).toBeUndefined();
  });

  test("an unknown deliverable is refused", async () => {
    mockGetDeliverable.mockResolvedValue(null);
    const res = await POST(
      request({
        action: "create_session",
        title: "Customer validation review",
        description: "Review the 20 interview findings.",
        start_time: "2099-01-01T10:00:00Z",
        end_time: "2099-01-01T11:00:00Z",
        milestone_ref: "m1",
        deliverable_id: "dv1",
      }),
      ctx,
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Unknown deliverable for this milestone.");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test("a valid session carries the milestone and deliverable through", async () => {
    mockGetDeliverable.mockResolvedValue({ id: "dv1", milestone_id: "m1" });
    const res = await POST(
      request({
        action: "create_session",
        title: "Customer validation review",
        description: "  Review the 20 interview findings.  ",
        start_time: "2099-01-01T10:00:00Z",
        end_time: "2099-01-01T11:00:00Z",
        milestone_ref: "m1",
        deliverable_id: "dv1",
      }),
      ctx,
    );
    const data = await res.json();
    expect(data.success).toBe(true);

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockCreateSession.mock.calls[0][0].description).toBe("Review the 20 interview findings.");
    expect(mockCreateSession.mock.calls[0][0].milestoneRef).toBe("m1");
    expect(mockCreateSession.mock.calls[0][0].deliverableId).toBe("dv1");

    // ONE memo per session, and it is not copied anywhere else.
    expect(executed.find((e) => e.sql && e.sql.includes("INSERT INTO venture_notes"))).toBeUndefined();
  });
});

describe("POST /api/ventures/[id]/sessions — one editable memo, never filed elsewhere", () => {
  test("an edit without a session is refused", async () => {
    const res = await POST(request({ action: "update_session_note", note: "New text." }), ctx);
    expect(res.status).toBe(400);
  });

  test("an edit with an empty memo is refused", async () => {
    const res = await POST(request({ action: "update_session_note", session_id: 7, note: "   " }), ctx);
    expect(res.status).toBe(400);
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  test("an unknown session is refused and writes nothing", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await POST(request({ action: "update_session_note", session_id: 999, note: "New text." }), ctx);
    expect(res.status).toBe(404);
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  test("a valid edit replaces the memo on the session — the only place it lives", async () => {
    mockGetSession.mockResolvedValueOnce({ id: 7, title: "Pitch deck review", milestone_ref: "m1" });
    const res = await POST(
      request({ action: "update_session_note", session_id: 7, note: "  Sharper agenda.  " }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(mockUpdateSession).toHaveBeenCalledWith(7, { description: "Sharper agenda." });
    // Nothing is copied onto the milestone: the record there is the manager's
    // own writing, never a reflection of a Venture-facing brief.
    expect(executed.find((e) => e.sql && e.sql.includes("venture_notes"))).toBeUndefined();
  });

  test("the generic update path changes the session, never a milestone note", async () => {
    const res = await POST(
      request({ action: "update_session", session_id: 7, updates: { description: "Changed through the generic path." } }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(mockUpdateSession).toHaveBeenCalledWith(7, { description: "Changed through the generic path." });
    expect(executed.find((e) => e.sql && e.sql.includes("venture_notes"))).toBeUndefined();
  });

  test("a generic update that does not touch the memo changes nothing else", async () => {
    const res = await POST(
      request({ action: "update_session", session_id: 7, updates: { meeting_link: "https://meet.example.com/x" } }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(executed.find((e) => e.sql && e.sql.includes("venture_notes"))).toBeUndefined();
  });
});
