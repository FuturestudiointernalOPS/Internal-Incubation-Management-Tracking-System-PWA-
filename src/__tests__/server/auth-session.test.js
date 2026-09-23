/**
 * AUTHENTICATION — session lifecycle.
 *
 * Characterisation of the behaviour the old `src/lib/auth.js` already had, so
 * the extraction into `@/server/auth/session` + `@/models/sessions` cannot
 * change it: at most two live sessions per user, a hashed token lookup with a
 * plaintext fallback for legacy rows, a user-standing check, a bounded read
 * cache, and a logout that also evicts that cache.
 *
 * Tokens are unique per test: the read cache lives in module scope with a 15s
 * TTL, so distinct tokens keep the tests independent without resetting modules.
 */

jest.mock("next/headers", () => ({ cookies: jest.fn() }));

const mockExecute = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => {}),
}));
jest.mock("@/lib/token-hashing", () => ({
  hashToken: (token) => `hash-${token}`,
  ensureTokenHashColumns: jest.fn(async () => {}),
}));
jest.mock("@/lib/identity", () => ({
  deriveLegacyRoleEnabled: () => false,
  deriveLegacyRole: ({ storedRole }) => storedRole,
}));

const { cookies } = require("next/headers");
const { createSession, getSession, destroySession } = require("@/server/auth/session");

let cookieValue;

function storeCookie(token) {
  cookieValue = token;
  cookies.mockResolvedValue({
    get: () => (cookieValue ? { value: cookieValue } : undefined),
    delete: jest.fn(() => {
      cookieValue = null;
    }),
  });
}

function serveSessions({ byHash = {}, byToken = {} } = {}) {
  mockExecute.mockImplementation(async (query = {}) => {
    const sql = String(query.sql || "");
    if (!sql.includes("FROM user_sessions")) return { rows: [] };
    const args = query.args || [];
    if (sql.includes("s.token_hash = ?")) {
      const row = byHash[String(args[0])];
      return { rows: row ? [row] : [] };
    }
    const row = byToken[String(args[0])];
    return { rows: row ? [row] : [] };
  });
}

function calls(needle) {
  return mockExecute.mock.calls.filter((call) => String(call[0]?.sql || "").includes(needle));
}

