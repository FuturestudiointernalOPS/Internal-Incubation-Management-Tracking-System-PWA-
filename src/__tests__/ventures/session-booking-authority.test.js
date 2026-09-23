/**
 * PHASE 2 (slice 1) — BOOKING IS A MANAGER ACT.
 *
 * The defect this locks shut: a Coach is a staff member, and every staff member
 * holds `ventures.edit` from the Staff Default profile, and every Coach holds an
 * active assignment — which is exactly the combination `venture_own` scope
 * wants. So the gate let a Coach book a session, and `isStaffActorForVenture`
 * then waived the milestone gate on top, letting them book against a milestone
 * the founder could not even see. Requiring a capability that EVERYONE has
 * blocks nobody; I verified that chain before changing anything.
 *
 * The fix routes the decision through the Venture permission matrix, which is
 * the only place a responsibility is distinguished. These tests pin the four
 * things that makes true:
 *
 *   1. A delegated staff member whose `calendar.schedule` cell is denied is
 *      refused — and NOTHING is written.
 *   2. A delegated staff member whose cell is granted books normally.
 *   3. A global actor never reads the matrix at all: the gate already told us it
 *      let them through as Super Admin, and re-deriving that from role strings
 *      would be a second decision-maker.
 *   4. The Venture's own members are untouched. A founder is NOT staff, so the
 *      matrix is never consulted for them and the milestone gate still governs —
 *      the fix must not narrow anyone it was not aimed at.
 */
const mockCreateSession = jest.fn(async () => ({ id: 42 }));
const mockUpdateSession = jest.fn();
const mockCancelSession = jest.fn();
const mockRescheduleSession = jest.fn();
const mockDeleteSession = jest.fn();
let mockGetSessionRow = null;
const mockGetSession = jest.fn(async () => mockGetSessionRow);

let mockGuard = {
  session: { cid: "staff-1", name: "Coach", role: "staff" },
  path: "capability+scope",
};
let mockIsStaffActor = true;
let mockCanSchedule = false;
let mockVentureCode = "VNT-1";
let mockBookable = { ok: true };

const mockDb = {
  execute: jest.fn(async ({ sql }) => {
    const text = String(sql);
    if (text.includes("SELECT id FROM ventures")) return { rows: [{ id: 7 }] };
    if (text.includes("FROM ventures")) return { rows: [{ id: 7, venture_id: "VNT-1" }] };
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "staff-1", role: "staff" }),
  requireAuth: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/api/createHandler", () => ({ createHandler: (handler) => handler }));

jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn(async () => mockGuard),
}));

jest.mock("@/lib/ventureAuth", () => ({
  isStaffActorForVenture: jest.fn(async () => mockIsStaffActor),
}));

jest.mock("@/lib/venturePermissions", () => ({
  hasVentureCapability: jest.fn(async () => mockCanSchedule),
}));

jest.mock("@/lib/ventureOperatingPlans", () => ({
  resolveVentureCode: jest.fn(async () => mockVentureCode),
}));

jest.mock("@/lib/ventureMilestoneEngine", () => ({
  assertBookableMilestone: jest.fn(async () => mockBookable),
}));

jest.mock("@/lib/ventureCoach", () => ({
  resolveCoachContact: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/ventureEvidence", () => ({
  signSessionMaterials: jest.fn(async () => []),
}));

