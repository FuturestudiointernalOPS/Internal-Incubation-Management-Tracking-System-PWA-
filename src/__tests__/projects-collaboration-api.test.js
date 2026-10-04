/**
 * Characterisation tests for the project collaboration routes:
 *   src/app/api/projects/{members,assignments,discuss}/route.js
 *   src/app/api/projects/invitations/route.js
 *
 * It pins the behaviour (statuses, bodies, which statements run), not the
 * implementation, so it stays valid when the use cases move to the service
 * layer. The db layer is mocked with SQL-substring matching; as long as the
 * queries stay byte-identical the assertions keep passing.
 *
 * The answer to an invitation lives in
 * projects-collaboration-invitations.test.js; the wiring lives in
 * ./helpers/projectsCollaborationHarness.
 */

const mockProj = require("./helpers/projectsCollaborationHarness");

jest.mock("@/lib/db", () => mockProj.dbMock());
jest.mock("@/lib/auth", () => mockProj.authMock());
jest.mock("@/models/authorization/index", () => mockProj.authorizationMock());

const { requireProjectAccess } = require("@/lib/auth");

const members = require("@/app/api/projects/members/route");
const assignments = require("@/app/api/projects/assignments/route");
const discuss = require("@/app/api/projects/discuss/route");
const invitations = require("@/app/api/projects/invitations/route");

const { readJson, req, count, executedQueries, mockState, mockSession, reset } = mockProj;

beforeEach(() => {
  reset();
});

describe("GET /api/projects/members", () => {
  test("project_id is required", async () => {
    const res = await members.GET(req("/api/projects/members"));
    expect(res.status).toBe(400);
  });

  test("returns the members with their names", async () => {
    const res = await members.GET(req("/api/projects/members?project_id=1"));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.members).toEqual([{ user_cid: "u1", role: "lead", name: "One" }]);
  });

  test("a non-portfolio caller must have project access", async () => {
    mockSession.role = "participant";
    requireProjectAccess.mockResolvedValueOnce(
      new Response("{}", { status: 403 }),
    );
    const res = await members.GET(req("/api/projects/members?project_id=1"));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/projects/members", () => {
  test("requires project_id and user_cid", async () => {
    const res = await members.POST(
      req("/api/projects/members", { method: "POST", body: { project_id: "1" } }),
    );
    expect(res.status).toBe(400);
  });

  test("invites the member: cancels a pending invite, inserts one, notifies", async () => {
    const res = await members.POST(
      req("/api/projects/members", {
        method: "POST",
        body: { project_id: "1", user_cid: "invitee", role: "member" },
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "invited" });

    expect(count("WHERE project_id = ? AND invitee_id = ?")).toBe(1);
    const insert = executedQueries.find((query) =>
      query.sql.includes("INSERT INTO project_invitations"),
    );
    expect(insert.args).toEqual(["1", "Staff One", "invitee", "member"]);
    const notif = executedQueries.find((query) =>
      query.sql.includes("INSERT INTO v2_notifications"),
    );
    expect(notif.args[0]).toBe("invitee");
  });

  test("a non-portfolio caller must have project access", async () => {
    mockSession.role = "participant";
    requireProjectAccess.mockResolvedValueOnce(
      new Response("{}", { status: 403 }),
    );
    const res = await members.POST(
      req("/api/projects/members", {
        method: "POST",
        body: { project_id: "1", user_cid: "invitee" },
      }),
    );
    expect(res.status).toBe(403);
    expect(count("INSERT INTO project_invitations")).toBe(0);
  });
});

describe("DELETE /api/projects/members", () => {
  test("requires project_id and user_cid", async () => {
    const res = await members.DELETE(
      req("/api/projects/members?project_id=1"),
    );
    expect(res.status).toBe(400);
  });

  test("removes the member", async () => {
    const res = await members.DELETE(
      req("/api/projects/members?project_id=1&user_cid=u1"),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, action: "removed" });
    expect(count("DELETE FROM project_members")).toBe(1);
  });
});

describe("GET /api/projects/assignments", () => {
  test("merges owned + collab into a deduplicated list", async () => {
    const res = await assignments.GET(
      req("/api/projects/assignments?user_cid=user-1"),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.owned).toHaveLength(1);
    expect(data.collab).toHaveLength(2);
    expect(data.myProjects.map((project) => project.id)).toEqual(["1", "2"]);
    // Portfolio roles also get the unlinked dropdown.
    expect(data.all_active).toHaveLength(3);
  });

  test("a non-portfolio caller only sees their own assignments (403)", async () => {
    mockSession.role = "participant";
    const res = await assignments.GET(
      req("/api/projects/assignments?user_cid=someone-else"),
    );
    expect(res.status).toBe(403);
  });

  test("a non-portfolio caller does not get the all_active dropdown", async () => {
    mockSession.role = "participant";
    const res = await assignments.GET(
      req("/api/projects/assignments"),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.all_active).toEqual([]);
    expect(count("WHERE status != 'Archived' AND status != 'Completed'")).toBe(0);
  });
});

describe("GET /api/projects/discuss", () => {
  test("project_id is required", async () => {
    const res = await discuss.GET(req("/api/projects/discuss"));
    expect(res.status).toBe(400);
  });

  test("returns the messages", async () => {
    const res = await discuss.GET(req("/api/projects/discuss?project_id=1"));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.messages).toHaveLength(1);
  });
});

describe("POST /api/projects/discuss", () => {
  test("requires project_id, sender_id and a non-empty body", async () => {
    const res = await discuss.POST(
      req("/api/projects/discuss", {
        method: "POST",
        body: { project_id: "1", sender_id: "sender", body: "   " },
      }),
    );
    expect(res.status).toBe(400);
  });

  test("posts the message and fans out to owner, members (minus sender) and mentions", async () => {
    const res = await discuss.POST(
      req("/api/projects/discuss", {
        method: "POST",
        body: {
          project_id: "1",
          sender_id: "sender",
          sender_name: "Sender",
          body: "hello @Mention One",
        },
      }),
    );
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, id: 9, created_at: "2026-01-01T00:00:00Z" });

    const recipients = executedQueries
      .filter((query) => query.sql.includes("INSERT INTO v2_notifications"))
      .map((query) => query.args[0]);
    // owner + m1 (sender skipped, owner deduped) + the mentioned contact
    expect(recipients.sort()).toEqual(["m1", "mention1", "owner"]);
  });
});

describe("GET /api/projects/invitations", () => {
  test("a portfolio caller sees all pending invitations by default", async () => {
    mockState.invitationRows = [{ id: 5, status: "pending" }];
    const res = await invitations.GET(req("/api/projects/invitations"));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.invitations).toHaveLength(1);
    const query = executedQueries.find((entry) =>
      entry.sql.includes("SELECT pi.*"),
    );
    expect(query.args).toEqual(["pending"]);
  });

  test("a non-portfolio caller is pinned to their own invitations", async () => {
    mockSession.role = "participant";
    mockState.invitationRows = [];
    await invitations.GET(req("/api/projects/invitations"));
    const query = executedQueries.find((entry) =>
      entry.sql.includes("SELECT pi.*"),
    );
    expect(query.args).toEqual(["user-1", "pending"]);
  });

  test("a non-portfolio caller cannot ask for somebody else's (403)", async () => {
    mockSession.role = "participant";
    const res = await invitations.GET(
      req("/api/projects/invitations?invitee_id=someone-else"),
    );
    expect(res.status).toBe(403);
  });
});
