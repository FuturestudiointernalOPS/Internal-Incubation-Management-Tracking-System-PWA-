/**
 * SESSION READ SHARING — regression guard for the in-flight session reads.
 *
 * A page load fires several requests at once. On a cold cache every one of them
 * used to miss and issue the SAME session select in parallel (seen in the logs
 * as a burst of identical slow queries). The first caller now performs the read
 * and the others await it.
 *
 * What must stay true (this is the authentication path):
 *   - concurrent callers for one token resolve to the SAME session, from ONE read;
 *   - a session whose user standing is rejected is never served and never cached;
 *   - two different tokens are never served the same session.
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

const { cookies } = require("next/headers");
const { getSession } = require("@/lib/auth");

/** Session rows keyed by the value stored in the token hash column. */
function serveSessions(byHash) {
  mockExecute.mockImplementation(async (query = {}) => {
    const sql = String(query.sql || "");
    if (!sql.includes("FROM user_sessions")) return { rows: [] };
    const row = byHash[String(query.args?.[0])];
    return { rows: row ? [row] : [] };
  });
}

function sessionReads() {
  return mockExecute.mock.calls.filter((call) =>
    String(call[0]?.sql || "").includes("FROM user_sessions"),
  );
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
    ...overrides,
  };
}

beforeEach(() => {
  mockExecute.mockReset();
  cookies.mockReset();
});

test("concurrent callers for one token share ONE session read", async () => {
  serveSessions({ "hash-token-1": asUser("U1", "token-1") });
  cookies.mockResolvedValue({ get: () => ({ value: "token-1" }) });

  const [firstSession, secondSession, thirdSession] = await Promise.all([getSession(), getSession(), getSession()]);

  expect(firstSession).toBeTruthy();
  expect(secondSession).toEqual(firstSession);
  expect(thirdSession).toEqual(firstSession);
  expect(sessionReads()).toHaveLength(1);
});

test("a following call is served from the cache, not the database", async () => {
  serveSessions({ "hash-token-2": asUser("U2", "token-2") });
  cookies.mockResolvedValue({ get: () => ({ value: "token-2" }) });

  await getSession();
  mockExecute.mockClear();
  const cached = await getSession();

  expect(cached).toBeTruthy();
  expect(sessionReads()).toHaveLength(0);
});

test("a rejected user standing is never served and never cached", async () => {
  serveSessions({
    "hash-token-3": asUser("U3", "token-3", { status: "suspended" }),
  });
  cookies.mockResolvedValue({ get: () => ({ value: "token-3" }) });

  expect(await getSession()).toBeNull();

  mockExecute.mockClear();
  expect(await getSession()).toBeNull();
  // The rejection was not cached as an answer: the read happens again.
  expect(sessionReads().length).toBeGreaterThan(0);
});

test("an unknown token resolves to null for every caller", async () => {
  serveSessions({});
  cookies.mockResolvedValue({ get: () => ({ value: "token-unknown" }) });

  const [firstSession, secondSession] = await Promise.all([getSession(), getSession()]);

  expect(firstSession).toBeNull();
  expect(secondSession).toBeNull();
  expect(sessionReads()).toHaveLength(2); // hash lookup + plaintext fallback
});

test("two different tokens are never served the same session", async () => {
  serveSessions({
    "hash-token-4": asUser("U4", "token-4"),
    "hash-token-5": asUser("U5", "token-5"),
  });
  cookies
    .mockResolvedValueOnce({ get: () => ({ value: "token-4" }) })
    .mockResolvedValue({ get: () => ({ value: "token-5" }) });

  const first = await getSession();
  const second = await getSession();

  expect(first.cid).toBe("U4");
  expect(second.cid).toBe("U5");
});
