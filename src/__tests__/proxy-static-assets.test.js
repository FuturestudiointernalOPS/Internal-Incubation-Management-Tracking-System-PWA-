/**
 * Route protection — static assets served from /public must stay reachable
 * WITHOUT a session.
 *
 * The web app manifest, the icons and the favicons have no cookie: the browser
 * fetches them on every page, including the login screen. If the session gate
 * answers them with a redirect to /login, the manifest request receives HTML
 * instead of JSON and the browser logs
 * "Manifest: Line: 1, column: 1, Syntax error."
 */

const { proxy } = require("@/proxy");

const request = (pathname) => ({
  nextUrl: { pathname },
  url: `https://app.example${pathname}`,
  cookies: { get: () => undefined },
});

describe("proxy — static assets", () => {
  it("serves the web app manifest without a session", () => {
    const res = proxy(request("/manifest.json"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    "/favicon.ico",
    "/favicon-32x32.png",
    "/favicon-16x16.png",
    "/apple-touch-icon.png",
    "/icon-192x192.png",
    "/icon-512x512.png",
    "/logo.png",
    "/robots.txt",
    "/sitemap.xml",
  ])("serves %s without a session", (pathname) => {
    const res = proxy(request(pathname));

    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("still sends an anonymous visitor of an extension-less page to login", () => {
    expect(proxy(request("/admin/lms/courses")).headers.get("location")).toContain("/login");
  });

  it("still refuses an anonymous call to a private API", () => {
    expect(proxy(request("/api/lms/courses/C-1/publish")).status).toBe(401);
  });
});
