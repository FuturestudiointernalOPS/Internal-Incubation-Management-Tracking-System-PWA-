/**
 * SECURITY — Lot 8 (program scope on curriculum/reports/export + separation of
 * duties on capability assignment).
 *
 * Registry findings:
 *   - XPROG-1: `pm/curriculum`, `pm/reports`, `pm/export` authorised on the
 *     global `programs.edit` / `reports.export` capability and never asked WHICH
 *     program. Worse, `pm/curriculum`'s record actions (toggle/assign/anchor)
 *     targeted a row by id while scoping on the CLIENT-supplied `program_id`, so
 *     a forged program_id could mutate a foreign program's record.
 *   - AUTHZ-ADM-5: `access-profiles/assign` and `responsibilities/assign` let an
 *     actor grant capabilities to THEMSELVES.
 *
 * The tests drive the real handlers and prove the program is resolved from the
 * RECORD (not the body) and that self-assignment is refused.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => ({ cid: "USR_ACTOR", role: "staff", email: "s@x.test", name: "Actor" })),
  hasProgramManagementAccess: jest.fn(() => false),
  requireAssignmentAccess: jest.fn(async () => null),
  logPermissionAudit: jest.fn(async () => true),
  assignResponsibility: jest.fn(async () => ({ success: true })),
  removeResponsibility: jest.fn(async () => ({ success: true })),
  getAllResponsibilities: jest.fn(async () => []),
  seedDefaultResponsibilities: jest.fn(async () => true),
}));

jest.mock("@/lib/authorization", () => ({
  getAuthorizationContext: jest.fn(async () => ({ isSuperAdmin: false })),
  requireAuthorization: jest.fn(async () => null),
  authorize: jest.fn(() => false),
  assertTemplateCapsEligible: jest.fn(async () => ({ valid: true, violations: [] })),
  invalidateAuthorizationContext: jest.fn(() => {}),
}));

jest.mock("@/lib/authorization/scope", () => ({
  isWithinScope: jest.fn(async () => true),
}));

jest.mock("@/lib/kpi-progress", () => ({
  recalculateKpiProgress: jest.fn(async () => ({})),
}));

jest.mock("@/models/kpi-progress", () => ({
  listKpiNamesForPrograms: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/curriculum", () => ({
  addSessionVersionColumn: jest.fn(async () => ({})),
  addSessionTimezoneColumn: jest.fn(async () => ({})),
  createSessionVersionsTable: jest.fn(async () => ({})),
  addRequirementResourceUrlColumn: jest.fn(async () => ({})),
  addRequirementResourceLabelColumn: jest.fn(async () => ({})),
  addRequirementAssigneeTypeColumn: jest.fn(async () => ({})),
  addRequirementAssigneeIdColumn: jest.fn(async () => ({})),
  addWeeklyReportAttachmentTypeColumn: jest.fn(async () => ({})),
  addWeeklyReportAttachmentUrlColumn: jest.fn(async () => ({})),
  ensureWeeklyReportSchema: jest.fn(async () => ({})),
  getSessionRowById: jest.fn(async () => ({ rows: [] })),
  insertSessionVersion: jest.fn(async () => ({})),
  setSessionVersion: jest.fn(async () => ({})),
  findSessionScheduleConflict: jest.fn(async () => ({ rows: [] })),
  createSession: jest.fn(async () => ({ rows: [{ id: 42 }] })),
  createAttendanceRequirement: jest.fn(async () => ({})),
  addSessionRequirement: jest.fn(async () => ({})),
  createRequirement: jest.fn(async () => ({ rows: [{ id: 7 }] })),
  countActiveParticipantsForProgram: jest.fn(async () => ({ rows: [{ cnt: 0 }] })),
  updateSessionStatus: jest.fn(async () => ({})),
  setDeliverableCompletion: jest.fn(async () => ({})),
  setSessionTeam: jest.fn(async () => ({})),
  getSessionExtraMaterials: jest.fn(async () => ({ rows: [] })),
  updateSessionExtraMaterials: jest.fn(async () => ({})),
  upsertWeeklyReport: jest.fn(async () => ({})),
  listWeeklyReports: jest.fn(async () => ({ rows: [] })),
  getSessionSchedule: jest.fn(async () => ({ rows: [] })),
  findSessionScheduleConflictExcludingId: jest.fn(async () => ({ rows: [] })),
  buildSessionFieldUpdate: jest.fn(() => ({ sql: "UPDATE v2_sessions SET title = ? WHERE id = ?", args: ["x", 1] })),
  runSessionFieldUpdate: jest.fn(async () => ({})),
  updateSession: jest.fn(async () => ({})),
  updateRequirement: jest.fn(async () => ({})),
  getSessionProgramId: jest.fn(async () => ({ rows: [{ program_id: "P1" }] })),
  deleteSession: jest.fn(async () => ({})),
  deleteAttendanceForSession: jest.fn(async () => ({})),
  deleteRequirementsForSession: jest.fn(async () => ({})),
  getRequirementProgramId: jest.fn(async () => ({ rows: [{ program_id: "P1" }] })),
  deleteRequirement: jest.fn(async () => ({})),
}));

jest.mock("@/models/programWorkspace", () => ({
  getProgramExportRows: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/lib/spreadsheet", () => ({ objectsToAoa: jest.fn(() => []) }));
jest.mock("write-excel-file/node", () => jest.fn());

jest.mock("@/models/authorization", () => ({
  getContactForAssignment: jest.fn(async () => ({ rows: [{ cid: "USR_TARGET", role: "member", name: "Target" }] })),
  getActiveAccessProfile: jest.fn(async () => ({ rows: [{ id: 5, name: "Profile" }] })),
  getUserGroupNames: jest.fn(async () => ({ rows: [] })),
  assignUserAccessProfile: jest.fn(async () => ({})),
  clearUserAccessProfileOverride: jest.fn(async () => ({})),
  getRoleDefaultProfileName: jest.fn(async () => ({ rows: [{ name: "Default" }] })),
  getContactAssignmentState: jest.fn(async () => ({ rows: [] })),
  getAccessProfileSummary: jest.fn(async () => ({ rows: [] })),
  getRoleDefaultAccessProfile: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/responsibilities", () => ({
  getAssignedResponsibilitiesForUser: jest.fn(async () => ({ rows: [] })),
  getContactByCid: jest.fn(async () => ({ rows: [] })),
  getContactName: jest.fn(async () => ({ rows: [{ name: "Target" }] })),
  getResponsibilityName: jest.fn(async () => ({ rows: [{ name: "Lead", key: "lead" }] })),
  grantResponsibilityBaseAccess: jest.fn(async () => []),
  revokeResponsibilityBaseAccess: jest.fn(async () => []),
}));

const { isWithinScope } = require("@/lib/authorization/scope");
const { getAuthorizationContext } = require("@/lib/authorization");
const curriculumModel = require("@/models/curriculum");
const programWorkspace = require("@/models/programWorkspace");
const authorizationModel = require("@/models/authorization");
const { assignResponsibility } = require("@/lib/auth");

const reports = require("@/app/api/pm/reports/route");
const exp = require("@/app/api/pm/export/route");
const curriculum = require("@/app/api/pm/curriculum/route");
const accessProfileAssign = require("@/app/api/access-profiles/assign/route");
const responsibilityAssign = require("@/app/api/responsibilities/assign/route");

const req = (url, method, body) =>
  new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  isWithinScope.mockResolvedValue(true);
  getAuthorizationContext.mockResolvedValue({ isSuperAdmin: false });
  curriculumModel.getSessionProgramId.mockResolvedValue({ rows: [{ program_id: "P1" }] });
  curriculumModel.getRequirementProgramId.mockResolvedValue({ rows: [{ program_id: "P1" }] });
});

describe("pm/reports and pm/export are program-scoped", () => {
  test("a weekly report outside your programs is refused, nothing written", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await reports.POST(req("http://localhost/api/pm/reports", "POST", { program_id: "P-OTHER", week_number: 1 }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.missing).toEqual({ scope: "program_staffed", wave: "content" });
    expect(curriculumModel.upsertWeeklyReport).not.toHaveBeenCalled();
  });

  test("exporting a program you are not staffed on is refused, no rows read", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await exp.GET(new Request("http://localhost/api/pm/export?program_id=P-OTHER&type=participants"));

    expect(res.status).toBe(403);
    expect(programWorkspace.getProgramExportRows).not.toHaveBeenCalled();
  });

  test("the export consults the scope of the target program", async () => {
    const res = await exp.GET(new Request("http://localhost/api/pm/export?program_id=P1&type=participants"));

    expect(res.status).toBe(200);
    expect(isWithinScope).toHaveBeenCalledWith("program_staffed", "USR_ACTOR", "P1", { email: "s@x.test" });
    expect(programWorkspace.getProgramExportRows).toHaveBeenCalledWith("participants", "P1");
  });
});

describe("pm/curriculum resolves the program from the RECORD, not the body", () => {
  test("toggle_status in your own program works", async () => {
    const res = await curriculum.POST(req("http://localhost/api/pm/curriculum", "POST", {
      program_id: "P1", action: "toggle_status", id: 99, status: "done",
    }));

    expect(res.status).toBe(200);
    expect(curriculumModel.getSessionProgramId).toHaveBeenCalledWith(99);
    expect(curriculumModel.updateSessionStatus).toHaveBeenCalled();
  });

  test("a forged body program_id cannot authorise a foreign session", async () => {
    // The session actually belongs to P-OTHER; the caller claims P1 (where they
    // ARE staffed). The check must follow the record, so this is refused.
    curriculumModel.getSessionProgramId.mockResolvedValueOnce({ rows: [{ program_id: "P-OTHER" }] });
    isWithinScope.mockImplementation(async (scope, cid, pid) => pid === "P1");

    const res = await curriculum.POST(req("http://localhost/api/pm/curriculum", "POST", {
      program_id: "P1", action: "toggle_status", id: 99, status: "done",
    }));

    expect(res.status).toBe(403);
    expect(curriculumModel.updateSessionStatus).not.toHaveBeenCalled();
    expect(isWithinScope).toHaveBeenCalledWith("program_staffed", "USR_ACTOR", "P-OTHER", { email: "s@x.test" });
  });

  test("deleting a requirement resolves its program and refuses when out of scope", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await curriculum.DELETE(req("http://localhost/api/pm/curriculum", "DELETE", { id: 7 }));

    expect(res.status).toBe(403);
    expect(curriculumModel.getRequirementProgramId).toHaveBeenCalledWith(7);
    expect(curriculumModel.deleteRequirement).not.toHaveBeenCalled();
  });

  test("a requirement delete in your own program still works", async () => {
    const res = await curriculum.DELETE(req("http://localhost/api/pm/curriculum", "DELETE", { id: 7 }));

    expect(res.status).toBe(200);
    expect(curriculumModel.deleteRequirement).toHaveBeenCalledWith(7);
  });
});

describe("nobody changes their own capabilities", () => {
  test("access-profiles/assign refuses a self-target", async () => {
    const res = await accessProfileAssign.PUT(req("http://localhost/api/access-profiles/assign", "PUT", {
      user_cid: "USR_ACTOR", profile_id: 5,
    }));

    expect(res.status).toBe(403);
    expect(authorizationModel.assignUserAccessProfile).not.toHaveBeenCalled();
  });

  test("responsibilities/assign refuses a self-target", async () => {
    const res = await responsibilityAssign.PUT(req("http://localhost/api/responsibilities/assign", "PUT", {
      user_cid: "USR_ACTOR", responsibility_id: 2, action: "assign",
    }));

    expect(res.status).toBe(403);
    expect(assignResponsibility).not.toHaveBeenCalled();
  });

  test("assigning a responsibility to ANOTHER user still works", async () => {
    const res = await responsibilityAssign.PUT(req("http://localhost/api/responsibilities/assign", "PUT", {
      user_cid: "USR_TARGET", responsibility_id: 2, action: "assign",
    }));

    expect(res.status).toBe(200);
    expect(assignResponsibility).toHaveBeenCalledWith("USR_TARGET", 2, "USR_ACTOR");
  });

  test("assigning an access profile to ANOTHER user still works", async () => {
    const res = await accessProfileAssign.PUT(req("http://localhost/api/access-profiles/assign", "PUT", {
      user_cid: "USR_TARGET", profile_id: null,
    }));

    expect(res.status).toBe(200);
    expect(authorizationModel.clearUserAccessProfileOverride).toHaveBeenCalledWith("USR_TARGET");
  });
});

describe("Super Admin is never scoped or self-blocked", () => {
  test("a Super Admin may write curriculum in any program", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true });
    isWithinScope.mockResolvedValueOnce(false);

    const res = await curriculum.DELETE(req("http://localhost/api/pm/curriculum", "DELETE", { id: 7 }));

    expect(res.status).toBe(200);
    expect(curriculumModel.deleteRequirement).toHaveBeenCalled();
  });

  test("a Super Admin can still only act on OTHER users' capabilities", async () => {
    // Separation of duties is not role-scoped: even a Super Admin cannot
    // self-assign.
    const res = await accessProfileAssign.PUT(req("http://localhost/api/access-profiles/assign", "PUT", {
      user_cid: "USR_ACTOR", profile_id: 5,
    }));
    expect(res.status).toBe(403);
  });
});
