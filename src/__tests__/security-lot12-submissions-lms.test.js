/**
 * SECURITY — Lot 12 (Lot 4 remainder: submission scope + LMS requirement scope).
 *
 * Registry findings:
 *   - BOLA-FORM-2: a team-entity session could read ANY team's submissions by
 *     choosing `team_id`/`program_id`, and score writes (PUT) had no program
 *     scope at all.
 *   - SCOPE-LMS-1b: `lms/program-requirements/[id]` PUT/DELETE never resolved
 *     the requirement's program.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => ({ cid: "USR_STAFF", role: "staff", email: "s@x.test" })),
  requireAssignmentAccess: jest.fn(async () => null),
  getFacilitatorTeamScope: jest.fn(async () => ({ scope: "all", teamIds: [] })),
  hasProgramManagementAccess: jest.fn((role) => ["super_admin", "program_manager"].includes(role)),
}));

jest.mock("@/lib/authorization", () => ({
  getAuthorizationContext: jest.fn(async () => ({ isSuperAdmin: false })),
  requireAuthorization: jest.fn(async () => null),
  authorize: jest.fn(() => false),
}));

jest.mock("@/lib/authorization/scope", () => ({
  isWithinScope: jest.fn(async () => true),
}));

jest.mock("@/models/forms", () => ({
  getSubmissionProgramStatus: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramSubmissionStatus: jest.fn(async () => ({ rows: [] })),
  ensureSubmissionsTeamIdColumn: jest.fn(async () => {}),
  ensureSubmissionsRoleLockColumn: jest.fn(async () => {}),
  ensureSubmissionsScoreColumn: jest.fn(async () => {}),
  ensureSubmissionsReviewedByRoleColumn: jest.fn(async () => {}),
  ensureSubmissionsUpdatedAtColumn: jest.fn(async () => {}),
  ensureSubmissionsFollowupsParticipantCidColumn: jest.fn(async () => {}),
  ensureSubmissionsTeamIdColumnForListing: jest.fn(async () => {}),
  ensureSubmissionScoresColumn: jest.fn(async () => {}),
  ensureSubmissionEvaluationScoreColumn: jest.fn(async () => {}),
  findMaxSubmissionVersion: jest.fn(async () => ({ rows: [] })),
  getSubmissionProgramId: jest.fn(async () => ({ rows: [{ program_id: "P1" }] })),
  checkSubmissionInFacilitatorTeamScope: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  getSubmissionReviewDetails: jest.fn(async () => ({ rows: [] })),
  updateSubmissionReview: jest.fn(async () => ({})),
  createSubmission: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  createSubmissionFollowupEvent: jest.fn(async () => ({})),
  createSubmissionFollowup: jest.fn(async () => ({})),
  createSubmissionNotification: jest.fn(async () => ({})),
  propagateSubmissionToTeamMembers: jest.fn(async () => ({})),
  listSubmissions: jest.fn(async () => ({ rows: [] })),
  updateSubmissionScoreById: jest.fn(async () => ({})),
  updateSubmissionsScoreForParticipant: jest.fn(async () => ({})),
}));

jest.mock("@/models/teams", () => ({
  getTeamForOwnershipCheck: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/lms/programRequirements", () => ({
  getRequirementProgramId: jest.fn(async () => "P1"),
  updateProgramRequirement: jest.fn(async () => ({ id: 7 })),
  detachCourseFromProgram: jest.fn(async () => ({ success: true, id: 7 })),
}));

const { isWithinScope } = require("@/lib/authorization/scope");
const { getSession } = require("@/lib/auth");
const formsModel = require("@/models/forms");
const requirementsModel = require("@/models/lms/programRequirements");

const submissions = require("@/app/api/submissions/route");
const requirements = require("@/app/api/lms/program-requirements/[id]/route");

const jsonReq = (url, method, body) =>
  new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  isWithinScope.mockResolvedValue(true);
  getSession.mockResolvedValue({ cid: "USR_STAFF", role: "staff", email: "s@x.test" });
  formsModel.getSubmissionProgramId.mockResolvedValue({ rows: [{ program_id: "P1" }] });
  requirementsModel.getRequirementProgramId.mockResolvedValue("P1");
});

describe("a team session may only read its own submissions", () => {
  test("choosing a foreign team_id is refused, nothing listed", async () => {
    getSession.mockResolvedValue({ cid: "TEAM-1", role: "team" });

    const res = await submissions.GET(new Request("http://localhost/api/submissions?team_id=TEAM-2"));

    expect(res.status).toBe(403);
    expect(formsModel.listSubmissions).not.toHaveBeenCalled();
  });

  test("a program_id filter cannot widen the read — the team is bound server-side", async () => {
    getSession.mockResolvedValue({ cid: "TEAM-1", role: "team" });

    const res = await submissions.GET(new Request("http://localhost/api/submissions?program_id=P1"));

    expect(res.status).toBe(200);
    expect(formsModel.listSubmissions).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: "TEAM-1" }),
    );
  });
});

describe("a score write is program-scoped", () => {
  test("scoring a submission in a program you are not staffed on is refused", async () => {
    isWithinScope.mockResolvedValueOnce(false);

    const res = await submissions.PUT(jsonReq("http://localhost/api/submissions", "PUT", { id: 9, score: 5 }));

    expect(res.status).toBe(403);
    expect(formsModel.getSubmissionProgramId).toHaveBeenCalledWith(9);
    expect(formsModel.updateSubmissionScoreById).not.toHaveBeenCalled();
  });

  test("an in-scope score write still works", async () => {
    const res = await submissions.PUT(jsonReq("http://localhost/api/submissions", "PUT", { id: 9, score: 5 }));

    expect(res.status).toBe(200);
    expect(isWithinScope).toHaveBeenCalledWith("program_staffed", "USR_STAFF", "P1", { email: "s@x.test" });
    expect(formsModel.updateSubmissionScoreById).toHaveBeenCalled();
  });

  test("a participant-wide score write uses the named program", async () => {
    isWithinScope.mockResolvedValueOnce(false);

    const res = await submissions.PUT(
      jsonReq("http://localhost/api/submissions", "PUT", { participant_id: "U1", program_id: "P-OTHER", score: 5 }),
    );

    expect(res.status).toBe(403);
    expect(formsModel.updateSubmissionsScoreForParticipant).not.toHaveBeenCalled();
  });
});

describe("an LMS requirement is scoped to its program", () => {
  test("editing a requirement outside your programs is refused", async () => {
    isWithinScope.mockResolvedValueOnce(false);

    const res = await requirements.PUT(
      jsonReq("http://localhost/api/lms/program-requirements/7", "PUT", { is_required: false }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(res.status).toBe(403);
    expect(requirementsModel.getRequirementProgramId).toHaveBeenCalledWith("7");
    expect(requirementsModel.updateProgramRequirement).not.toHaveBeenCalled();
  });

  test("detaching a course outside your programs is refused", async () => {
    isWithinScope.mockResolvedValueOnce(false);

    const res = await requirements.DELETE(
      new Request("http://localhost/api/lms/program-requirements/7", { method: "DELETE" }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(res.status).toBe(403);
    expect(requirementsModel.detachCourseFromProgram).not.toHaveBeenCalled();
  });

  test("an in-scope detach still works", async () => {
    const res = await requirements.DELETE(
      new Request("http://localhost/api/lms/program-requirements/7", { method: "DELETE" }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(res.status).toBe(200);
    expect(requirementsModel.detachCourseFromProgram).toHaveBeenCalledWith("7");
  });
});
