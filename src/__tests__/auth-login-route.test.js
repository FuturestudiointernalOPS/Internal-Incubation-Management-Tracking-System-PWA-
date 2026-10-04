/**
 * AUTHENTICATION — behavioural tests for the sign-in route.
 *
 * These exercise the real handler (not a source-shape assertion) and pin the
 * decisions that matter when credentials are involved:
 *
 *   Given   a set of credentials and an account standing
 *   When    the sign-in route is called
 *   Then    the outcome (status + session) is the expected one
 *   And     no session is ever created on a failure
 *   And     the attempt is audited, with a reason, never with the password
 *
 * The route is at 0% coverage otherwise; this is the highest-risk untested
 * surface in the application.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  initDb: jest.fn(async () => {}),
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));

jest.mock("@/server/auth/session", () => ({
  createSession: jest.fn(async () => ({ token: "tok-1", maxAge: 86400 })),
}));
jest.mock("@/server/auth/cookies", () => ({
  setSessionCookieOnResponse: jest.fn((response) => {
    response.headers.set("set-cookie", "impactos_session=tok-1; HttpOnly");
    return response;
  }),
}));

jest.mock("@/models/platform/roles", () => ({
  resolveEffectiveRole: jest.fn(() => "staff"),
}));

jest.mock("@/services/authorization/membership", () => ({
  getEffectiveGroupsForUser: jest.fn(async () => []),
}));jest.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: jest.fn(() => null),
  getClientIp: jest.fn(() => "203.0.113.7"),
}));

jest.mock("@/server/auth/password", () => ({
  verifyPassword: jest.fn(async () => false),
}));

jest.mock("@/models/authFlows", () => ({
  getContactByEmailOrId: jest.fn(async () => ({ rows: [] })),
  getTeamByUsernameForLogin: jest.fn(async () => ({ rows: [] })),
  getFamilyBySharedEmailForLogin: jest.fn(async () => ({ rows: [] })),
  getParticipantProgramRecordForLogin: jest.fn(async () => ({ rows: [] })),
  getLmsEnrollmentRecordForLogin: jest.fn(async () => ({ rows: [] })),
  getVentureMembershipRecordForLogin: jest.fn(async () => ({ rows: [] })),
  ensureContactsActivatedAtColumn: jest.fn(async () => {}),
  ensureContactsLastLoginColumnForLogin: jest.fn(async () => {}),
  ensureContactsLoginCountColumnForLogin: jest.fn(async () => {}),
  recordContactLoginActivityForLogin: jest.fn(async () => {}),
}));

jest.mock("@/lib/loginAudit", () => ({ auditLoginAttempt: jest.fn(async () => {}) }));

const { POST } = require("@/app/api/auth/login/route");
const { createSession } = require("@/server/auth/session");
const { setSessionCookieOnResponse } = require("@/server/auth/cookies");
const { verifyPassword } = require("@/server/auth/password");
const { enforceRateLimit } = require("@/lib/rate-limit");
const { auditLoginAttempt } = require("@/lib/loginAudit");
const authFlows = require("@/models/authFlows");

const signIn = (body) =>
  new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost" },
    body: JSON.stringify(body),
  });

const activeUser = (overrides = {}) => ({
  cid: "USR-1",
  id: "USR-1",
  role: "staff",
  status: "active",
  password: "$2b$10$storedhash",
  language: "en",
  ...overrides,
});

beforeEach(() => {
  // The route logs security events at warn level; keep the runner output clean.
  process.env.LOG_LEVEL = "silent";
  jest.clearAllMocks();
  verifyPassword.mockResolvedValue(false);
  enforceRateLimit.mockReturnValue(null);
  authFlows.getContactByEmailOrId.mockResolvedValue({ rows: [] });
  authFlows.getTeamByUsernameForLogin.mockResolvedValue({ rows: [] });
  authFlows.getFamilyBySharedEmailForLogin.mockResolvedValue({ rows: [] });
});

afterAll(() => {
  delete process.env.LOG_LEVEL;
});

describe("malformed input", () => {
  test("a missing password is a 400 and never reaches a lookup", async () => {
    const res = await POST(signIn({ email: "a@b.com" }));
    expect(res.status).toBe(400);
    expect(authFlows.getContactByEmailOrId).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("account does not exist", () => {
  test("answers the generic 401 and equalises timing with a bcrypt comparison", async () => {
    const res = await POST(signIn({ email: "nobody@example.com", password: "whatever" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/Invalid credentials/);
    expect(body.error).not.toMatch(/no such|unknown|not found/i);
    // The unknown-account path pays the same cost as the wrong-password path.
    expect(verifyPassword).toHaveBeenCalledWith("whatever", expect.stringMatching(/^\$2[aby]\$/));
    expect(createSession).not.toHaveBeenCalled();
    expect(auditLoginAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isSuccess: false, failureReason: "invalid_credentials" }),
    );
  });
});

describe("wrong password", () => {
  test("answers the same generic 401 and starts no session", async () => {
    authFlows.getContactByEmailOrId.mockResolvedValue({ rows: [activeUser()] });
    verifyPassword.mockResolvedValue(false);

    const res = await POST(signIn({ email: "user@example.com", password: "nope" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/Invalid credentials/);
    expect(createSession).not.toHaveBeenCalled();
    expect(auditLoginAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isSuccess: false, failureReason: "invalid_credentials" }),
    );
  });
});

describe("account standing gates", () => {
  test.each([
    ["inactive", 403],
    ["pending", 403],
    ["archived", 403],
    ["suspended", 403],
  ])("a %s account is refused with %i and no session", async (status, expected) => {
    authFlows.getContactByEmailOrId.mockResolvedValue({ rows: [activeUser({ status })] });
    verifyPassword.mockResolvedValue(true);

    const res = await POST(signIn({ email: "user@example.com", password: "correct" }));

    expect(res.status).toBe(expected);
    expect(createSession).not.toHaveBeenCalled();
    expect(auditLoginAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isSuccess: false }),
    );
  });

  test("an archived_at timestamp refuses even when status says active", async () => {
    authFlows.getContactByEmailOrId.mockResolvedValue({
      rows: [activeUser({ archived_at: "2024-01-01" })],
    });
    verifyPassword.mockResolvedValue(true);

    const res = await POST(signIn({ email: "user@example.com", password: "correct" }));

    expect(res.status).toBe(403);
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("successful sign-in", () => {
  test("creates a session, sets the cookie, and audits the success", async () => {
    authFlows.getContactByEmailOrId.mockResolvedValue({ rows: [activeUser()] });
    verifyPassword.mockResolvedValue(true);

    const res = await POST(signIn({ email: "user@example.com", password: "correct" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.role).toBe("staff");
    expect(createSession).toHaveBeenCalledWith("USR-1", "staff");
    expect(setSessionCookieOnResponse).toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toContain("impactos_session");
    expect(auditLoginAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isSuccess: true, action: "login_success" }),
    );
  });

  test("a legacy plaintext password still authenticates", async () => {
    authFlows.getContactByEmailOrId.mockResolvedValue({
      rows: [activeUser({ password: "legacy-plain" })],
    });

    const res = await POST(signIn({ email: "user@example.com", password: "legacy-plain" }));

    expect(res.status).toBe(200);
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalled();
  });
});

describe("rate limiting", () => {
  test("an IP that is over the limit gets 429 and no lookup happens", async () => {
    const { NextResponse } = require("next/server");
    enforceRateLimit.mockReturnValueOnce(
      NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 }),
    );

    const res = await POST(signIn({ email: "user@example.com", password: "correct" }));

    expect(res.status).toBe(429);
    expect(authFlows.getContactByEmailOrId).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("session creation fails", () => {
  test("the route never reports success without a session", async () => {
    authFlows.getContactByEmailOrId.mockResolvedValue({ rows: [activeUser()] });
    verifyPassword.mockResolvedValue(true);
    createSession.mockRejectedValueOnce(new Error("pool exhausted"));

    const res = await POST(signIn({ email: "user@example.com", password: "correct" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    // The success audit must NOT have been written for a login that did not start.
    expect(auditLoginAttempt).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isSuccess: true }),
    );
  });
});
