/**
 * SECURITY — Lot 7 (program scope on the team/group management surfaces).
 *
 * The registry finding XPROG-1 / BOLA-CRM-1: the team and membership writers
 * authorised on a GLOBAL capability (or a role list) and never asked WHICH
 * program the target belonged to. A delegated holder could therefore add members
 * to — and delete — another program's team.
 *
 * These tests drive the REAL handlers and prove, for the two shapes of route:
 *   - a program id taken from the body (team create);
 *   - a program id resolved from the record first (team update/delete, membership
 *     create, whose only input is a team/group id);
 * that an out-of-scope caller is refused BEFORE anything is written.
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

jest.mock("@/lib/email", () => ({
  sendStandaloneEmail: jest.fn(async () => true),
  recordResendEvent: jest.fn(async () => true),
}));

jest.mock("@/lib/authorization", () => ({
  getAuthorizationContext: jest.fn(async () => ({ isSuperAdmin: false })),
  requireAuthorization: jest.fn(async () => null),
  authorize: jest.fn(() => false),
}));

jest.mock("@/lib/authorization/scope", () => ({
  isWithinScope: jest.fn(async () => true),
}));

jest.mock("@/models/teams", () => ({
  getTeamById: jest.fn(async () => ({ rows: [{ id: "TEAM-1", program_id: "P1" }] })),
  createTeam: jest.fn(async () => ({ rows: [{ id: "TEAM-NEW", program_id: "P1" }] })),
  deleteTeam: jest.fn(async () => ({})),
  updateTeamHandler: jest.fn(async () => ({})),
  setTeamVentureReady: jest.fn(async () => ({})),
  removeContactFromTeam: jest.fn(async () => ({})),
  removeParticipantFromTeam: jest.fn(async () => ({})),
  getNewTeamContactMembers: jest.fn(async () => ({ rows: [] })),
  getNewTeamParticipantMembers: jest.fn(async () => ({ rows: [] })),
  getTeamContactMembers: jest.fn(async () => ({ rows: [] })),
  getTeamParticipantMembers: jest.fn(async () => ({ rows: [] })),
  linkContactsToNewTeam: jest.fn(async () => ({})),
  linkParticipantsToNewTeam: jest.fn(async () => ({})),
  linkContactsToTeam: jest.fn(async () => ({})),
  linkParticipantsToTeam: jest.fn(async () => ({})),
  getTeams: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/groups", () => ({
  getOrgTeams: jest.fn(async () => ({ rows: [{ id: "TEAM-1", program_id: "P1" }] })),
  createOrgTeam: jest.fn(async () => ({ rows: [{ id: "TEAM-NEW", program_id: "P1" }] })),
  updateOrgTeam: jest.fn(async () => ({})),
  deleteOrgTeam: jest.fn(async () => ({})),
  clearOrgTeamMemberLinks: jest.fn(async () => ({})),
  clearOrgTeamMemberLinksOnDelete: jest.fn(async () => ({})),
  getOrgTeamMembers: jest.fn(async () => ({ rows: [] })),
  getOrgTeamParticipantEmails: jest.fn(async () => ({ rows: [] })),
  linkOrgTeamContactsByEmail: jest.fn(async () => ({})),
  linkOrgTeamContactsByCid: jest.fn(async () => ({})),
  linkOrgTeamContactsByCidOnUpdate: jest.fn(async () => ({})),
}));

jest.mock("@/lib/supabase", () => {
  const insert = jest.fn(() => ({
    select: jest.fn(async () => ({ data: [{ id: 1 }], error: null })),
  }));
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: jest.fn(async () => ({ data: { program_id: "P1" }, error: null })),
    insert,
  };
  return { supabase: { from: jest.fn(() => builder) }, __builder: builder };
});

const { isWithinScope } = require("@/lib/authorization/scope");
const { getAuthorizationContext } = require("@/lib/authorization");
const teamsModel = require("@/models/teams");
const groupsModel = require("@/models/groups");
const { __builder } = require("@/lib/supabase");

const pmTeams = require("@/app/api/pm/teams/route");
const teams = require("@/app/api/teams/route");
const groupMembers = require("@/app/api/group-members/route");

const req = (url, method, body) =>
  new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const post = (url, body) => req(url, "POST", body);
const put = (url, body) => req(url, "PUT", body);
const patch = (url, body) => req(url, "PATCH", body);
const del = (url, body) => req(url, "DELETE", body);

beforeEach(() => {
  jest.clearAllMocks();
  isWithinScope.mockResolvedValue(true);
  getAuthorizationContext.mockResolvedValue({ isSuperAdmin: false });
  teamsModel.getTeamById.mockResolvedValue({ rows: [{ id: "TEAM-1", program_id: "P1" }] });
  groupsModel.getOrgTeams.mockResolvedValue({ rows: [{ id: "TEAM-1", program_id: "P1" }] });
});

describe("the record-scope guard runs on every team write", () => {
  test("creating an org team consults the scope of its program", async () => {
    const res = await teams.POST(post("http://localhost/api/teams", { program_id: "P1", name: "Alpha" }));

    expect(res.status).toBe(200);
    expect(isWithinScope).toHaveBeenCalledWith("program_staffed", "USR_STAFF", "P1", {
      email: "s@x.test",
    });
    expect(groupsModel.createOrgTeam).toHaveBeenCalled();
  });

  test("updating a team resolves its program first, then checks it", async () => {
    const res = await teams.PUT(put("http://localhost/api/teams", { id: "TEAM-1", name: "Renamed" }));

    expect(res.status).toBe(200);
    expect(groupsModel.getOrgTeams).toHaveBeenCalledWith(null, "TEAM-1");
    expect(isWithinScope).toHaveBeenCalledWith("program_staffed", "USR_STAFF", "P1", {
      email: "s@x.test",
    });
  });

  test("deleting a squad resolves its program first, then checks it", async () => {
    const res = await pmTeams.DELETE(del("http://localhost/api/pm/teams", { id: "TEAM-1" }));

    expect(res.status).toBe(200);
    expect(teamsModel.getTeamById).toHaveBeenCalledWith("TEAM-1");
    expect(isWithinScope).toHaveBeenCalled();
    expect(teamsModel.deleteTeam).toHaveBeenCalledWith("TEAM-1");
  });
});

describe("a team write outside your programs is refused, with nothing written", () => {
  test("pm/teams POST into a foreign program is refused", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await pmTeams.POST(
      post("http://localhost/api/pm/teams", { program_id: "P-OTHER", name: "Beta" }),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(res.headers.get("X-Authz-Decision")).toBe("out-of-scope");
    expect(body.missing).toEqual({ scope: "program_staffed", wave: "groups" });
    expect(teamsModel.createTeam).not.toHaveBeenCalled();
  });

  test("pm/teams DELETE of a foreign squad is refused", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await pmTeams.DELETE(del("http://localhost/api/pm/teams", { id: "TEAM-1" }));

    expect(res.status).toBe(403);
    expect(teamsModel.deleteTeam).not.toHaveBeenCalled();
  });

  test("pm/teams PATCH on a foreign squad is refused before the action runs", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await pmTeams.PATCH(
      patch("http://localhost/api/pm/teams", { team_id: "TEAM-1", action: "update_handler", handler_id: "H" }),
    );

    expect(res.status).toBe(403);
    expect(teamsModel.updateTeamHandler).not.toHaveBeenCalled();
  });

  test("teams POST into a foreign program is refused", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await teams.POST(post("http://localhost/api/teams", { program_id: "P-OTHER", name: "Beta" }));

    expect(res.status).toBe(403);
    expect(groupsModel.createOrgTeam).not.toHaveBeenCalled();
  });

  test("teams PUT of a foreign squad is refused", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await teams.PUT(put("http://localhost/api/teams", { id: "TEAM-1", name: "Renamed" }));

    expect(res.status).toBe(403);
    expect(groupsModel.updateOrgTeam).not.toHaveBeenCalled();
  });

  test("teams DELETE of a foreign squad is refused", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await teams.DELETE(del("http://localhost/api/teams", { id: "TEAM-1" }));

    expect(res.status).toBe(403);
    expect(groupsModel.deleteOrgTeam).not.toHaveBeenCalled();
  });

  test("adding a member to a foreign group is refused, and no membership is inserted", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await groupMembers.POST(
      post("http://localhost/api/group-members", { group_id: 7, participant_id: "U1" }),
    );

    expect(res.status).toBe(403);
    expect(__builder.insert).not.toHaveBeenCalled();
  });

  test("an unresolvable team program is refused, never allowed", async () => {
    teamsModel.getTeamById.mockResolvedValueOnce({ rows: [] });
    const res = await pmTeams.DELETE(del("http://localhost/api/pm/teams", { id: "TEAM-X" }));

    expect(res.status).toBe(403);
    expect(res.headers.get("X-Authz-Decision")).toBe("unresolvable");
    expect(teamsModel.deleteTeam).not.toHaveBeenCalled();
  });
});

describe("Super Admin is never scoped", () => {
  test("a Super Admin may create an org team in any program", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true });
    isWithinScope.mockResolvedValueOnce(false);

    const res = await teams.POST(post("http://localhost/api/teams", { program_id: "P-OTHER", name: "Beta" }));

    expect(res.status).toBe(200);
    expect(groupsModel.createOrgTeam).toHaveBeenCalled();
  });

  test("admin group membership in any program is allowed for a Super Admin", async () => {
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true });
    isWithinScope.mockResolvedValueOnce(false);

    const res = await groupMembers.POST(
      post("http://localhost/api/group-members", { group_id: 7, participant_id: "U1" }),
    );

    expect(res.status).toBe(200);
    expect(__builder.insert).toHaveBeenCalled();
  });
});
