/**
 * TEAM BOARD — the service decisions behind /api/team-tasks.
 *
 * Two things are pinned here because both are security boundaries that the
 * controller alone would let drift:
 *
 *   - the SCOPE rule (a team session reaches only its own board, management is
 *     unscoped, anyone else must be staffed on the owning program, and a team
 *     that resolves to nothing is refused);
 *   - the WRITE SURFACE (only title/description/status/priority/assigned_to are
 *     writable, so an update can never move a task to another board or
 *     re-attribute its author).
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "USR_STAFF", role: "staff", email: "s@x.test" })),
  hasProgramManagementAccess: jest.fn(() => false),
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/models/teams", () => ({
  getTeamById: jest.fn(async () => ({ rows: [{ id: "TEAM-1", program_id: "P1" }] })),
}));

jest.mock("@/models/workspace", () => ({
  getTeamTasks: jest.fn(async () => ({ rows: [] })),
  getTeamTaskTeamId: jest.fn(async () => ({ rows: [{ team_id: "TEAM-1" }] })),
  createTeamTask: jest.fn(async () => ({ rows: [{ id: 2 }] })),
  updateTeamTaskFields: jest.fn(async () => ({ rows: [{ id: 2, title: "t" }] })),
  deleteTeamTask: jest.fn(async () => ({})),
}));

const { getSession, hasProgramManagementAccess } = require("@/lib/auth");
const teamsModel = require("@/models/teams");
const workspaceModel = require("@/models/workspace");
const {
  assembleBoardTaskPatch,
  createTeamBoardTask,
  deleteTeamBoardTask,
  listTeamBoardTasks,
  resolveBoardTaskCreation,
  resolveTeamBoardScope,
  resolveTeamBoardTaskScope,
  updateTeamBoardTask,
} = require("@/services/tasks/teamBoard");

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ cid: "USR_STAFF", role: "staff", email: "s@x.test" });
  hasProgramManagementAccess.mockReturnValue(false);
  teamsModel.getTeamById.mockResolvedValue({ rows: [{ id: "TEAM-1", program_id: "P1" }] });
  workspaceModel.getTeamTaskTeamId.mockResolvedValue({ rows: [{ team_id: "TEAM-1" }] });
});

describe("the board scope rule", () => {
  test("a plain staff caller is sent to the program's record scope", async () => {
    const verdict = await resolveTeamBoardScope("TEAM-1");

    expect(verdict).toEqual({ kind: "program-scope", programId: "P1" });
    expect(teamsModel.getTeamById).toHaveBeenCalledWith("TEAM-1");
  });

  test("no session is refused", async () => {
    getSession.mockResolvedValue(null);

    expect(await resolveTeamBoardScope("TEAM-1")).toEqual({
      kind: "deny",
      status: 401,
      errorKey: "errors.authRequired",
    });
  });

  test("a team session reaches its OWN board and stops there", async () => {
    getSession.mockResolvedValue({ cid: "TEAM-1", role: "team" });

    expect(await resolveTeamBoardScope("TEAM-1")).toEqual({ kind: "allow" });
    expect(teamsModel.getTeamById).not.toHaveBeenCalled();
  });

  test("a team session asking for a foreign board gets a 404, never a 403", async () => {
    getSession.mockResolvedValue({ cid: "TEAM-1", role: "team" });

    expect(await resolveTeamBoardScope("TEAM-2")).toEqual({
      kind: "deny",
      status: 404,
      errorKey: "errors.notFound",
    });
  });

  test("management is unscoped and never resolves the team", async () => {
    hasProgramManagementAccess.mockReturnValue(true);

    expect(await resolveTeamBoardScope("TEAM-9")).toEqual({ kind: "allow" });
    expect(teamsModel.getTeamById).not.toHaveBeenCalled();
  });

  test("a team that resolves to nothing is refused, never allowed", async () => {
    teamsModel.getTeamById.mockResolvedValue({ rows: [] });

    expect(await resolveTeamBoardScope("TEAM-9")).toEqual({
      kind: "deny",
      status: 404,
      errorKey: "errors.notFound",
    });
  });

  test("a team whose program is unrecorded yields a null scope, which denies", async () => {
    teamsModel.getTeamById.mockResolvedValue({ rows: [{ id: "TEAM-1", program_id: null }] });

    expect(await resolveTeamBoardScope("TEAM-1")).toEqual({
      kind: "program-scope",
      programId: null,
    });
  });
});

describe("a task id is scoped through its own team", () => {
  test("the task's team resolves, then that team's rule applies", async () => {
    const verdict = await resolveTeamBoardTaskScope(5);

    expect(workspaceModel.getTeamTaskTeamId).toHaveBeenCalledWith(5);
    expect(verdict).toEqual({ kind: "program-scope", programId: "P1" });
  });

  test("a task belonging to no team is refused before anything else", async () => {
    workspaceModel.getTeamTaskTeamId.mockResolvedValue({ rows: [] });

    expect(await resolveTeamBoardTaskScope(5)).toEqual({
      kind: "deny",
      status: 404,
      errorKey: "errors.notFound",
    });
    expect(teamsModel.getTeamById).not.toHaveBeenCalled();
  });
});

describe("the board's write surface", () => {
  test("only the whitelisted columns reach the SET clause", () => {
    const clause = assembleBoardTaskPatch({
      title: "t",
      status: "done",
      team_id: "TEAM-OTHER",
      created_by: "USR_OTHER",
      created_at: "2020-01-01",
    });

    expect(clause.fields).toEqual(["title = ?", "status = ?", "updated_at = NOW()"]);
    expect(clause.args).toEqual(["t", "done"]);
  });

  test("a request naming no writable column is refused, not written as a no-op", () => {
    expect(assembleBoardTaskPatch({ team_id: "TEAM-OTHER" })).toEqual({
      error: "No fields to update",
    });
  });

  test("the POST defaults are applied", () => {
    expect(resolveBoardTaskCreation({ title: "t" })).toEqual({
      description: null,
      status: "todo",
      priority: "medium",
      assignedTo: null,
      createdBy: null,
    });
  });

  test("a caller may override every default", () => {
    expect(
      resolveBoardTaskCreation({
        description: "d",
        status: "in_progress",
        priority: "high",
        assigned_to: "USR_A",
        created_by: "USR_B",
      }),
    ).toEqual({
      description: "d",
      status: "in_progress",
      priority: "high",
      assignedTo: "USR_A",
      createdBy: "USR_B",
    });
  });
});

describe("the use cases", () => {
  test("listing reads the team's board and returns its rows", async () => {
    workspaceModel.getTeamTasks.mockResolvedValue({ rows: [{ id: 1, title: "Do it" }] });

    expect(await listTeamBoardTasks("TEAM-1")).toEqual({
      status: 200,
      body: { success: true, tasks: [{ id: 1, title: "Do it" }] },
    });
  });

  test("creating applies the defaults before the insert", async () => {
    await createTeamBoardTask({ team_id: "TEAM-1", title: "Do it" });

    expect(workspaceModel.createTeamTask).toHaveBeenCalledWith(
      "TEAM-1",
      "Do it",
      null,
      "todo",
      "medium",
      null,
      null,
    );
  });

  test("updating writes the assembled clause and returns the row", async () => {
    const result = await updateTeamBoardTask({ id: 5, patch: { title: "New" } });

    expect(workspaceModel.updateTeamTaskFields).toHaveBeenCalledWith(
      5,
      ["title = ?", "updated_at = NOW()"],
      ["New"],
    );
    expect(result.status).toBe(200);
    expect(result.body.task).toEqual({ id: 2, title: "t" });
  });

  test("updating with nothing writable writes nothing", async () => {
    const result = await updateTeamBoardTask({ id: 5, patch: { id: 5 } });

    expect(result).toEqual({ status: 400, error: "No fields to update" });
    expect(workspaceModel.updateTeamTaskFields).not.toHaveBeenCalled();
  });

  test("deleting removes the row", async () => {
    expect(await deleteTeamBoardTask(5)).toEqual({ status: 200, body: { success: true } });
    expect(workspaceModel.deleteTeamTask).toHaveBeenCalledWith(5);
  });
});