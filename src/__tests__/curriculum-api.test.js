/**
 * Characterisation tests for the program curriculum API
 * (src/app/api/pm/curriculum/route.js).
 *
 * Pins the action vocabulary (add_session with its conflict guard,
 * add_requirement, send_reminder, toggle_status, the field update and the
 * delete cascade) rather than the implementation, so the suite stays valid
 * after the use cases move to `@/services/programs/curriculum`. The model layer
 * and the scope guard are mocked, so the assertions are about decisions.
 */

const mockModels = {
  addRequirementAssigneeIdColumn: jest.fn(),
  addRequirementAssigneeTypeColumn: jest.fn(),
  addRequirementResourceLabelColumn: jest.fn(),
  addRequirementResourceUrlColumn: jest.fn(),
  addSessionRequirement: jest.fn(),
  addSessionTimezoneColumn: jest.fn(),
  addSessionVersionColumn: jest.fn(),
  addWeeklyReportAttachmentTypeColumn: jest.fn(),
  addWeeklyReportAttachmentUrlColumn: jest.fn(),
  buildSessionFieldUpdate: jest.fn(),
  countActiveParticipantsForProgram: jest.fn(),
  createAttendanceRequirement: jest.fn(),
  createRequirement: jest.fn(),
  createSession: jest.fn(),
  createSessionVersionsTable: jest.fn(),
  deleteAttendanceForSession: jest.fn(),
  deleteRequirement: jest.fn(),
  deleteRequirementsForSession: jest.fn(),
  deleteSession: jest.fn(),
  findSessionScheduleConflict: jest.fn(),
  findSessionScheduleConflictExcludingId: jest.fn(),
  getRequirementProgramId: jest.fn(),
  getSessionExtraMaterials: jest.fn(),
  getSessionProgramId: jest.fn(),
  getSessionRowById: jest.fn(),
  getSessionSchedule: jest.fn(),
  insertSessionVersion: jest.fn(),
  runSessionFieldUpdate: jest.fn(),
  setDeliverableCompletion: jest.fn(),
  setSessionTeam: jest.fn(),
  setSessionVersion: jest.fn(),
  updateRequirement: jest.fn(),
  updateSession: jest.fn(),
  updateSessionExtraMaterials: jest.fn(),
  updateSessionStatus: jest.fn(),
  ensureWeeklyReportSchema: jest.fn(),
  listWeeklyReports: jest.fn(),
  upsertWeeklyReport: jest.fn(),
};

jest.mock("@/models/curriculum", () => mockModels);
jest.mock("@/models/kpi-progress", () => ({
  listKpiNamesForPrograms: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/kpi-progress", () => ({
  recalculateKpiProgress: jest.fn(async () => ({})),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "USR_1", name: "PM One" })),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/programScopedAccess", () => ({
  requireProgramScope: jest.fn(async () => null),
}));

const { POST, PUT, DELETE } = require("@/app/api/pm/curriculum/route");

