/**
 * Route protection — the member invitation link must stay reachable WITHOUT a
 * session.
 *
 * The person invited by email may have no account yet, so the invitation token
 * is the credential: the page and the two calls behind it (validate, accept)
 * must be public. The proxy allowlist is easy to forget when a public feature
 * is added, and forgetting it sends the invitee to the login screen instead.
 */

const { proxy } = require("@/proxy");

const request = (pathname) => ({
  nextUrl: { pathname },
  url: `https://app.example${pathname}`,
  cookies: { get: () => undefined },
});

describe("proxy — public invitation path", () => {
  it("lets the invitation page through without a session", () => {
    const res = proxy(request("/venture-invite/tok123"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets the invitation API through without a session", () => {
    const res = proxy(request("/api/venture-member-invites/tok123"));

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still sends an anonymous visitor of a private page to the login screen", () => {
    const res = proxy(request("/admin/ventures"));

    expect(res.headers.get("location")).toContain("/login");
  });

  it("still refuses an anonymous call to a private API", () => {
    const res = proxy(request("/api/ventures/VNT-1/members"));

    expect(res.status).toBe(401);
  });
});
