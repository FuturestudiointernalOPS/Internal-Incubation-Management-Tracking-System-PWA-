/**
 * Scheduled checkout reconciliation — the replay point for payments Kkiapay's
 * retries could not close.
 *
 * Two guarantees are pinned here:
 *
 *   1. ROUTE PROTECTION: an external scheduler has no session, so the endpoint
 *      must be reachable WITHOUT a cookie — and the shared secret is the
 *      credential, not the session. Every OTHER /api/lms route must keep
 *      refusing anonymous calls, so the allowlist has to name this exact path
 *      and never all of /api/lms.
 *   2. The secret gate itself: 503 when nothing is configured (so an
 *      unconfigured deployment never exposes an unauthenticated write path),
 *      403 for a wrong or missing secret, and only then does it run the sweep.
 */

jest.mock("@/services/lms/checkoutReconcile", () => ({
  reconcileRegistrations: jest.fn(async () => ({
    checked: 0,
    accessGranted: 0,
    recovered: 0,
    failed: 0,
  })),
}));

const { proxy } = require("@/proxy");

const SECRET_ENV = "CHECKOUT_RECONCILE_SECRET_KEY";
const SECRET = "reconcile-secret";
const PATH = "/api/lms/checkout-reconcile";

const request = (pathname) => ({
  nextUrl: { pathname },
  url: `https://app.example${pathname}`,
  cookies: { get: () => undefined },
});

function post(headers = {}) {
  return new Request(`https://app.example${PATH}`, { method: "POST", headers });
}

/**
 * Load the route fresh so its module-level secret capture sees the env we set
 * for this test, and hand back the sweep mock it will actually call.
 */
function loadRoute() {
  let route;
  let reconcile;
  jest.isolateModules(() => {
    route = require("@/app/api/lms/checkout-reconcile/route");
    reconcile = require("@/services/lms/checkoutReconcile");
  });
  return { route, reconcile };
}

describe("proxy — the scheduled checkout reconciliation", () => {
  it("lets the scheduler reach the endpoint without a session", () => {
    const res = proxy(request(PATH));

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still refuses anonymous access to every other /api/lms route", () => {
    expect(proxy(request("/api/lms/courses")).status).toBe(401);
    expect(proxy(request("/api/lms/registrations")).status).toBe(401);
    expect(proxy(request("/api/lms/enrollments/42")).status).toBe(401);
  });
});

describe("POST /api/lms/checkout-reconcile", () => {
  beforeEach(() => {
    delete process.env[SECRET_ENV];
  });

  it("returns 503 when the shared secret is not configured", async () => {
    const { route, reconcile } = loadRoute();

    const res = await route.POST(post({ "x-cron-secret": SECRET }));

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ success: false });
    expect(reconcile.reconcileRegistrations).not.toHaveBeenCalled();
  });

  it("returns 403 when the supplied secret is wrong", async () => {
    process.env[SECRET_ENV] = SECRET;
    const { route, reconcile } = loadRoute();

    const res = await route.POST(post({ "x-cron-secret": "not-the-secret" }));

    expect(res.status).toBe(403);
    expect(reconcile.reconcileRegistrations).not.toHaveBeenCalled();
  });

  it("returns 403 when no secret is supplied at all", async () => {
    process.env[SECRET_ENV] = SECRET;
    const { route } = loadRoute();

    const res = await route.POST(post());

    expect(res.status).toBe(403);
  });

  it("runs the sweep and returns its summary when the secret matches", async () => {
    process.env[SECRET_ENV] = SECRET;
    const { route, reconcile } = loadRoute();

    const res = await route.POST(post({ "x-cron-secret": SECRET }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      summary: { checked: 0, accessGranted: 0, recovered: 0, failed: 0 },
    });
    expect(reconcile.reconcileRegistrations).toHaveBeenCalledWith({ limit: 25 });
  });

  it("still accepts the deprecated ?key= query parameter", async () => {
    process.env[SECRET_ENV] = SECRET;
    const { route } = loadRoute();

    const res = await route.POST(
      new Request(`https://app.example${PATH}?key=${SECRET}`, { method: "POST" }),
    );

    expect(res.status).toBe(200);
  });
});
