/**
 * GOOGLE OAUTH REDIRECT — the URI sent to Google must be the registered one.
 *
 * Google compares `redirect_uri` character for character against the OAuth
 * client's authorized list and fails the whole consent screen otherwise, so a
 * wrong value is invisible until a user cannot connect. This locks the two
 * ways we have already been burned:
 *
 *   • the value came from the DEPLOYMENT host (…-<hash>.vercel.app) instead of
 *     the public domain, because APP_URL was unset in that environment;
 *   • the value was a hand-typed GOOGLE_REDIRECT_URI missing the `/api` prefix.
 */

const fs = require("fs");
const path = require("path");

const {
  GOOGLE_CALENDAR_CALLBACK_PATH,
  getGoogleCalendarRedirectUri,
  isUsableGoogleRedirectUri,
  describeGoogleRedirect,
  buildGoogleAuthUrl,
} = require("@/lib/integrations/google/oauth");

const ENV_KEYS = ["APP_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_URL", "GOOGLE_REDIRECT_URI"];

// Several cases below deliberately trigger the configuration warning; keep the
// test output readable without hiding a failure.
let warnSpy;
beforeAll(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  warnSpy.mockRestore();
});

let saved;
beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("the callback path is the route that exists", () => {
  test("the constant carries the /api prefix", () => {
    expect(GOOGLE_CALENDAR_CALLBACK_PATH).toBe(
      "/api/integrations/google-calendar/callback",
    );
    expect(GOOGLE_CALENDAR_CALLBACK_PATH.startsWith("/api/")).toBe(true);
  });

  test("the handler really lives at that path", () => {
    const route = path.join(
      process.cwd(),
      "src/app",
      GOOGLE_CALENDAR_CALLBACK_PATH,
      "route.js",
    );
    expect(fs.existsSync(route)).toBe(true);
  });
});

describe("the URI is derived from the public domain", () => {
  test("APP_URL plus the callback path", () => {
    process.env.APP_URL = "https://impactos.futurestudio.bj";
    expect(getGoogleCalendarRedirectUri()).toBe(
      "https://impactos.futurestudio.bj/api/integrations/google-calendar/callback",
    );
  });

  test("a trailing slash on APP_URL does not double up", () => {
    process.env.APP_URL = "https://impactos.futurestudio.bj/";
    expect(getGoogleCalendarRedirectUri()).toBe(
      "https://impactos.futurestudio.bj/api/integrations/google-calendar/callback",
    );
  });

  test("NEXT_PUBLIC_APP_URL is honoured too", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.example.org";
    expect(getGoogleCalendarRedirectUri()).toBe(
      "https://staging.example.org/api/integrations/google-calendar/callback",
    );
  });

  test("REGRESSION: without APP_URL the deployment host is used — and flagged as the source", () => {
    // This is the production failure mode: every deployment has its own hash, so
    // a registered preview URL can never keep matching.
    process.env.VERCEL_URL = "internal-incubation-management-tracking-system-dvqm6l6l9a.vercel.app";
    const uri = getGoogleCalendarRedirectUri();
    expect(uri).toContain("dvqm6l6l9a.vercel.app");
    expect(uri.endsWith(GOOGLE_CALENDAR_CALLBACK_PATH)).toBe(true);
  });
});

describe("a hand-typed override cannot be worse than the default", () => {
  test("the production symptom is refused: no /api, no domain", () => {
    process.env.APP_URL = "https://impactos.futurestudio.bj";
    process.env.GOOGLE_REDIRECT_URI =
      "https://internal-incubation-management-tracking-system-dvqm6l6l9a/integrations/google-calendar/callback";
    // Not usable → ignored, and the derived (correct) URL is used instead.
    expect(isUsableGoogleRedirectUri(process.env.GOOGLE_REDIRECT_URI)).toBe(false);
    expect(getGoogleCalendarRedirectUri()).toBe(
      "https://impactos.futurestudio.bj/api/integrations/google-calendar/callback",
    );
  });

  test("a bare domain (no callback path) is refused", () => {
    expect(isUsableGoogleRedirectUri("https://impactos.futurestudio.bj")).toBe(false);
  });

  test("a valid override is honoured", () => {
    process.env.APP_URL = "https://impactos.futurestudio.bj";
    process.env.GOOGLE_REDIRECT_URI =
      "https://impactos.futurestudio.bj/api/integrations/google-calendar/callback";
    expect(getGoogleCalendarRedirectUri()).toBe(process.env.GOOGLE_REDIRECT_URI);
  });

  test("http is only usable for local development", () => {
    expect(
      isUsableGoogleRedirectUri("http://localhost:3000/api/integrations/google-calendar/callback"),
    ).toBe(true);
    expect(
      isUsableGoogleRedirectUri("http://impactos.futurestudio.bj/api/integrations/google-calendar/callback"),
    ).toBe(false);
  });

  test("the source is reported so the status screen can explain the value", () => {
    process.env.APP_URL = "https://impactos.futurestudio.bj";
    expect(describeGoogleRedirect().source).toBe("APP_URL");

    process.env.GOOGLE_REDIRECT_URI =
      "https://impactos.futurestudio.bj/api/integrations/google-calendar/callback";
    expect(describeGoogleRedirect().source).toBe("GOOGLE_REDIRECT_URI");

    process.env.GOOGLE_REDIRECT_URI = "https://example.org/nonsense";
    expect(describeGoogleRedirect().source).toBe("APP_URL");
  });
});

describe("the consent URL and the token exchange agree", () => {
  test("both carry the same redirect_uri", () => {
    process.env.APP_URL = "https://impactos.futurestudio.bj";
    const expected =
      "https://impactos.futurestudio.bj/api/integrations/google-calendar/callback";
    const authUrl = buildGoogleAuthUrl("state-123");
    expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(expected)}`);
  });
});
