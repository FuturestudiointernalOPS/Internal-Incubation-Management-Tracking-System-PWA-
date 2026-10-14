/**
 * Route protection — the landing page at "/" must stay reachable WITHOUT a
 * session.
 *
 * It is a signed-out visitor's front door: a short presentation of the platform
 * and the single button that leads to the login screen. It reads no data, so the
 * session gate has no reason to answer it — and when it did, an anonymous visitor
 * asking for "/" never saw the page and was bounced straight to /login.
 */

const { proxy } = require("@/proxy");

const request = (pathname) => ({
  nextUrl: { pathname },
  url: `https://app.example${pathname}`,
  cookies: { get: () => undefined },
});

describe("proxy — public landing page", () => {
  it("lets the landing page through without a session", () => {
    const res = proxy(request("/"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("still sends an anonymous visitor of a private page to the login screen", () => {
    const res = proxy(request("/admin"));

    expect(res.headers.get("location")).toContain("/login");
  });
});