function asUser(cid, token, overrides = {}) {
  return {
    user_cid: cid,
    name: `User ${cid}`,
    email: `${cid}@example.com`,
    role: "staff",
    status: "active",
    group_name: "FUTURE STUDIO",
    token,
    token_hash: `hash-${token}`,
    is_impersonation: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockExecute.mockReset();
  cookies.mockReset();
  cookieValue = null;
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("createSession", () => {
  it("issues a token, stores its hash, and never stores the token in clear", async () => {
    serveSessions();

    const { token, maxAge, isImpersonation } = await createSession("USR1", "staff");

    const insert = calls("INSERT INTO user_sessions")[0][0];
    expect(token).toEqual(expect.any(String));
    expect(token.length).toBeGreaterThan(0);
    expect(insert.args[0]).toBe(token);
    expect(insert.args[1]).toBe(`hash-${token}`);
    expect(insert.args[2]).toBe("USR1");
    expect(insert.args[3]).toBe("staff");
    expect(insert.args[5]).toBe(false);
    expect(maxAge).toBe(24 * 60 * 60);
    expect(isImpersonation).toBe(false);
  });

  it("stores an expiry one day out by default", async () => {
    serveSessions();

    const before = Date.now();
    await createSession("USR2", "staff");

    const expiresAt = calls("INSERT INTO user_sessions")[0][0].args[4];
    expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    const expires = new Date(`${expiresAt.replace(" ", "T")}Z`).getTime();
    expect(expires - before).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(expires - before).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });

  it("extends the session to 30 days with remember-me", async () => {
    serveSessions();

    const before = Date.now();
    const { maxAge } = await createSession("USR3", "staff", true);

    const expiresAt = calls("INSERT INTO user_sessions")[0][0].args[4];
    const expires = new Date(`${expiresAt.replace(" ", "T")}Z`).getTime();
    expect(maxAge).toBe(720 * 60 * 60);
    expect(expires - before).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });

  it("keeps at most two live sessions, evicting the oldest", async () => {
    mockExecute.mockImplementation(async (query = {}) => {
      const sql = String(query.sql || "");
      if (sql.includes("SELECT id, created_at")) {
        return { rows: [{ id: "s1", created_at: 1 }, { id: "s2", created_at: 2 }] };
      }
      return { rows: [] };
    });

    await createSession("USR4", "staff");

    const deletions = calls("DELETE FROM user_sessions WHERE id = ?");
    expect(deletions).toHaveLength(1);
    expect(deletions[0][0].args).toEqual(["s1"]);
  });

  it("marks an impersonation session", async () => {
    serveSessions();

    await createSession("USR5", "staff", false, true);

    expect(calls("INSERT INTO user_sessions")[0][0].args[5]).toBe(true);
  });
});

describe("getSession", () => {
  it("returns null when no cookie is presented", async () => {
    storeCookie(null);

    await expect(getSession()).resolves.toBeNull();
  });

  it("returns the session shape the endpoints rely on", async () => {
    storeCookie("token-shape");
    serveSessions({ byHash: { "hash-token-shape": asUser("USR6", "token-shape") } });

    await expect(getSession()).resolves.toEqual({
      cid: "USR6",
      name: "User USR6",
      email: "USR6@example.com",
      role: "staff",
      group_name: "FUTURE STUDIO",
      token: "token-shape",
      is_impersonation: false,
    });
  });

  it("looks the token up by hash first", async () => {
    storeCookie("token-hash-first");
    serveSessions({ byHash: { "hash-token-hash-first": asUser("USR7", "token-hash-first") } });

    await getSession();

    const reads = calls("FROM user_sessions");
    expect(reads).toHaveLength(1);
    expect(String(reads[0][0].sql)).toContain("s.token_hash = ?");
    expect(reads[0][0].args).toEqual(["hash-token-hash-first"]);
  });

  it("falls back to the plaintext token for rows written before hashing existed", async () => {
    storeCookie("token-legacy");
    serveSessions({ byToken: { "token-legacy": asUser("USR8", "token-legacy") } });

    const session = await getSession();

    const reads = calls("FROM user_sessions");
    expect(session.cid).toBe("USR8");
    expect(reads).toHaveLength(2);
    expect(String(reads[1][0].sql)).toContain("s.token = ?");
  });

  it("backfills the hash of a legacy row", async () => {
    storeCookie("token-backfill");
    serveSessions({
      byHash: { "hash-token-backfill": asUser("USR9", "token-backfill", { token_hash: null }) },
    });

    await getSession();

    const updates = calls("UPDATE user_sessions SET token_hash");
    expect(updates).toHaveLength(1);
    expect(updates[0][0].args).toEqual(["hash-token-backfill", "token-backfill"]);
  });

  it("refuses a session whose user standing is not active/approved", async () => {
    storeCookie("token-rejected");
    serveSessions({
      byHash: { "hash-token-rejected": asUser("USR10", "token-rejected", { status: "suspended" }) },
    });

    await expect(getSession()).resolves.toBeNull();
  });

  it("lets a super_admin through regardless of standing", async () => {
    storeCookie("token-sa");
    serveSessions({
      byHash: {
        "hash-token-sa": asUser("USR11", "token-sa", { status: "suspended", role: "super_admin" }),
      },
    });

    await expect(getSession()).resolves.toMatchObject({ cid: "USR11", role: "super_admin" });
  });

  it("serves a repeated read from the cache instead of the database", async () => {
    storeCookie("token-cached");
    serveSessions({ byHash: { "hash-token-cached": asUser("USR12", "token-cached") } });

    await getSession();
    mockExecute.mockClear();
    const cached = await getSession();

    expect(cached.cid).toBe("USR12");
    expect(calls("FROM user_sessions")).toHaveLength(0);
  });

  it("never shares one session between two tokens", async () => {
    serveSessions({
      byHash: {
        "hash-token-a": asUser("USR13", "token-a"),
        "hash-token-b": asUser("USR14", "token-b"),
      },
    });

    storeCookie("token-a");
    const first = await getSession();
    storeCookie("token-b");
    const second = await getSession();

    expect(first.cid).toBe("USR13");
    expect(second.cid).toBe("USR14");
  });
});

describe("destroySession", () => {
  it("deletes the row by hash or token and clears the cookie", async () => {
    storeCookie("token-logout");
    serveSessions();

    await destroySession();

    const deletions = calls("DELETE FROM user_sessions WHERE token_hash = ? OR token = ?");
    expect(deletions).toHaveLength(1);
    expect(deletions[0][0].args).toEqual(["hash-token-logout", "token-logout"]);
    expect(cookieValue).toBeNull();
  });

  it("does not serve a destroyed token from the cache", async () => {
    storeCookie("token-destroyed");
    serveSessions({ byHash: { "hash-token-destroyed": asUser("USR15", "token-destroyed") } });

    expect(await getSession()).toBeTruthy(); // cached from here on

    await destroySession();
    mockExecute.mockClear();
    serveSessions({}); // the row is gone

    // A second tab still presents the destroyed token: it must reach the
    // database and find nothing, never the cache.
    storeCookie("token-destroyed");
    await expect(getSession()).resolves.toBeNull();
    expect(calls("FROM user_sessions").length).toBeGreaterThan(0);
  });
});
