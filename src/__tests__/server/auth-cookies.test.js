/**
 * AUTHENTICATION — session cookie seam.
 *
 * The cookie is the only credential the browser holds, so its attributes are a
 * security contract, not a detail: httpOnly (no script read), sameSite=lax
 * (no cross-site send), secure in production only, and a domain that is scoped
 * to a real hostname — never to localhost, an IP or a bare single-label host.
 */

jest.mock("next/headers", () => ({ cookies: jest.fn() }));

const { cookies } = require("next/headers");
const {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_HOURS,
  REMEMBER_ME_DURATION_HOURS,
  sessionMaxAgeSeconds,
  sessionDurationMs,
  resolveCookieDomain,
  readSessionToken,
  setSessionCookieOnResponse,
  clearSessionCookie,
} = require("@/server/auth/cookies");

function fakeResponse() {
  return { cookies: { set: jest.fn() } };
}

beforeEach(() => {
  cookies.mockReset();
  delete process.env.NODE_ENV;
});

describe("session durations", () => {
  it("keeps a 24h session and a 30-day remember-me", () => {
    expect(SESSION_COOKIE_NAME).toBe("impactos_session");
    expect(SESSION_DURATION_HOURS).toBe(24);
    expect(REMEMBER_ME_DURATION_HOURS).toBe(720);
    expect(sessionMaxAgeSeconds(false)).toBe(24 * 60 * 60);
    expect(sessionMaxAgeSeconds(true)).toBe(720 * 60 * 60);
    expect(sessionDurationMs(false)).toBe(24 * 60 * 60 * 1000);
    expect(sessionDurationMs(true)).toBe(720 * 60 * 60 * 1000);
  });
});

describe("resolveCookieDomain", () => {
  it.each([
    [undefined, undefined],
    ["", undefined],
    ["localhost", undefined],
    ["localhost:3000", undefined],
    [".localhost:3000", undefined],
    ["127.0.0.1", undefined],
    ["127.0.0.1:3000", undefined],
    ["[::1]", undefined],
    ["something_local", undefined],
    ["nodomain", undefined],
    ["impactos.org", "impactos.org"],
    ["APP.ImpactOS.org:443", "app.impactos.org"],
  ])("maps %s to %s", (host, expected) => {
    expect(resolveCookieDomain(host)).toBe(expected);
  });
});

describe("setSessionCookieOnResponse", () => {
  it("sets an httpOnly, lax, root-scoped cookie", () => {
    const response = fakeResponse();

    setSessionCookieOnResponse(response, "tok-1", 3600, "app.impactos.org");

    const [name, value, options] = response.cookies.set.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(value).toBe("tok-1");
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
      domain: "app.impactos.org",
    });
  });

  it("never scopes the cookie to localhost", () => {
    const response = fakeResponse();

    setSessionCookieOnResponse(response, "tok-2", 3600, "localhost:3000");

    expect(response.cookies.set.mock.calls[0][2]).not.toHaveProperty("domain");
  });

  it("marks the cookie secure only in production", () => {
    const dev = fakeResponse();
    setSessionCookieOnResponse(dev, "tok-3", 3600);
    expect(dev.cookies.set.mock.calls[0][2].secure).toBe(false);

    process.env.NODE_ENV = "production";
    const prod = fakeResponse();
    setSessionCookieOnResponse(prod, "tok-4", 3600);
    expect(prod.cookies.set.mock.calls[0][2].secure).toBe(true);
  });
});

describe("reading and clearing the cookie", () => {
  it("returns the token, or null when there is none", async () => {
    cookies.mockResolvedValueOnce({ get: () => ({ value: "tok-5" }) });
    expect(await readSessionToken()).toBe("tok-5");

    cookies.mockResolvedValueOnce({ get: () => undefined });
    expect(await readSessionToken()).toBeNull();
  });

  it("clears the cookie on logout", async () => {
    const store = { delete: jest.fn() };
    cookies.mockResolvedValue(store);

    await clearSessionCookie();

    expect(store.delete).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
  });
});
