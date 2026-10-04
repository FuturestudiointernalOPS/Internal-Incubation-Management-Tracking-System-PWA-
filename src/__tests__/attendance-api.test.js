/**
 * Characterisation tests for the attendance write plan after the split into
 * `@/services/operations/attendance`.
 *
 * They pin the decisions the route used to hold inline: every row must belong to
 * the authorized program, a facilitator only writes their teams' participants
 * (an empty scope writes nothing), and non-managers are locked to today. The
 * model layer is mocked.
 */

const mockFacilitation = {
  createAttendanceTable: jest.fn(async () => {}),
  addAttendanceProgramIdColumn: jest.fn(async () => {}),
  addAttendanceDateColumn: jest.fn(async () => {}),
  addAttendanceUpdatedAtColumn: jest.fn(async () => {}),
  dedupeLegacyAttendanceRows: jest.fn(async () => {}),
  createAttendanceUniqueIndex: jest.fn(async () => {}),
  deleteAttendanceMark: jest.fn(async () => {}),
  insertAttendanceMark: jest.fn(async () => ({})),
  getContactsInTeams: jest.fn(async () => ({ rows: [] })),
  getAttendanceSummary: jest.fn(async () => ({ rows: [] })),
  listAttendance: jest.fn(async () => ({ rows: [] })),
};

jest.mock("@/models/facilitation", () => mockFacilitation);
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

const mockSession = { cid: "U-FAC", role: "facilitator" };
const mockGetFacilitatorTeamScope = jest.fn(async () => ({ scope: "all", teamIds: [] }));
jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => mockSession),
}));
jest.mock("@/server/authz/guards", () => ({
  requireAssignmentAccess: jest.fn(async () => null),
}));
jest.mock("@/server/authz/capabilities", () => ({
  hasProgramManagementAccess: jest.fn((role) =>
    ["super_admin", "program_manager"].includes(role),
  ),
}));
jest.mock("@/models/authorization/accessQueries", () => ({
  getFacilitatorTeamScope: (...args) => mockGetFacilitatorTeamScope(...args),
}));

const { POST } = require("@/app/api/attendance/route");

const jsonReq = (body) =>
  new Request("http://localhost/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.cid = "U-FAC";
  mockSession.role = "facilitator";
  mockGetFacilitatorTeamScope.mockResolvedValue({ scope: "all", teamIds: [] });
  mockFacilitation.getContactsInTeams.mockResolvedValue({ rows: [] });
});

describe("POST /api/attendance — batch program binding", () => {
  test("a batch carrying a foreign program_id is refused before any write", async () => {
    const res = await POST(
      jsonReq([
        { session_id: "S1", participant_id: "U1", program_id: "P1", status: "present" },
        { session_id: "S2", participant_id: "U2", program_id: "OTHER", status: "present" },
      ]),
    );
    expect(res.status).toBe(403);
    expect(mockFacilitation.insertAttendanceMark).not.toHaveBeenCalled();
  });

  test("a non-management batch without a program is refused (403)", async () => {
    const res = await POST(
      jsonReq([{ session_id: "S1", participant_id: "U1", status: "present" }]),
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/attendance — facilitator team scope", () => {
  test("participants outside the facilitator's teams are silently dropped", async () => {
    mockGetFacilitatorTeamScope.mockResolvedValue({ scope: "teams", teamIds: ["T1"] });
    mockFacilitation.getContactsInTeams.mockResolvedValue({ rows: [{ cid: "U1" }] });

    const res = await POST(
      jsonReq([
        { session_id: "S1", participant_id: "U1", program_id: "P1", status: "present" },
        { session_id: "S2", participant_id: "U9", program_id: "P1", status: "present" },
      ]),
    );

    expect(res.status).toBe(200);
    expect(mockFacilitation.insertAttendanceMark).toHaveBeenCalledTimes(1);
    expect(mockFacilitation.insertAttendanceMark).toHaveBeenCalledWith(
      expect.objectContaining({ participant_id: "U1" }),
    );
  });

  test("a facilitator with no team writes nothing", async () => {
    mockGetFacilitatorTeamScope.mockResolvedValue({ scope: "none", teamIds: [] });

    const res = await POST(
      jsonReq([{ session_id: "S1", participant_id: "U1", program_id: "P1", status: "present" }]),
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.upserted).toBe(0);
    expect(mockFacilitation.insertAttendanceMark).not.toHaveBeenCalled();
  });
});

describe("POST /api/attendance — today window", () => {
  test("a non-manager cannot record a far-past date (400)", async () => {
    const res = await POST(
      jsonReq([
        {
          session_id: "S1",
          participant_id: "U1",
          program_id: "P1",
          status: "present",
          date: "2000-01-01",
        },
      ]),
    );
    expect(res.status).toBe(400);
    expect(mockFacilitation.insertAttendanceMark).not.toHaveBeenCalled();
  });

  test("a super admin may backfill an old date", async () => {
    mockSession.role = "super_admin";
    const res = await POST(
      jsonReq([
        {
          session_id: "S1",
          participant_id: "U1",
          program_id: "P1",
          status: "present",
          date: "2000-01-01",
        },
      ]),
    );
    expect(res.status).toBe(200);
    expect(mockFacilitation.insertAttendanceMark).toHaveBeenCalled();
  });

  test("an empty status clears the mark without inserting", async () => {
    const res = await POST(
      jsonReq([
        { session_id: "S1", participant_id: "U1", program_id: "P1", status: "" },
      ]),
    );
    expect(res.status).toBe(200);
    expect(mockFacilitation.deleteAttendanceMark).toHaveBeenCalled();
    expect(mockFacilitation.insertAttendanceMark).not.toHaveBeenCalled();
  });
});
