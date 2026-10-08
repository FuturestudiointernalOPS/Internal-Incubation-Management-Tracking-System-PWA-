/**
 * Shared wiring for the project collaboration route tests.
 *
 * The db mock matches on SQL substrings, so it has to answer per statement and
 * log what ran. A suite registers it as
 * `jest.mock("@/lib/db", () => mockProj.dbMock())` — the `mock` prefix is what
 * lets babel-plugin-jest-hoist accept the out-of-scope reference, and the
 * factory only runs once a route requires "@/lib/db", after this module is
 * loaded.
 *
 * Jest's module registry is per test file, so every suite that requires this
 * helper gets its OWN executedQueries log, mockState and session.
 */

const executedQueries = [];

// Mutable inputs the mocked statements read per test.
const mockState = { invitation: null, invitationRows: [] };

const mockSession = {
  cid: "user-1",
  name: "Staff One",
  role: "staff",
  email: "staff@example.io",
};

const requireAuth = jest.fn(async () => null);
const getSession = jest.fn(async () => mockSession);
const requireProjectAccess = jest.fn(async () => null);
const requireAuthorization = jest.fn(async () => null);

const readJson = (res) => res.json();

const req = (url, { method = "GET", body } = {}) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const count = (substring) =>
  executedQueries.filter((query) => query.sql.includes(substring)).length;

function dbMock() {
  return {
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
  };
}

function authMock() {
  return { requireAuth, getSession, requireProjectAccess };
}

function authorizationMock() {
  return { requireAuthorization };
}

/** The whole beforeEach: the query log, the mutable inputs and the session. */
function reset() {
  executedQueries.length = 0;
  mockState.invitation = null;
  mockState.invitationRows = [];
  mockSession.cid = "user-1";
  mockSession.name = "Staff One";
  mockSession.role = "staff";
  requireProjectAccess.mockResolvedValue(null);
  requireAuthorization.mockResolvedValue(null);
}

module.exports = {
  dbMock,
  authMock,
  authorizationMock,
  readJson,
  req,
  count,
  reset,
  executedQueries,
  mockState,
  mockSession,
};
