/**
 * Route protection — the payment provider's callback must stay reachable
 * WITHOUT a session.
 *
 * Kkiapay posts the payment notification from ITS servers: there is no session
 * cookie, and the person paying has no account on our side yet. The
 * `x-kkiapay-secret` signature header is the credential, checked inside the
 * route. If the callback lands on the login gate instead, the provider can
 * never confirm a payment and only the reconciliation sweep can close it.
 *
 * The webhook CONFIGURATION API (list/create on /api/webhooks, and the
 * per-webhook routes) is a different thing and must stay behind a session.
 */

const { proxy } = require("@/proxy");

const request = (pathname) => ({
  nextUrl: { pathname },
  url: `https://app.example${pathname}`,
  cookies: { get: () => undefined },
});

describe("proxy — the Kkiapay payment callback", () => {
  it("lets the provider callback through without a session", () => {
    const res = proxy(request("/api/webhooks/kkiapay"));

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still refuses anonymous access to the webhook configuration API", () => {
    expect(proxy(request("/api/webhooks")).status).toBe(401);
    expect(proxy(request("/api/webhooks/wh-1")).status).toBe(401);
  });
});
