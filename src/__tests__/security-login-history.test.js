/**
 * SECURITY — login history is finally WRITTEN.
 *
 * The tables `venture_login_history` / `venture_failed_logins` existed and the
 * admin Security console read them, but nothing ever inserted a row: failed
 * sign-ins were recorded nowhere and the screen showed permanent zeros. This
 * pins the writer that closes that hole, the User-Agent classifier it uses, the
 * i18n labels the console renders, and the summary key it reads.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const { summarizeUserAgent } = require("@/lib/userAgent");

const ROUTES = [
  "src/app/api/auth/login/route.js",
  "src/app/api/auth/session-login/route.js",
];

describe("both sign-in routes record login history", () => {
  test.each(ROUTES)("%s wires the audit helper and both action codes", (file) => {
    const src = read(file);
    expect(src).toMatch(/from "@\/lib\/loginAudit"/);
    expect(src).toMatch(/auditLoginAttempt\(/);
    // Success and failure are both recorded.
    expect(src).toMatch(/"login_success"/);
    expect(src).toMatch(/"login_failed"/);
  });

  test("the helper writes through the model, and no route runs the SQL itself", () => {
    const helper = read("src/lib/loginAudit.js");
    expect(helper).toMatch(/recordLoginAttempt\(/);
    expect(helper).toMatch(/recordFailedLogin\(/);

    const model = read("src/models/loginHistory.js");
    expect(model).toMatch(/INSERT INTO venture_login_history/);
    expect(model).toMatch(/INSERT INTO venture_failed_logins/);

    for (const file of ROUTES) {
      expect(read(file)).not.toMatch(/INSERT INTO venture_login_history/);
      expect(read(file)).not.toMatch(/INSERT INTO venture_failed_logins/);
    }
  });

  test("a failure also feeds the failed-attempt table", () => {
    const helper = read("src/lib/loginAudit.js");
    // Only failures write the failed-attempt row.
    expect(helper).toMatch(/if \(!isSuccess\) \{/);
    expect(helper).toMatch(/recordFailedLogin\(\{ identifier: identifier \|\| userEmail, ipAddress \}\)/);
  });
});

describe("i18n — the console's new login labels exist in both locales", () => {
  const KEYS = [
    "actionLoginSuccess",
    "actionTeamLoginSuccess",
    "actionFamilyLoginSuccess",
    "actionLoginFailed",
    "failureInvalidCredentials",
    "failureAccountInactive",
    "failureAccountPending",
    "failureAccountArchived",
    "failureAccountNotActive",
    "failureRateLimited",
  ];

  test.each(["en", "fr"])("%s has every security login label", (locale) => {
    const messages = JSON.parse(read(`src/locales/${locale}/adminMisc.json`));
    for (const key of KEYS) {
      expect(typeof messages.adminMisc.security[key]).toBe("string");
      expect(messages.adminMisc.security[key].length).toBeGreaterThan(0);
    }
  });

  test("the console renders the codes through t(), not a hardcoded label", () => {
    const screen = read("src/app/admin/security/page.js");
    expect(screen).toMatch(/loginActionLabel\(/);
    expect(screen).toMatch(/loginFailureLabel\(/);
    expect(screen).not.toMatch(/loginEntry\.action\?\.replace/);
  });
});

describe("the console's summary stats expose the keys it reads", () => {
  test("getLoginStats returns login_successes and login_failures", () => {
    const src = read("src/lib/ventures.js");
    expect(src).toMatch(/login_successes: successCount/);
    expect(src).toMatch(/login_failures: failureCount/);
  });
});

describe("summarizeUserAgent is a pure, best-effort classifier", () => {
  test("desktop Chrome on Windows", () => {
    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", os: "Windows", device: "Desktop" });
  });

  test("Edge is not misread as Chrome", () => {
    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
      ),
    ).toEqual({ browser: "Edge", os: "Windows", device: "Desktop" });
  });

  test("an iPhone is Safari / iOS / Mobile, not macOS", () => {
    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ browser: "Safari", os: "iOS", device: "Mobile" });
  });

  test("an empty or missing value degrades to nulls", () => {
    expect(summarizeUserAgent("")).toEqual({ browser: null, os: null, device: null });
    expect(summarizeUserAgent(undefined)).toEqual({ browser: null, os: null, device: null });
    expect(summarizeUserAgent(null)).toEqual({ browser: null, os: null, device: null });
  });
});
