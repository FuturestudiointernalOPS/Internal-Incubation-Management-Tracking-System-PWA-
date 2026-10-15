/**
 * Scheduled deadline reminders — the daily "a task is due tomorrow" notice.
 *
 * ROUTE PROTECTION: a scheduler has no session, so the dedicated path must be
 * reachable WITHOUT a cookie — the x-cron-secret shared secret is the
 * credential, not the session. Every OTHER /api/tasks route must keep refusing
 * anonymous calls, so the allowlist names this exact path and never all of
 * /api/tasks.
 *
 * Without this exception the edge refuses the scheduler with 401 before the
 * route's own secret gate is ever reached: the job looks configured and
 * silently never notifies anyone.
 *
 * The secret gate itself (401 without the right secret, the sweep with it) is
 * pinned in `tasks-subresources-api.test.js`.
 */

const { proxy } = require("@/proxy");

const PATH = "/api/tasks/notify-deadlines";

const request = (pathname) => ({
  nextUrl: { pathname },
  url: `https://app.example${pathname}`,
  cookies: { get: () => undefined },
});

describe("proxy — the scheduled deadline reminders", () => {
  it("lets the scheduler reach the endpoint without a session", () => {
    const res = proxy(request(PATH));

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still refuses anonymous access to every other /api/tasks route", () => {
    expect(proxy(request("/api/tasks")).status).toBe(401);
    expect(proxy(request("/api/tasks/comments")).status).toBe(401);
    expect(proxy(request("/api/tasks/logs")).status).toBe(401);
  });
});
