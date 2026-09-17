/**
 * RECORD-SCOPE ENFORCEMENT — regression contract for the contextual-role
 * hardening pass.
 *
 * Three fail-open defects are locked down here, plus two consistency fixes:
 *
 *   1. PATCH /api/submissions — a facilitator with NO assigned teams skipped
 *      the team-scope check entirely (`teamIds.length > 0` guard), so any
 *      assigned facilitator could grade any submission in the program. Empty
 *      scope must DENY, matching the GET path.
 *   2. GET /api/calendar — program scope was keyed on the platform role label
 *      (`role === 'facilitator'`). Because taking a facilitator assignment no
 *      longer mutates `contacts.role`, a `member` acting as a facilitator fell
 *      through to "no restriction" and read every program's events. Scope is
 *      now derived from the assignment/enrollment RELATIONSHIPS.
 *   3. GET /api/sessions without `program_id` listed EVERY program's sessions
 *      to any non-management session. Contextual callers must now scope the
 *      request to a program.
 *   4. POST /api/attendance — the gate was decided from the FIRST record's
 *      program while each row inserted its own `program_id`, so a batch could
 *      write attendance into a program that was never authorized.
 *   5. getLearnerCourses — suspended enrollments are no longer listed (they
 *      grant no access and the course open would 403).
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => ({ cid: "U-FAC", role: "facilitator" })),
  requireAssignmentAccess: jest.fn(async () => null),
  getFacilitatorTeamScope: jest.fn(async () => ({ scope: "none", teamIds: [] })),
  hasProgramManagementAccess: jest.fn((role) =>
    ["super_admin", "program_manager"].includes(role),
  ),
}));

jest.mock("@/models/forms", () => ({
  getSubmissionProgramId: jest.fn(async () => ({ rows: [{ program_id: "P1" }] })),
  checkSubmissionInFacilitatorTeamScope: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  getSubmissionReviewDetails: jest.fn(async () => ({ rows: [] })),
  updateSubmissionReview: jest.fn(async () => ({})),
  ensureSubmissionsRoleLockColumn: jest.fn(async () => {}),
  ensureSubmissionsTeamIdColumn: jest.fn(async () => {}),
  ensureSubmissionsTeamIdColumnForListing: jest.fn(async () => {}),
  ensureSubmissionsScoreColumn: jest.fn(async () => {}),
  ensureSubmissionsReviewedByRoleColumn: jest.fn(async () => {}),
  ensureSubmissionsUpdatedAtColumn: jest.fn(async () => {}),
  ensureSubmissionsFollowupsParticipantCidColumn: jest.fn(async () => {}),
  ensureSubmissionScoresColumn: jest.fn(async () => {}),
  ensureSubmissionEvaluationScoreColumn: jest.fn(async () => {}),
  listSubmissions: jest.fn(async () => ({ rows: [] })),
  createSubmission: jest.fn(async () => ({ rows: [] })),
  createSubmissionFollowupEvent: jest.fn(async () => ({})),
  createSubmissionFollowup: jest.fn(async () => ({})),
  createSubmissionNotification: jest.fn(async () => ({})),
  propagateSubmissionToTeamMembers: jest.fn(async () => ({})),
  updateSubmissionScoreById: jest.fn(async () => ({})),
  updateSubmissionsScoreForParticipant: jest.fn(async () => ({})),
  findMaxSubmissionVersion: jest.fn(async () => ({ rows: [] })),
  getSubmissionProgramStatus: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramSubmissionStatus: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/teams", () => ({
  getTeamForOwnershipCheck: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/workspace", () => ({
  getFacilitatorProgramScopePids: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramScopePids: jest.fn(async () => ({ rows: [] })),
  getCalendarTasksWithDates: jest.fn(async () => ({ rows: [] })),
  getCalendarPrograms: jest.fn(async () => ({ rows: [] })),
  getCalendarSessions: jest.fn(async () => ({ rows: [] })),
  getCalendarDeliverables: jest.fn(async () => ({ rows: [] })),
  getCalendarFollowups: jest.fn(async () => ({ rows: [] })),
  ensureFollowupsCreatedByColumn: jest.fn(async () => {}),
  createSession: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  listSessions: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/facilitation", () => ({
  addAttendanceDateColumn: jest.fn(async () => {}),
  addAttendanceProgramIdColumn: jest.fn(async () => {}),
  addAttendanceUpdatedAtColumn: jest.fn(async () => {}),
  createAttendanceTable: jest.fn(async () => {}),
  createAttendanceUniqueIndex: jest.fn(async () => {}),
  dedupeLegacyAttendanceRows: jest.fn(async () => {}),
  deleteAttendanceMark: jest.fn(async () => {}),
  getAttendanceSummary: jest.fn(async () => ({ rows: [] })),
  getContactsInTeams: jest.fn(async () => ({ rows: [] })),
  insertAttendanceMark: jest.fn(async () => ({})),
  listAttendance: jest.fn(async () => ({ rows: [] })),
}));

const { getSession, getFacilitatorTeamScope } = require("@/lib/auth");
const { checkSubmissionInFacilitatorTeamScope } = require("@/models/forms");
const {
  getFacilitatorProgramScopePids,
  getParticipantProgramScopePids,
  getCalendarPrograms,
  getCalendarSessions,
  listSessions,
} = require("@/models/workspace");
const { insertAttendanceMark } = require("@/models/facilitation");

const { PATCH: submissionsPATCH } = require("@/app/api/submissions/route");
const { GET: calendarGET } = require("@/app/api/calendar/route");
const { GET: sessionsGET } = require("@/app/api/sessions/route");
const { POST: attendancePOST } = require("@/app/api/attendance/route");

const jsonReq = (url, body) =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ cid: "U-FAC", role: "facilitator" });
  getFacilitatorTeamScope.mockResolvedValue({ scope: "none", teamIds: [] });
  getFacilitatorProgramScopePids.mockResolvedValue({ rows: [] });
  getParticipantProgramScopePids.mockResolvedValue({ rows: [] });
});

describe("PATCH /api/submissions — empty team scope must deny", () => {
  test("an assigned facilitator with NO teams cannot grade (403, no record check skipped)", async () => {
    getFacilitatorTeamScope.mockResolvedValueOnce({ scope: "none", teamIds: [] });

    const res = await submissionsPATCH(
      jsonReq("http://localhost/api/submissions", { id: 9, status: "approved", feedback: "ok" }),
    );

    expect(res.status).toBe(403);
    // The record predicate must not even be attempted — there is nothing to scope by.
    expect(checkSubmissionInFacilitatorTeamScope).not.toHaveBeenCalled();
  });

  test("a facilitator with teams is still checked against them", async () => {
    getFacilitatorTeamScope.mockResolvedValueOnce({ scope: "teams", teamIds: ["T1", "T2"] });

    await submissionsPATCH(
      jsonReq("http://localhost/api/submissions", { id: 9, status: "approved", feedback: "ok" }),
    );

    expect(checkSubmissionInFacilitatorTeamScope).toHaveBeenCalledWith(9, ["T1", "T2"]);
  });
});

describe("GET /api/calendar — scope follows the relationship, not the role label", () => {
  test("a member acting as a facilitator is scoped to the assigned programs", async () => {
    getSession.mockResolvedValueOnce({ cid: "U-MEMBER", role: "member" });
    getFacilitatorProgramScopePids.mockResolvedValueOnce({ rows: [{ pid: "P-A" }] });

    await calendarGET(new Request("http://localhost/api/calendar?year=2026&month=1"));

    // The program lookup must carry a 1-program restriction, not an empty one.
    expect(getCalendarPrograms).toHaveBeenCalledWith(
      expect.stringContaining("AND CAST(id AS TEXT) IN (?)"),
      ["P-A"],
    );
    expect(getCalendarSessions).toHaveBeenCalledWith(expect.stringContaining("IN (?)"), ["P-A"]);
  });

  test("a contextual caller with no relationship sees no program-scoped events", async () => {
    getSession.mockResolvedValueOnce({ cid: "U-MEMBER", role: "member" });

    await calendarGET(new Request("http://localhost/api/calendar?year=2026&month=1"));

    expect(getCalendarPrograms).toHaveBeenCalledWith(expect.any(String), ["__no_program_scope__"]);
  });

  test("management keeps the unrestricted view", async () => {
    getSession.mockResolvedValueOnce({ cid: "U-PM", role: "program_manager" });

    await calendarGET(new Request("http://localhost/api/calendar?year=2026&month=1"));

    expect(getFacilitatorProgramScopePids).not.toHaveBeenCalled();
    expect(getCalendarPrograms).toHaveBeenCalledWith("", []);
  });
});

describe("GET /api/sessions — contextual callers must scope to a program", () => {
  test("a facilitator without program_id is refused", async () => {
    const res = await sessionsGET(new Request("http://localhost/api/sessions"));
    expect(res.status).toBe(403);
    expect(listSessions).not.toHaveBeenCalled();
  });

  test("management may still list every session", async () => {
    getSession.mockResolvedValueOnce({ cid: "U-PM", role: "program_manager" });
    const res = await sessionsGET(new Request("http://localhost/api/sessions"));
    expect(res.status).toBe(200);
    expect(listSessions).toHaveBeenCalledWith(null);
  });
});

describe("POST /api/attendance — every row must belong to the authorized program", () => {
  test("a batch carrying a foreign program_id is refused before any write", async () => {
    getFacilitatorTeamScope.mockResolvedValueOnce({ scope: "all", teamIds: [] });

    const res = await attendancePOST(
      jsonReq("http://localhost/api/attendance", {
        records: [
          { session_id: "S1", participant_id: "U1", program_id: "P1", status: "present" },
          { session_id: "S2", participant_id: "U2", program_id: "OTHER", status: "present" },
        ],
      }),
    );

    expect(res.status).toBe(403);
    expect(insertAttendanceMark).not.toHaveBeenCalled();
  });
});
