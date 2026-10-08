/**
 * Characterisation tests for the answer to a project invitation:
 *   src/app/api/projects/invitations/respond/route.js
 *
 * The invitee's accept or decline, the inviter's (or Super Admin's) cancel, and
 * the 404/400/403 guards around them. The other collaboration routes are in
 * projects-collaboration-api.test.js; the wiring lives in
 * ./helpers/projectsCollaborationHarness.
 *
 * The db layer is mocked with SQL-substring matching, so as long as the queries
 * stay byte-identical the assertions keep passing.
 */

const mockProj = require("./helpers/projectsCollaborationHarness");

jest.mock("@/lib/db", () => mockProj.dbMock());
jest.mock("@/server/auth/guards", () => ({ requireAuth: mockProj.authMock().requireAuth }));
jest.mock("@/server/auth/session", () => ({ getSession: mockProj.authMock().getSession }));
jest.mock("@/server/authz/guards", () => ({ requireProjectAccess: mockProj.authMock().requireProjectAccess }));
jest.mock("@/models/authorization/index", () => mockProj.authorizationMock());


const respond = require("@/app/api/projects/invitations/respond/route");

const { readJson, req, count, executedQueries, mockState, mockSession, reset } = mockProj;

beforeEach(() => {
  reset();
});

describe("POST /api/projects/invitations/respond", () => {
  test("requires invitation_id and action", async () => {
    const res = await respond.POST(
      req("/api/projects/invitations/respond", { method: "POST", body: {} }),
    );
    expect(res.status).toBe(400);
  });

  test("an unknown invitation is a 404", async () => {
    const res = await respond.POST(
      req("/api/projects/invitations/respond", {
        method: "POST",
        body: { invitation_id: 1, action: "accept" },
      }),
    );
    expect(res.status).toBe(404);
  });

  test("an invitation that is no longer pending is a 400", async () => {
    mockState.invitation = { id: 1, status: "accepted", invitee_id: "user-1" };
    const res = await respond.POST(
      req("/api/projects/invitations/respond", {
        method: "POST",
        body: { invitation_id: 1, action: "accept" },
      }),
    );
    expect(res.status).toBe(400);
  });

  test("only the inviter (or Super Admin) may cancel", async () => {
    mockState.invitation = {
      id: 1,
      status: "pending",
      inviter_id: "Someone Else",
      invitee_id: "user-1",
    };
    const res = await respond.POST(
      req("/api/projects/invitations/respond", {
        method: "POST",
        body: { invitation_id: 1, action: "cancel" },
      }),
    );
    expect(res.status).toBe(403);
  });

  test("the inviter can cancel", async () => {
    mockState.invitation = {
      id: 1,
      status: "pending",
      inviter_id: "Someone Else",
      invitee_id: "other",
    };
    mockSession.cid = "inviter-cid";
    const res = await respond.POST(
      req("/api/projects/invitations/respond", {
        method: "POST",
        body: { invitation_id: 1, action: "cancel" },
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "cancelled" });
  });

  test("only the invitee can accept or decline", async () => {
    mockState.invitation = {
      id: 1,
      status: "pending",
      inviter_id: "Someone Else",
      invitee_id: "not-me",
    };
    const res = await respond.POST(
      req("/api/projects/invitations/respond", {
        method: "POST",
        body: { invitation_id: 1, action: "decline" },
      }),
    );
    expect(res.status).toBe(403);
  });

  test("the invitee declines", async () => {
    mockState.invitation = {
      id: 1,
      status: "pending",
      inviter_id: "Someone Else",
      invitee_id: "user-1",
    };
    const res = await respond.POST(
      req("/api/projects/invitations/respond", {
        method: "POST",
        body: { invitation_id: 1, action: "decline" },
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "declined" });
    expect(count("SET status = 'declined'")).toBe(1);
  });

  test("the invitee accepts: joins the project, marks it, notifies the inviter", async () => {
    mockState.invitation = {
      id: 1,
      status: "pending",
      inviter_id: "Someone Else",
      invitee_id: "user-1",
      project_id: "1",
      role: "member",
    };
    const res = await respond.POST(
      req("/api/projects/invitations/respond", {
        method: "POST",
        body: { invitation_id: 1, action: "accept" },
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "accepted" });

    const memberInsert = executedQueries.find((query) =>
      query.sql.includes("INSERT INTO project_members (project_id, user_cid, role, assigned_at)"),
    );
    expect(memberInsert.args).toEqual(["1", "user-1", "member", "member"]);
    expect(count("SET status = 'accepted'")).toBe(1);
    const notif = executedQueries.find((query) =>
      query.sql.includes("INSERT INTO v2_notifications"),
    );
    expect(notif.args[0]).toBe("inviter-cid");
  });

  test("an unknown action is a 400", async () => {
    mockState.invitation = {
      id: 1,
      status: "pending",
      inviter_id: "Someone Else",
      invitee_id: "user-1",
    };
    const res = await respond.POST(
      req("/api/projects/invitations/respond", {
        method: "POST",
        body: { invitation_id: 1, action: "explode" },
      }),
    );
    expect(res.status).toBe(400);
  });
});