jest.mock("@/lib/ventures", () => ({
  listSessions: jest.fn().mockResolvedValue([]),
  getSession: (...args) => mockGetSession(...args),
  createSession: (...args) => mockCreateSession(...args),
  getDeliverable: jest.fn().mockResolvedValue(null),
  updateSession: (...args) => mockUpdateSession(...args),
  cancelSession: (...args) => mockCancelSession(...args),
  rescheduleSession: (...args) => mockRescheduleSession(...args),
  deleteSession: (...args) => mockDeleteSession(...args),
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

const { POST } = require("@/app/api/ventures/[id]/sessions/route");
const { hasVentureCapability } = require("@/lib/venturePermissions");
const { resolveVentureCode } = require("@/lib/ventureOperatingPlans");

const VENTURE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ctx = { params: Promise.resolve({ id: VENTURE_ID }) };

function book() {
  const req = new Request("http://localhost/x", {
    method: "POST",
    body: JSON.stringify({
      action: "create_session",
      title: "Customer validation review",
      description: "Bring the 20 interview notes.",
      start_time: "2099-01-01T10:00:00Z",
      end_time: "2099-01-01T11:00:00Z",
      milestone_ref: "m1",
      venture_facing: true,
    }),
  });
  req.session = mockGuard.session;
  return POST(req, ctx);
}

/** Any other action on the same route, as the same actor. */
function act(action, extra = {}) {
  const req = new Request("http://localhost/x", {
    method: "POST",
    body: JSON.stringify({ action, session_id: 7, ...extra }),
  });
  req.session = mockGuard.session;
  return POST(req, ctx);
}

beforeEach(() => {
  mockCreateSession.mockClear();
  mockUpdateSession.mockClear();
  mockCancelSession.mockClear();
  mockRescheduleSession.mockClear();
  mockDeleteSession.mockClear();
  mockGetSession.mockClear();
  mockGetSessionRow = null;
  mockGuard = {
    session: { cid: "staff-1", name: "Coach", role: "staff" },
    path: "capability+scope",
  };
  mockIsStaffActor = true;
  mockCanSchedule = false;
  mockVentureCode = "VNT-1";
  mockBookable = { ok: true };
  hasVentureCapability.mockClear();
  resolveVentureCode.mockClear();
});

describe("a Coach supports the Venture; a manager schedules it", () => {
  test("a Coach whose calendar.schedule cell is denied is refused — and nothing is written", async () => {
    mockCanSchedule = false;
    const res = await book();
    expect(res.status).toBe(403);

    const body = await res.json();
    // The guard's own denial vocabulary, so the client shows what it already
    // shows for every other permission refusal — and `missing` names the cell.
    expect(body.error).toBe("errors.insufficientPermissions");
    expect(body.missing).toEqual({ capability: "ventures.calendar.schedule" });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test("a delegated manager whose cell is granted books normally", async () => {
    mockGuard.session = { cid: "lm-1", name: "Lead", role: "staff" };
    mockCanSchedule = true;
    const res = await book();
    expect(res.status).toBe(200);
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });

  test("the matrix is asked about the right cell, for the right Venture code", async () => {
    mockGuard.session = { cid: "lm-1", name: "Lead", role: "staff" };
    mockCanSchedule = true;
    mockVentureCode = "VNT-7";
    await book();

    // Assignments store the VNT code while the route may receive a UUID; reading
    // the matrix with the raw UUID would deny every delegated manager.
    expect(resolveVentureCode).toHaveBeenCalledWith(expect.anything(), VENTURE_ID);
    const options = hasVentureCapability.mock.calls[0][1];
    expect(options).toMatchObject({
      ventureId: "VNT-7",
      contactId: "lm-1",
      area: "calendar",
      action: "schedule",
    });
  });
});

describe("the fix is scoped to delegated staff only", () => {
  test("a global actor never reads the matrix — the gate's bypass decides", async () => {
    mockGuard = {
      session: { cid: "sa-1", name: "Super", role: "super_admin" },
      path: "super-admin",
    };
    mockIsStaffActor = true;
    mockCanSchedule = false; // the matrix would say no...
    const res = await book();
    // ...but the gate already let them through as Super Admin, and that verdict
    // is the one we reuse. A second decision from role strings would drift.
    expect(res.status).toBe(200);
    expect(hasVentureCapability).not.toHaveBeenCalled();
    expect(resolveVentureCode).not.toHaveBeenCalled();
  });

  test("a founder is not staff, so the matrix is never consulted for them", async () => {
    mockIsStaffActor = false;
    mockGuard.session = { cid: "founder-1", name: "Founder", role: "member" };
    mockCanSchedule = false; // would refuse, if it were ever asked
    const res = await book();
    expect(res.status).toBe(200);
    expect(hasVentureCapability).not.toHaveBeenCalled();
  });

  test("a founder still meets the milestone gate, not the matrix", async () => {
    mockIsStaffActor = false;
    mockGuard.session = { cid: "founder-1", name: "Founder", role: "member" };
    mockBookable = { ok: false, reason: "That milestone is locked." };
    const res = await book();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("That milestone is locked.");
    expect(hasVentureCapability).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});

describe("managing the calendar is the same act as booking it", () => {
  const MANAGEMENT = [
    ["update_session", { updates: { meeting_link: "https://meet.example.com/x" } }],
    ["cancel_session", {}],
    [
      "reschedule_session",
      { start_time: "2099-02-01T10:00:00Z", end_time: "2099-02-01T11:00:00Z" },
    ],
    ["delete_session", {}],
  ];

  test.each(MANAGEMENT)(
    "a Coach denied booking is also refused %s, and nothing is written",
    async (action, extra) => {
      mockIsStaffActor = true;
      mockCanSchedule = false;
      const res = await act(action, extra);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.missing).toEqual({ capability: "ventures.calendar.schedule" });
      // The refusal must land BEFORE any write, not after.
      expect(mockUpdateSession).not.toHaveBeenCalled();
      expect(mockCancelSession).not.toHaveBeenCalled();
      expect(mockRescheduleSession).not.toHaveBeenCalled();
      expect(mockDeleteSession).not.toHaveBeenCalled();
    },
  );

  test("a granted manager may cancel", async () => {
    mockCanSchedule = true;
    mockGetSessionRow = { id: 7, title: "Review", venture_facing: false };
    const res = await act("cancel_session");
    expect(res.status).toBe(200);
    expect(mockCancelSession).toHaveBeenCalledWith(7);
  });

  test("the Super Admin console's cancel still works — global authority is unscoped", async () => {
    mockGuard = {
      session: { cid: "sa-1", name: "Super", role: "super_admin" },
      path: "super-admin",
    };
    mockIsStaffActor = true;
    mockCanSchedule = false; // the matrix would refuse...
    mockGetSessionRow = { id: 7, title: "Review", venture_facing: false };
    const res = await act("cancel_session");
    expect(res.status).toBe(200); // ...but a global actor never reads it
    expect(hasVentureCapability).not.toHaveBeenCalled();
    expect(mockCancelSession).toHaveBeenCalledWith(7);
  });
});

describe("participation is not management", () => {
  test("a Coach denied booking may still write the memo — that is what a Coach is for", async () => {
    mockIsStaffActor = true;
    mockCanSchedule = false; // denied scheduling...
    mockGetSessionRow = { id: 7, title: "Review" };
    const res = await act("update_session_note", { note: "Bring the interview notes." });
    expect(res.status).toBe(200); // ...but the memo is theirs to write
    expect(mockUpdateSession).toHaveBeenCalledWith(7, {
      description: "Bring the interview notes.",
    });
    // No calendar question was asked at all: the memo is not a calendar act.
    expect(hasVentureCapability).not.toHaveBeenCalled();
  });
});