const jsonReq = (body, method) =>
  new Request("http://localhost/api/pm/curriculum", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const readJson = (res) => res.json();

beforeEach(() => {
  jest.clearAllMocks();
  mockModels.getSessionProgramId.mockResolvedValue({ rows: [{ program_id: "P1" }] });
  mockModels.getRequirementProgramId.mockResolvedValue({ rows: [{ program_id: "P1" }] });
  mockModels.findSessionScheduleConflict.mockResolvedValue({ rows: [] });
  mockModels.findSessionScheduleConflictExcludingId.mockResolvedValue({ rows: [] });
  mockModels.createSession.mockResolvedValue({ rows: [{ id: 42 }] });
  mockModels.createRequirement.mockResolvedValue({ rows: [{ id: 7 }] });
  mockModels.countActiveParticipantsForProgram.mockResolvedValue({ rows: [{ cnt: 3 }] });
  mockModels.buildSessionFieldUpdate.mockReturnValue({
    sql: "UPDATE v2_sessions SET title = ? WHERE id = ?",
    args: ["x", 5],
  });
  mockModels.getSessionSchedule.mockResolvedValue({ rows: [] });
  mockModels.getSessionRowById.mockResolvedValue({ rows: [] });
  mockModels.getSessionExtraMaterials.mockResolvedValue({ rows: [] });
});

describe("POST /api/pm/curriculum — add_session", () => {
  test("an overlapping session is refused (409) and nothing is created", async () => {
    mockModels.findSessionScheduleConflict.mockResolvedValue({
      rows: [{ title: "Clash" }],
    });
    const res = await POST(
      jsonReq(
        {
          program_id: "P1",
          action: "add_session",
          scheduled_date: "2026-01-01",
          start_time: "09:00",
          end_time: "10:00",
        },
        "POST",
      ),
    );
    expect(res.status).toBe(409);
    expect(mockModels.createSession).not.toHaveBeenCalled();
  });

  test("a created session also gets its Attendance requirement and deliverables", async () => {
    const res = await POST(
      jsonReq(
        {
          program_id: "P1",
          action: "add_session",
          title: "Session 1",
          scheduled_date: "2026-01-01",
          start_time: "09:00",
          end_time: "10:00",
          requirements: [{ title: "Deliverable 1" }],
        },
        "POST",
      ),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, id: 42 });
    expect(mockModels.createAttendanceRequirement).toHaveBeenCalled();
    expect(mockModels.addSessionRequirement).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/pm/curriculum — other actions", () => {
  test("add_requirement returns the new id", async () => {
    const res = await POST(
      jsonReq({ program_id: "P1", action: "add_requirement", title: "D", session_id: 42 }, "POST"),
    );
    expect(res.status).toBe(200);
    expect((await readJson(res)).id).toBe(7);
  });

  test("send_reminder reports the active participant count", async () => {
    const res = await POST(jsonReq({ program_id: "P1", action: "send_reminder" }, "POST"));
    expect((await readJson(res)).sent).toBe(3);
  });

  test("send_reminder falls back to 112 when the count is unavailable", async () => {
    mockModels.countActiveParticipantsForProgram.mockRejectedValue(new Error("nope"));
    const res = await POST(jsonReq({ program_id: "P1", action: "send_reminder" }, "POST"));
    expect((await readJson(res)).sent).toBe(112);
  });

  test("an unknown action is refused (400)", async () => {
    const res = await POST(jsonReq({ program_id: "P1", action: "nope" }, "POST"));
    expect(res.status).toBe(400);
  });

  test("toggle_status resolves the program from the session record", async () => {
    const res = await POST(
      jsonReq({ program_id: "P1", action: "toggle_status", id: 99, status: "done" }, "POST"),
    );
    expect(res.status).toBe(200);
    expect(mockModels.getSessionProgramId).toHaveBeenCalledWith(99);
    expect(mockModels.updateSessionStatus).toHaveBeenCalledWith("done", 99);
  });
});

describe("PUT /api/pm/curriculum — field update", () => {
  test("a valid field update writes the snapshot then the row", async () => {
    const res = await PUT(jsonReq({ id: 5, field: "title", value: "x" }, "PUT"));
    expect(res.status).toBe(200);
    expect(mockModels.runSessionFieldUpdate).toHaveBeenCalled();
  });

  test("a schedule change that collides is refused (409) and not written", async () => {
    mockModels.getSessionSchedule.mockResolvedValue({
      rows: [{ scheduled_date: "2026-01-02", start_time: "09:00", end_time: "10:00" }],
    });
    mockModels.findSessionScheduleConflictExcludingId.mockResolvedValue({
      rows: [{ title: "Clash" }],
    });
    const res = await PUT(
      jsonReq({ id: 5, field: "scheduled_date", value: "2026-01-02" }, "PUT"),
    );
    expect(res.status).toBe(409);
    expect(mockModels.runSessionFieldUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/pm/curriculum", () => {
  test("deleting a session cascades to its attendance and requirements", async () => {
    const res = await DELETE(jsonReq({ id: 9, type: "session" }, "DELETE"));
    expect(res.status).toBe(200);
    expect(mockModels.deleteSession).toHaveBeenCalledWith(9);
    expect(mockModels.deleteAttendanceForSession).toHaveBeenCalledWith(9);
    expect(mockModels.deleteRequirementsForSession).toHaveBeenCalledWith(9);
  });

  test("deleting a requirement resolves it and deletes it", async () => {
    const res = await DELETE(jsonReq({ id: 7 }, "DELETE"));
    expect(res.status).toBe(200);
    expect(mockModels.getRequirementProgramId).toHaveBeenCalledWith(7);
    expect(mockModels.deleteRequirement).toHaveBeenCalledWith(7);
  });
});
