/**
 * Characterisation tests for the project collaboration routes:
 *   src/app/api/projects/{members,assignments,discuss}/route.js
 *   src/app/api/projects/invitations/route.js
 *   src/app/api/projects/invitations/respond/route.js
 *
 * It pins the behaviour (statuses, bodies, which statements run), not the
 * implementation, so it stays valid when the use cases move to the service
 * layer. The db layer is mocked with SQL-substring matching; as long as the
 * queries stay byte-identical the assertions keep passing.
 */

const executedQueries = [];

// Mutable inputs the mocked statements read per test.
const mockState = { invitation: null, invitationRows: [] };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args }) => {
      executedQueries.push({ sql, args });

      // --- collaboration reads -------------------------------------------
      if (sql.includes("SELECT pm.*, c.name")) {
        return { rows: [{ user_cid: "u1", role: "lead", name: "One" }] };
      }
      if (sql.includes("SELECT name FROM v2_projects")) {
        return { rows: [{ name: "Website" }] };
      }
      if (sql.includes("SELECT v2_messages.id")) {
        return { rows: [{ id: 9, sender_id: "sender", body: "hi" }] };
      }
      if (sql.includes("SELECT user_cid FROM project_members")) {
        return {
          rows: [{ user_cid: "owner" }, { user_cid: "m1" }, { user_cid: "sender" }],
        };
      }
      if (sql.includes("SELECT owner_id, name FROM v2_projects")) {
        return { rows: [{ owner_id: "owner", name: "Website" }] };
      }
      if (sql.includes("SELECT cid, name FROM contacts")) {
        return { rows: [{ cid: "mention1", name: "Mention One" }] };
      }
      if (sql.includes("SELECT pi.*, p.name as project_name")) {
        return { rows: mockState.invitationRows };
      }
      if (sql.includes("FROM project_invitations WHERE id = ?")) {
        return { rows: mockState.invitation ? [mockState.invitation] : [] };
      }
      if (sql.includes("SELECT cid FROM contacts WHERE name = ?")) {
        return { rows: [{ cid: "inviter-cid" }] };
      }

      // --- assignments reads ---------------------------------------------
      if (sql.includes("WHERE owner_id = ? AND status != 'Archived'")) {
        return { rows: [{ id: "1", name: "Owned", status: "Active" }] };
      }
      if (sql.includes("pm.role as member_role")) {
        return {
          rows: [
            { id: "1", name: "Owned", status: "Active", member_role: "member" },
            { id: "2", name: "Collab", status: "Active", member_role: "member" },
          ],
        };
      }
      if (sql.includes("WHERE status != 'Archived' AND status != 'Completed'")) {
        return {
          rows: [
            { id: "1", name: "Owned", status: "Active" },
            { id: "2", name: "Collab", status: "Active" },
            { id: "3", name: "Other", status: "Active" },
          ],
        };
      }

      // --- writes ---------------------------------------------------------
      if (sql.includes("WHERE project_id = ? AND invitee_id = ?")) {
        return { rows: [], rowsAffected: 1 };
      }
      if (sql.includes("INSERT INTO project_invitations")) {
        return { rows: [{ id: 5 }], lastInsertRowid: 5 };
      }
      if (sql.includes("INSERT INTO v2_messages")) {
        return { rows: [{ id: 9, created_at: "2026-01-01T00:00:00Z" }] };
      }
      if (sql.includes("INSERT INTO project_members (project_id, user_cid, role, assigned_at)")) {
        return { rows: [], rowsAffected: 1 };
      }
      if (sql.includes("UPDATE project_invitations SET status = 'accepted'")) {
        return { rows: [], rowsAffected: 1 };
      }
      if (sql.includes("UPDATE project_invitations SET status = 'declined'")) {
        return { rows: [], rowsAffected: 1 };
      }
      if (sql.includes("DELETE FROM project_members")) {
        return { rows: [], rowsAffected: 1 };
      }
      if (sql.includes("INSERT INTO v2_notifications")) {
        return { rows: [], rowsAffected: 1 };
      }
      return { rows: [], rowsAffected: 1 };
    }),
  },
  initDb: jest.fn(async () => true),
}));

const mockSession = {
  cid: "user-1",
  name: "Staff One",
  role: "staff",
  email: "staff@example.io",
};

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => mockSession),
  requireProjectAccess: jest.fn(async () => null),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireProjectAccess } = require("@/lib/auth");
const { requireAuthorization } = require("@/models/authorization/index");

const members = require("@/app/api/projects/members/route");
const assignments = require("@/app/api/projects/assignments/route");
const discuss = require("@/app/api/projects/discuss/route");
const invitations = require("@/app/api/projects/invitations/route");
const respond = require("@/app/api/projects/invitations/respond/route");

const readJson = (res) => res.json();
const req = (url, { method = "GET", body } = {}) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const count = (substring) =>
  executedQueries.filter((query) => query.sql.includes(substring)).length;

beforeEach(() => {
  executedQueries.length = 0;
  mockState.invitation = null;
  mockState.invitationRows = [];
  mockSession.cid = "user-1";
  mockSession.name = "Staff One";
  mockSession.role = "staff";
  requireProjectAccess.mockResolvedValue(null);
  requireAuthorization.mockResolvedValue(null);
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
