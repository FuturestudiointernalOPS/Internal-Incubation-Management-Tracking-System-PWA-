/**
 * Characterisation tests for the Programs lifecycle API
 * (src/app/api/pm/programs/route.js).
 *
 * Pins the use-case decisions (the duplicate-name rule, the date rules, the
 * default objectives, the quick-archive shortcut, the protected-data guard and
 * the list-level completion index) rather than the implementation, so the suite
 * stays valid after the use cases move to `@/services/programs/workspace`. The
 * model layer is mocked, so the assertions are about decisions, not SQL.
 */

const mockModels = {
  addParticipantToProgram: jest.fn(),
  addProgramExpectedOutcomesColumn: jest.fn(),
  addProgramSlugColumn: jest.fn(),
  addProgramSuccessMetricsColumn: jest.fn(),
  assignSegmentById: jest.fn(),
  assignSegmentByName: jest.fn(),
  autoActivatePlannedPrograms: jest.fn(),
  countActiveParticipantsByProgram: jest.fn(),
  countDocumentRequirementsByProgram: jest.fn(),
  countProtectedProgramData: jest.fn(),
  countReportWeeksByProgram: jest.fn(),
  countSessionsByProgram: jest.fn(),
  countSubmissionsByProgram: jest.fn(),
  createProgram: jest.fn(),
  createProgramKpi: jest.fn(),
  createSystemFacilitatorsGroup: jest.fn(),
  deleteProgramById: jest.fn(),
  findProgramByExactName: jest.fn(),
  getAssignedFamiliesByProgram: jest.fn(),
  getContactsByFamilyGroupName: jest.fn(),
  getProgramFacilitators: jest.fn(),
  getProgramWithAssignedPm: jest.fn(),
  getSegmentFamilyName: jest.fn(),
  linkSegmentById: jest.fn(),
  linkSegmentByName: jest.fn(),
  listProgramsByManagementFilters: jest.fn(),
  setProgramArchiveState: jest.fn(),
  unlinkSegmentsFromProgram: jest.fn(),
  updateProgram: jest.fn(),
};

jest.mock("@/models/programs", () => mockModels);

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [], rowsAffected: 1 })) },
  initDb: jest.fn(async () => true),
}));

const mockLogAuditEvent = jest.fn(async () => {});
jest.mock("@/lib/audit", () => ({ logAuditEvent: mockLogAuditEvent }));

const mockSession = { cid: "user-1", user_cid: "user-1", name: "PM One", role: "program_manager" };

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => mockSession),
  assertNoParticipantFacilitatorConflict: jest.fn(async () => null),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/programScopedAccess", () => ({
  requireProgramScope: jest.fn(async () => null),
}));

const { GET, POST, PUT, DELETE } = require("@/app/api/pm/programs/route");
const { requireAuthorization } = require("@/lib/authorization");
const { requireProgramScope } = require("@/lib/programScopedAccess");

const readJson = (res) => res.json();
const jsonReq = (body, method) =>
  new Request("http://localhost/api/pm/programs", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockLogAuditEvent.mockResolvedValue(undefined);
  mockModels.autoActivatePlannedPrograms.mockResolvedValue(undefined);
  mockModels.listProgramsByManagementFilters.mockResolvedValue({ rows: [] });
  mockModels.countSessionsByProgram.mockResolvedValue({ rows: [] });
  mockModels.countActiveParticipantsByProgram.mockResolvedValue({ rows: [] });
  mockModels.countDocumentRequirementsByProgram.mockResolvedValue({ rows: [] });
  mockModels.countReportWeeksByProgram.mockResolvedValue({ rows: [] });
  mockModels.getAssignedFamiliesByProgram.mockResolvedValue({ rows: [] });
  mockModels.countSubmissionsByProgram.mockResolvedValue({ rows: [] });
  mockModels.getProgramFacilitators.mockResolvedValue({ rows: [] });
  mockModels.findProgramByExactName.mockResolvedValue({ rows: [] });
  mockModels.getProgramWithAssignedPm.mockResolvedValue({ rows: [] });
  mockModels.countProtectedProgramData.mockResolvedValue({ rows: [{ protected_count: 0 }] });
  mockModels.createProgram.mockResolvedValue({ rows: [] });
  mockModels.updateProgram.mockResolvedValue({ rows: [] });
  mockModels.deleteProgramById.mockResolvedValue({ rows: [] });
});

