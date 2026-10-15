/**
 * Google OAuth config — a value pasted into a hosting dashboard with a trailing
 * newline, spaces or wrapping quotes must not reach Google as-is (Google answers
 * `401 invalid_client` — "The OAuth client was not found").
 */

jest.mock("@/lib/appUrl", () => ({ resolveAppUrl: () => "https://app.example" }));

import { buildGoogleAuthUrl, getGoogleOAuthConfig } from "@/lib/integrations/google/oauth";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getGoogleOAuthConfig", () => {
  test("trims whitespace and newlines around the client id and secret", () => {
    process.env.GOOGLE_CLIENT_ID = "  123-abc.apps.googleusercontent.com\n";
    process.env.GOOGLE_CLIENT_SECRET = "secret\r\n";
    const config = getGoogleOAuthConfig();
    expect(config.clientId).toBe("123-abc.apps.googleusercontent.com");
    expect(config.clientSecret).toBe("secret");
  });

  test("strips wrapping quotes", () => {
    process.env.GOOGLE_CLIENT_ID = "\"123-abc.apps.googleusercontent.com\"";
    process.env.GOOGLE_CLIENT_SECRET = "'secret'";
    const config = getGoogleOAuthConfig();
    expect(config.clientId).toBe("123-abc.apps.googleusercontent.com");
    expect(config.clientSecret).toBe("secret");
  });

  test("falls back to the app callback when no redirect URI is set", () => {
    process.env.GOOGLE_REDIRECT_URI = "   ";
    expect(getGoogleOAuthConfig().redirectUri).toBe(
      "https://app.example/api/integrations/google-calendar/callback",
    );
  });

  test("the consent URL carries the cleaned client id", () => {
    process.env.GOOGLE_CLIENT_ID = " 123-abc.apps.googleusercontent.com \n";
    const url = new URL(buildGoogleAuthUrl("state-1"));
    expect(url.searchParams.get("client_id")).toBe("123-abc.apps.googleusercontent.com");
  });
});
