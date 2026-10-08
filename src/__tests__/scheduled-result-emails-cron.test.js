/**
 * Scheduled result emails — the punctual trigger for a run's report delay.
 *
 * A run can schedule its report "N hours M minutes after the submission". Two
 * guarantees are pinned here:
 *
 *   1. ROUTE PROTECTION: a scheduler has no session, so the dedicated path must
 *      be reachable WITHOUT a cookie — and the shared secret is the credential,
 *      not the session. Every OTHER /api/platform route must keep refusing
 *      anonymous calls, so the allowlist names this exact path and never all of
 *      /api/platform.
 *   2. The secret gate itself: 503 when nothing is configured (so an
 *      unconfigured deployment never exposes an unauthenticated trigger), 403
 *      for a wrong or missing secret, and only then does it dispatch. The
 *      secret is accepted from the header Vercel Cron sends (Bearer) as well as
 *      the x-cron-secret convention, and a body-less call must not throw.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/services/platform/formRuns", () => ({
  dispatchScheduledResultEmails: jest.fn(async () => ({
    checked: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    not_due: 0,
  })),
}));

const { proxy } = require("@/proxy");
const { dispatchScheduledResultEmails } = require("@/services/platform/formRuns");
const route = require("@/app/api/platform/scheduled-result-emails/route");

const SECRET = "result-dispatch-secret";
const PATH = "/api/platform/scheduled-result-emails";

const pagelessRequest = (pathname) => ({
  nextUrl: { pathname },
  url: `https://app.example${pathname}`,
  cookies: { get: () => undefined },
});

const call = (method, { headers = {}, body } = {}) =>
  new Request(`https://app.example${PATH}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

describe("proxy — the scheduled result dispatch", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("lets the scheduler reach the endpoint without a session", () => {
    const res = proxy(pagelessRequest(PATH));

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still refuses anonymous access to every other /api/platform route", () => {
    expect(proxy(pagelessRequest("/api/platform/form-runs")).status).toBe(401);
    expect(proxy(pagelessRequest("/api/platform/forms")).status).toBe(401);
    expect(proxy(pagelessRequest("/api/platform/collections")).status).toBe(401);
  });
});

describe("the scheduled result dispatch endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  afterAll(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 503 when the shared secret is not configured", async () => {
    const res = await route.GET(call("GET", { headers: { "x-cron-secret": SECRET } }));

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ success: false });
    expect(dispatchScheduledResultEmails).not.toHaveBeenCalled();
  });

  it("returns 403 when the supplied secret is wrong", async () => {
    process.env.CRON_SECRET = SECRET;

    const res = await route.GET(call("GET", { headers: { "x-cron-secret": "not-the-secret" } }));

    expect(res.status).toBe(403);
    expect(dispatchScheduledResultEmails).not.toHaveBeenCalled();
  });

  it("returns 403 when no secret is supplied at all", async () => {
    process.env.CRON_SECRET = SECRET;

    const res = await route.POST(call("POST"));

    expect(res.status).toBe(403);
    expect(dispatchScheduledResultEmails).not.toHaveBeenCalled();
  });

  it("dispatches every run for a body-less call with the x-cron-secret header", async () => {
    process.env.CRON_SECRET = SECRET;

    const res = await route.GET(call("GET", { headers: { "x-cron-secret": SECRET } }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, checked: 0 });
    expect(dispatchScheduledResultEmails).toHaveBeenCalledWith({ run_id: null });
  });

  it("accepts the Bearer header Vercel Cron sends", async () => {
    process.env.CRON_SECRET = SECRET;

    const res = await route.GET(call("GET", { headers: { authorization: `Bearer ${SECRET}` } }));

    expect(res.status).toBe(200);
    expect(dispatchScheduledResultEmails).toHaveBeenCalledWith({ run_id: null });
  });

  it("narrows to one run when the body carries a run id", async () => {
    process.env.CRON_SECRET = SECRET;

    const res = await route.POST(
      call("POST", {
        headers: { "x-cron-secret": SECRET, "content-type": "application/json" },
        body: { run_id: 42 },
      }),
    );

    expect(res.status).toBe(200);
    expect(dispatchScheduledResultEmails).toHaveBeenCalledWith({ run_id: 42 });
  });

  it("reports a dispatch failure as a 500 without throwing", async () => {
    process.env.CRON_SECRET = SECRET;
    dispatchScheduledResultEmails.mockResolvedValueOnce({ checked: 0, error: "boom" });

    const res = await route.GET(call("GET", { headers: { "x-cron-secret": SECRET } }));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ success: false, error: "boom" });
  });

  it("still accepts the deprecated ?key= query parameter", async () => {
    process.env.CRON_SECRET = SECRET;

    const res = await route.GET(
      new Request(`https://app.example${PATH}?key=${SECRET}`, { method: "GET" }),
    );

    expect(res.status).toBe(200);
  });
});