describe("GET /api/pm/programs", () => {
  test("an empty portfolio is a success with no programs", async () => {
    const res = await GET(new Request("http://localhost/api/pm/programs"));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, programs: [] });
  });

  test("a program is enriched with its completion index and facilitator scope", async () => {
    mockModels.listProgramsByManagementFilters.mockResolvedValue({
      rows: [{ id: "P1", name: "Alpha", duration_weeks: 4 }],
    });
    mockModels.countSessionsByProgram.mockResolvedValue({
      rows: [{ program_id: "P1", count: 10, completed: 5 }],
    });
    mockModels.countDocumentRequirementsByProgram.mockResolvedValue({
      rows: [{ program_id: "P1", count: 4, completed: 2 }],
    });
    mockModels.countReportWeeksByProgram.mockResolvedValue({
      rows: [{ program_id: "P1", weeks: 2 }],
    });
    mockModels.countActiveParticipantsByProgram.mockResolvedValue({
      rows: [{ program_id: "P1", count: 3 }],
    });
    mockModels.countSubmissionsByProgram.mockResolvedValue({
      rows: [{ program_id: "P1", total: 5, approved: 3 }],
    });

    const res = await GET(new Request("http://localhost/api/pm/programs"));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    const program = data.programs[0];
    // (25 + 4 + 20 + 9) / (50 + 8 + 40 + 36) * 100 = 43.28 → 43
    expect(program.completion_index).toBe(43);
    expect(program.sessions_count).toBe(10);
    expect(program.submissions_approved).toBe(3);
    expect(program.facilitator_scope).toBe("assigned_groups");
  });
});

describe("POST /api/pm/programs", () => {
  test("a duplicate name is refused (409) and nothing is created", async () => {
    mockModels.findProgramByExactName.mockResolvedValue({ rows: [{ id: "P1" }] });
    const res = await POST(jsonReq({ name: "Alpha" }, "POST"));
    expect(res.status).toBe(409);
    expect(mockModels.createProgram).not.toHaveBeenCalled();
  });

  test("a start date in the past is refused (400)", async () => {
    const past = "2000-01-01";
    const res = await POST(jsonReq({ name: "Alpha", start_date: past }, "POST"));
    expect(res.status).toBe(400);
    expect(mockModels.createProgram).not.toHaveBeenCalled();
  });

  test("an end date before the start date is refused (400)", async () => {
    const res = await POST(
      jsonReq(
        { name: "Alpha", start_date: "2999-01-10", end_date: "2999-01-01" },
        "POST",
      ),
    );
    expect(res.status).toBe(400);
    expect(mockModels.createProgram).not.toHaveBeenCalled();
  });

  test("creation seeds the default objectives and writes the audit trail", async () => {
    const res = await POST(jsonReq({ name: "Alpha" }, "POST"));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, id: expect.any(String) });
    expect(mockModels.createProgram).toHaveBeenCalledTimes(1);
    // Six default objectives when the request supplies none.
    expect(mockModels.createProgramKpi).toHaveBeenCalledTimes(6);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: "program", action: "created" }),
    );
  });
});

describe("PUT /api/pm/programs", () => {
  test("a missing id is refused (400) before the scope guard runs", async () => {
    const res = await PUT(jsonReq({ name: "Alpha" }, "PUT"));
    expect(res.status).toBe(400);
    expect(requireProgramScope).not.toHaveBeenCalled();
  });

  test("an unknown program is a 404", async () => {
    mockModels.getProgramWithAssignedPm.mockResolvedValue({ rows: [] });
    const res = await PUT(jsonReq({ id: "P1", name: "Alpha" }, "PUT"));
    expect(res.status).toBe(404);
    expect(mockModels.updateProgram).not.toHaveBeenCalled();
  });

  test("is_archived without a name is the quick archive shortcut", async () => {
    mockModels.getProgramWithAssignedPm.mockResolvedValue({
      rows: [{ id: "P1", assigned_pm_id: null }],
    });
    const res = await PUT(jsonReq({ id: "P1", is_archived: true }, "PUT"));
    expect(res.status).toBe(200);
    expect(mockModels.setProgramArchiveState).toHaveBeenCalledWith(true, "archived", "P1");
    expect(mockModels.updateProgram).not.toHaveBeenCalled();
  });

  test("editing without a name and without an archive flag is refused (400)", async () => {
    mockModels.getProgramWithAssignedPm.mockResolvedValue({
      rows: [{ id: "P1", assigned_pm_id: null }],
    });
    const res = await PUT(jsonReq({ id: "P1", description: "x" }, "PUT"));
    expect(res.status).toBe(400);
    expect(mockModels.updateProgram).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/pm/programs", () => {
  test("a program with protected data is refused (409) and not deleted", async () => {
    mockModels.countProtectedProgramData.mockResolvedValue({
      rows: [{ protected_count: 3 }],
    });
    const res = await DELETE(jsonReq({ id: "P1" }, "DELETE"));
    expect(res.status).toBe(409);
    expect(mockModels.deleteProgramById).not.toHaveBeenCalled();
  });

  test("a clean program is deleted", async () => {
    const res = await DELETE(jsonReq({ id: "P1" }, "DELETE"));
    expect(res.status).toBe(200);
    expect(mockModels.deleteProgramById).toHaveBeenCalledWith("P1");
  });
});

describe("the capability gate is the controller's own", () => {
  test("a denied delete capability short-circuits before any read", async () => {
    requireAuthorization.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), { status: 403 }),
    );
    const res = await DELETE(jsonReq({ id: "P1" }, "DELETE"));
    expect(res.status).toBe(403);
    expect(mockModels.countProtectedProgramData).not.toHaveBeenCalled();
  });
});
