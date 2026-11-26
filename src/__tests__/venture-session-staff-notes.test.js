/**
 * Session notes are STAFF COMMENTARY — a Venture must never receive them.
 *
 * Guards (regression, after the leakage was found in the engagement audit):
 *   - `get_session` returns no appended notes and no preparation notes to a
 *     viewer who is not staff, while keeping the venture-facing fields;
 *   - staff still receive the full detail (the coach panel depends on it);
 *   - `add_note` is refused for anyone who is not staff, because a founder
 *     holds `ventures.edit` (they book their own sessions) — a write gate is
 *     not an authorship rule;
 *   - `note_type` is an allowlist, so a caller cannot invent a category.
 */

const mockGetSessionService = jest.fn();
const mockAddSessionNote = jest.fn(async () => ({ id: 99 }));

const mockDb = {
  execute: jest.fn(async ({ sql }) => {
    // Venture code resolution: the route needs an id to compare against.
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

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "founder-1", name: "Founder", role: "participant" }),
}));
jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/lib/api/createHandler", () => ({
  createHandler: (handler) => handler,
}));

// Overridden per test: the shape the gate really returns.
const mockScopedAccess = jest.fn();
jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: (...args) => mockScopedAccess(...args),
}));

jest.mock("@/services/ventures/coach", () => ({
  resolveCoachContact: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/services/ventures/deliverables", () => ({
  getDeliverable: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/services/ventures/sessions", () => ({
  listSessions: jest.fn().mockResolvedValue([]),
  listSessionNotesForVenture: jest.fn().mockResolvedValue([]),
  getSession: (...args) => mockGetSessionService(...args),
  createSession: jest.fn(),
  updateSession: jest.fn(),
  cancelSession: jest.fn(),
  rescheduleSession: jest.fn(),
  deleteSession: jest.fn(),
  addSessionNote: (...args) => mockAddSessionNote(...args),
  recordAttendance: jest.fn(),
  createActionItem: jest.fn(),
  updateActionItem: jest.fn(),
}));
jest.mock("@/services/ventures/notify", () => ({
  notifyVentureCoach: jest.fn().mockResolvedValue(true),
  notifyAndEmailVentureFounders: jest.fn().mockResolvedValue(true),
  notifyVentureLeadManagers: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/services/integrations/googleCalendar", () => ({
  syncUser: jest.fn(async () => ({ ok: false })),
}));

const VENTURE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const { POST } = require("@/app/api/ventures/[id]/sessions/route");
const ctx = { params: { id: VENTURE_ID } };

const SESSION = {
  id: 7,
  venture_id: VENTURE_ID,
  title: "Strategy review",
  description: "The brief the venture was told about.",
  start_time: "2026-11-10T10:00:00Z",
  preparation_notes: "Ask about the runway.",
  notes: [{ id: 1, note_type: "coach_feedback", content: "The founder seemed unsure of the numbers." }],
  attendance: [],
  action_items: [],
};

const FOUNDER = { session: { cid: "founder-1", name: "Founder", role: "participant" }, path: "member" };
const STAFF = { session: { cid: "sa-1", name: "Super", role: "super_admin" }, path: "super-admin" };

function request(body) {
  const req = new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });
  req.session = { cid: "founder-1", name: "Founder", role: "participant" };
  return req;
}

const readJson = (res) => res.json();

beforeEach(() => {
  mockScopedAccess.mockReset();
  mockScopedAccess.mockResolvedValue(FOUNDER);
  mockGetSessionService.mockReset();
  mockGetSessionService.mockResolvedValue({ ...SESSION });
  mockAddSessionNote.mockClear();
});

describe("get_session — staff commentary stays internal", () => {
  test("a founder receives no notes and no preparation notes", async () => {
    const res = await POST(request({ action: "get_session", session_id: 7 }), ctx);
    expect(res.status).toBe(200);
    const data = await readJson(res);

    expect(data.session.notes).toBeUndefined();
    expect(data.session.preparation_notes).toBeUndefined();
    // The venture-facing record survives untouched.
    expect(data.session.description).toBe(SESSION.description);
    expect(data.session.title).toBe("Strategy review");
  });

  test("staff receive the full detail, notes included", async () => {
    mockScopedAccess.mockResolvedValue(STAFF);
    const res = await POST(request({ action: "get_session", session_id: 7 }), ctx);
    const data = await readJson(res);

    expect(data.session.notes).toHaveLength(1);
    expect(data.session.preparation_notes).toBe("Ask about the runway.");
  });
});

describe("add_note — staff authorship only", () => {
  test("a founder is refused, and nothing is written", async () => {
    const res = await POST(
      request({ action: "add_note", session_id: 7, note_type: "coach_feedback", content: "Self-authored" }),
      ctx,
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe("errors.insufficientPermissions");
    expect(mockAddSessionNote).not.toHaveBeenCalled();
  });

  test("staff may write coach feedback", async () => {
    mockScopedAccess.mockResolvedValue(STAFF);
    const res = await POST(
      request({ action: "add_note", session_id: 7, note_type: "coach_feedback", content: "Solid session." }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(mockAddSessionNote).toHaveBeenCalledWith(expect.objectContaining({ noteType: "coach_feedback" }));
  });

  test("an invented note_type is stored as a staff note", async () => {
    mockScopedAccess.mockResolvedValue(STAFF);
    await POST(
      request({ action: "add_note", session_id: 7, note_type: "board_minutes", content: "x" }),
      ctx,
    );
    expect(mockAddSessionNote).toHaveBeenCalledWith(expect.objectContaining({ noteType: "shared" }));
  });
});
