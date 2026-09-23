/**
 * AUTHENTICATION — guards.
 *
 * These are the two questions an endpoint asks before doing anything:
 * `requireSession()` ("is there a session, and may this role pass?") and
 * `requireAuth()` (the API-shaped twin, which returns a response instead of
 * throwing). Both answer WHO, never WHAT — resource-level authorization is a
 * different layer.
 */

jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));

const { getSession } = require("@/server/auth/session");
const { requireSession, requireAuth } = require("@/server/auth/guards");

const STAFF = { cid: "USR1", role: "staff", name: "S", email: "s@example.com" };

async function body(response) {
  return response.json();
}

beforeEach(() => {
  getSession.mockReset();
});

describe("requireSession", () => {
  it("throws Unauthorized when there is no session", async () => {
    getSession.mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow("Unauthorized");
  });

  it("throws Forbidden when the role is not allowed", async () => {
    getSession.mockResolvedValue({ ...STAFF, role: "participant" });

    await expect(requireSession(["staff"])).rejects.toThrow("Forbidden");
  });

  it("returns the session when the role is allowed", async () => {
    getSession.mockResolvedValue(STAFF);

    await expect(requireSession(["staff", "super_admin"])).resolves.toEqual(STAFF);
  });

  it("accepts any authenticated user when no role list is given", async () => {
    getSession.mockResolvedValue({ ...STAFF, role: "participant" });

    await expect(requireSession()).resolves.toMatchObject({ role: "participant" });
  });
});

describe("requireAuth", () => {
  it("answers 401 with the i18n key when there is no session", async () => {
    getSession.mockResolvedValue(null);

    const response = await requireAuth();

    expect(response.status).toBe(401);
    expect(await body(response)).toEqual({
      success: false,
      error: "errors.authRequired",
    });
  });

  it("answers 403 with the i18n key when the role is not allowed", async () => {
    getSession.mockResolvedValue({ ...STAFF, role: "participant" });

    const response = await requireAuth(["super_admin"]);

    expect(response.status).toBe(403);
    expect(await body(response)).toEqual({
      success: false,
      error: "errors.insufficientPermissions",
    });
  });

  it("answers null when authorized", async () => {
    getSession.mockResolvedValue(STAFF);

    await expect(requireAuth(["staff"])).resolves.toBeNull();
  });

  it("reuses a session handed in by the caller instead of reading it again", async () => {
    await expect(requireAuth(["staff"], STAFF)).resolves.toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("answers 500 when the session read itself fails", async () => {
    getSession.mockRejectedValue(new Error("connection terminated"));

    const response = await requireAuth();

    expect(response.status).toBe(500);
    expect(await body(response)).toEqual({
      success: false,
      error: "errors.authSystemFailure",
    });
  });
});
