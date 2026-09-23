/**
 * SECURITY — Lot 11 (team task board scope + team credential exposure).
 *
 * Registry findings:
 *   - AUTHZ-CRM-1: `team-tasks` had no team scope — any holder of the global
 *     `tasks.*` capability could read and mutate ANY team's board.
 *   - XPROG-1 remainder: the team reads returned `SELECT *`, including the shared
 *     team username/password, to every authorized reader.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => ({ cid: "USR_STAFF", role: "staff", email: "s@x.test" })),
  hasProgramManagementAccess: jest.fn(() => false),
  requireAssignmentAccess: jest.fn(async () => null),
}));

jest.mock("@/lib/authorization", () => ({
  getAuthorizationContext: jest.fn(async () => ({ isSuperAdmin: false })),
  requireAuthorization: jest.fn(async () => null),
  authorize: jest.fn(() => false),
}));

jest.mock("@/lib/authorization/scope", () => ({
  isWithinScope: jest.fn(async () => true),
}));

jest.mock("@/lib/email", () => ({ sendStandaloneEmail: jest.fn(async () => true) }));

jest.mock("@/models/teams", () => ({
  getTeamById: jest.fn(async () => ({ rows: [{ id: "TEAM-1", program_id: "P1" }] })),
  getTeams: jest.fn(async () => ({ rows: [{ id: "TEAM-1", name: "Alpha", password: "FST123", team_username: "alpha_1" }] })),
  createTeam: jest.fn(async () => ({ rows: [] })),
  deleteTeam: jest.fn(async () => ({})),
  updateTeamHandler: jest.fn(async () => ({})),
  setTeamVentureReady: jest.fn(async () => ({})),
}));

jest.mock("@/models/groups", () => ({
  getOrgTeams: jest.fn(async () => ({ rows: [{ id: "TEAM-1", name: "Alpha", password: "FST123", team_username: "alpha_1" }] })),
  getOrgTeamMembers: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/workspace", () => ({
  getTeamTasks: jest.fn(async () => ({ rows: [{ id: 1, title: "Do it" }] })),
  getTeamTaskTeamId: jest.fn(async () => ({ rows: [{ team_id: "TEAM-1" }] })),
  createTeamTask: jest.fn(async () => ({ rows: [{ id: 2 }] })),
  updateTeamTaskFields: jest.fn(async () => ({ rows: [] })),
  deleteTeamTask: jest.fn(async () => ({})),
}));

const { isWithinScope } = require("@/lib/authorization/scope");
const { getSession, hasProgramManagementAccess } = require("@/lib/auth");
const teamsModel = require("@/models/teams");
const workspaceModel = require("@/models/workspace");

const teamTasks = require("@/app/api/team-tasks/route");
const teams = require("@/app/api/teams/route");
const pmTeams = require("@/app/api/pm/teams/route");

const jsonReq = (url, method, body) =>
  new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  isWithinScope.mockResolvedValue(true);
  getSession.mockResolvedValue({ cid: "USR_STAFF", role: "staff", email: "s@x.test" });
  hasProgramManagementAccess.mockImplementation((role) => ["super_admin", "program_manager"].includes(role));
  teamsModel.getTeamById.mockResolvedValue({ rows: [{ id: "TEAM-1", program_id: "P1" }] });
});

describe("the team task board is team-scoped", () => {
  test("reading a board outside your programs is refused, nothing read", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await teamTasks.GET(new Request("http://localhost/api/team-tasks?team_id=TEAM-9"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.missing).toEqual({ scope: "program_staffed", wave: "groups" });
    expect(workspaceModel.getTeamTasks).not.toHaveBeenCalled();
  });

  test("a staffed caller reads the board", async () => {
    const res = await teamTasks.GET(new Request("http://localhost/api/team-tasks?team_id=TEAM-1"));

    expect(res.status).toBe(200);
    expect(isWithinScope).toHaveBeenCalledWith("program_staffed", "USR_STAFF", "P1", { email: "s@x.test" });
    expect(workspaceModel.getTeamTasks).toHaveBeenCalledWith("TEAM-1");
  });

  test("management is unscoped", async () => {
    getSession.mockResolvedValue({ cid: "USR_PM", role: "program_manager" });

    const res = await teamTasks.GET(new Request("http://localhost/api/team-tasks?team_id=TEAM-9"));

    expect(res.status).toBe(200);
    expect(isWithinScope).not.toHaveBeenCalled();
  });

  test("a team session may only touch its OWN board", async () => {
    getSession.mockResolvedValue({ cid: "TEAM-1", role: "team" });

    const foreign = await teamTasks.GET(new Request("http://localhost/api/team-tasks?team_id=TEAM-2"));
    expect(foreign.status).toBe(404);
    expect(workspaceModel.getTeamTasks).not.toHaveBeenCalled();

    const own = await teamTasks.GET(new Request("http://localhost/api/team-tasks?team_id=TEAM-1"));
    expect(own.status).toBe(200);
    expect(workspaceModel.getTeamTasks).toHaveBeenCalledWith("TEAM-1");
  });

  test("mutating a foreign board task is refused after resolving its team", async () => {
    // The task resolves to TEAM-1 → P1, which is out of scope for this caller.
    isWithinScope.mockResolvedValueOnce(false);
    const res = await teamTasks.PUT(jsonReq("http://localhost/api/team-tasks", "PUT", { id: 5, status: "done" }));

    expect(res.status).toBe(403);
    expect(workspaceModel.getTeamTaskTeamId).toHaveBeenCalledWith(5);
    expect(workspaceModel.updateTeamTaskFields).not.toHaveBeenCalled();
  });
});

describe("shared team credentials are management-only", () => {
  test("a delegated reader gets the roster without username/password", async () => {
    const res = await teams.GET(new Request("http://localhost/api/teams?program_id=P1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.teams).toHaveLength(1);
    expect(body.teams[0]).not.toHaveProperty("password");
    expect(body.teams[0]).not.toHaveProperty("team_username");
    expect(body.teams[0].name).toBe("Alpha");
  });

  test("management still receives the credentials", async () => {
    getSession.mockResolvedValue({ cid: "USR_PM", role: "program_manager" });

    const res = await teams.GET(new Request("http://localhost/api/teams?program_id=P1"));
    const body = await res.json();

    expect(body.teams[0].password).toBe("FST123");
    expect(body.teams[0].team_username).toBe("alpha_1");
  });

  test("the pm team list also strips them for a delegated reader", async () => {
    const res = await pmTeams.GET(new Request("http://localhost/api/pm/teams?program_id=P1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.teams[0]).not.toHaveProperty("password");
    expect(body.teams[0]).not.toHaveProperty("team_username");
  });

  test("groupsModel belt-and-braces: management keeps them on the pm list too", async () => {
    getSession.mockResolvedValue({ cid: "USR_SA", role: "super_admin" });

    const res = await pmTeams.GET(new Request("http://localhost/api/pm/teams?program_id=P1"));
    const body = await res.json();

    expect(body.teams[0].password).toBe("FST123");
  });
});
