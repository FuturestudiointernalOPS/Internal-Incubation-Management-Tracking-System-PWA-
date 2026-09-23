/**
 * PHASE 1 — the MEMO is delivered.
 *
 * The defect this locks shut: a session carried a note in the database, and the
 * screens showed it, but the founder was never TOLD what the session was about.
 * The notification sent the title, the preparation text and the meeting link —
 * not the note. So "book a session and tell the Venture why" was impossible.
 *
 * The memo is the one artefact that goes OUT (a milestone record stays in, a
 * journey report goes up). It must therefore travel with every session notice:
 * to the Venture, to the coach, and to the Lead Managers — in the message the
 * recipient reads AND in the stored template params.
 */
const mockCreateSession = jest.fn(async () => ({ id: 42 }));
const mockNotifyCoach = jest.fn(async () => true);
const mockNotifyFounders = jest.fn(async () => true);
const mockNotifyLeadManagers = jest.fn(async () => true);

const mockDb = {
  execute: jest.fn(async ({ sql }) => {
    const text = String(sql);
    if (text.includes("SELECT id, venture_id FROM ventures")) return { rows: [{ id: 7, venture_id: "VNT-TEST" }] };
    if (text.includes("SELECT id FROM ventures")) return { rows: [{ id: 7 }] };
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

jest.mock("@/lib/api/createHandler", () => ({ createHandler: (handler) => handler }));

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

jest.mock("@/lib/ventureCoach", () => ({ resolveCoachContact: jest.fn().mockResolvedValue(null) }));

jest.mock("@/lib/ventures", () => ({
  listSessions: jest.fn().mockResolvedValue([]),
  getSession: jest.fn().mockResolvedValue(null),
  createSession: (...args) => mockCreateSession(...args),
  getDeliverable: jest.fn().mockResolvedValue(null),
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
  notifyVentureCoach: (...args) => mockNotifyCoach(...args),
  notifyAndEmailVentureFounders: (...args) => mockNotifyFounders(...args),
  notifyVentureLeadManagers: (...args) => mockNotifyLeadManagers(...args),
}));

const VENTURE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const { POST } = require("@/app/api/ventures/[id]/sessions/route");
const ctx = { params: { id: VENTURE_ID } };

const MEMO = "Bring the 20 interview notes — we pick the first segment together.";

function request(body) {
  const req = new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });
  req.session = { cid: "sa-1", name: "Super", role: "super_admin" };
  return req;
}

/** The options object each notification helper was called with. */
const optsOf = (mock) => mock.mock.calls[0][1];

beforeEach(() => {
  mockCreateSession.mockClear();
  mockNotifyCoach.mockClear();
  mockNotifyFounders.mockClear();
  mockNotifyLeadManagers.mockClear();
});

async function bookSession(overrides = {}) {
  return POST(
    request({
      action: "create_session",
      title: "Customer validation review",
      description: MEMO,
      start_time: "2099-01-01T10:00:00Z",
      end_time: "2099-01-01T11:00:00Z",
      journey_stage_id: "s1",
      milestone_ref: "m1",
      coach_contact_id: "c-sarah",
      venture_facing: true,
      ...overrides,
    }),
    ctx,
  );
}

describe("Phase 1 — the memo travels with the session notice", () => {
  test("the Venture, the coach and the Lead Managers are all told what the session is for", async () => {
    const res = await bookSession();
    expect(res.status).toBe(200);

    // The Venture — the whole point of the memo.
    const founder = optsOf(mockNotifyFounders);
    expect(founder.message).toContain(MEMO);
    expect(founder.emailLines.join("\n")).toContain(MEMO);

    // The coach, who has to prepare for it.
    const coach = optsOf(mockNotifyCoach);
    expect(coach.message).toContain(MEMO);
    expect(coach.emailLines.join("\n")).toContain(MEMO);

    // The Lead Managers, who are accountable for it.
    const leadManager = optsOf(mockNotifyLeadManagers);
    expect(leadManager.message).toContain(MEMO);
    expect(leadManager.emailLines.join("\n")).toContain(MEMO);
  });

  test("the memo is stored as a template param so it can be rendered in the reader's language", async () => {
    await bookSession();
    expect(optsOf(mockNotifyFounders).params.memo).toBe(MEMO);
    expect(optsOf(mockNotifyCoach).params.memo).toBe(MEMO);
    expect(optsOf(mockNotifyLeadManagers).params.memo).toBe(MEMO);
  });

  test("the notice carries the trimmed memo, never the padded input", async () => {
    await bookSession({ description: `   ${MEMO}   ` });
    const founder = optsOf(mockNotifyFounders);
    expect(founder.message).toContain(MEMO);
    expect(founder.message).not.toMatch(/\s{3}Bring/);
    expect(optsOf(mockNotifyFounders).params.memo).toBe(MEMO);
  });

  test("a session booked without a memo is refused, so no notice ever goes out empty", async () => {
    const res = await bookSession({ description: "   " });
    expect(res.status).toBe(400);
    expect(mockNotifyFounders).not.toHaveBeenCalled();
    expect(mockNotifyCoach).not.toHaveBeenCalled();
    expect(mockNotifyLeadManagers).not.toHaveBeenCalled();
  });
});
