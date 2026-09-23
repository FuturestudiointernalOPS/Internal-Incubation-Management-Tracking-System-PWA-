/**
 * SECURITY — regression tests for Lot 5 (P2 hardening).
 *
 * Pins: the security headers, the credential rate limits, and the createHandler
 * change that resolves the session once and attaches it (IMPL-1) so handlers can
 * attribute writes to the real actor without an extra read.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("security headers", () => {
  test("next.config advertises the hardening headers and a report-only CSP", () => {
    const src = read("next.config.mjs");
    expect(src).toMatch(/Strict-Transport-Security/);
    expect(src).toMatch(/X-Content-Type-Options/);
    expect(src).toMatch(/Referrer-Policy/);
    expect(src).toMatch(/Permissions-Policy/);
    expect(src).toMatch(/X-Frame-Options/);
    expect(src).toMatch(/Content-Security-Policy-Report-Only/);
  });
});

describe("credential endpoints are rate-limited", () => {
  test.each([
    ["src/app/api/auth/login/route.js", /login:ip:/],
    ["src/app/api/auth/session-login/route.js", /login:ip:/],
    ["src/app/api/auth/reset-password/route.js", /reset:ip:/],
    ["src/app/api/auth/activate/route.js", /activate:ip:/],
    ["src/app/api/auth/setup-password/validate/route.js", /setup-validate:ip:/],
  ])("%s throttles by IP", (file, pattern) => {
    const src = read(file);
    expect(src).toMatch(/enforceRateLimit/);
    expect(src).toMatch(pattern);
  });

  test("the two logins also limit per account", () => {
    for (const file of [
      "src/app/api/auth/login/route.js",
      "src/app/api/auth/session-login/route.js",
    ]) {
      expect(read(file)).toMatch(/login:account:/);
    }
  });
});

describe("createHandler resolves the session once and attaches it (IMPL-1)", () => {
  jest.mock("@/lib/db", () => ({
    __esModule: true,
    default: { execute: jest.fn() },
    initDb: jest.fn(async () => {}),
  }));
  jest.mock("@/lib/auth", () => ({
    requireAuth: jest.fn(async () => null),
    getSession: jest.fn(async () => ({ cid: "C1", role: "staff" })),
  }));

  const { createHandler } = require("@/lib/api/createHandler");
  const { requireAuth, getSession } = require("@/lib/auth");

  test("attaches req.session and hands the same session to the guard", async () => {
    const handler = createHandler(async (req) => ({ seen: req.session?.cid }));
    const result = await handler({});
    expect(result).toEqual({ seen: "C1" });
    expect(requireAuth).toHaveBeenCalledWith(undefined, { cid: "C1", role: "staff" });
    // Exactly one read: the guard reuses the provided session.
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  test("a public handler stays unauthenticated and unattached", async () => {
    const handler = createHandler({ public: true }, async (req) => ({
      seen: req.session ?? null,
    }));
    const result = await handler({});
    expect(result).toEqual({ seen: null });
  });
});
