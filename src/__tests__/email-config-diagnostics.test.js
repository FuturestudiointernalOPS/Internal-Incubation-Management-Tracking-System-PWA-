/**
 * describeEmailConfig — what the RUNNING environment can actually send with.
 *
 * A failed send leaves no trace in the UI, so the only honest way to diagnose
 * "I never got the email" on production is to ask the running process what it
 * has. This locks the two properties that make that answer trustworthy:
 *
 *   • it names what is MISSING (the credential names), and
 *   • it never returns a secret VALUE — only presence.
 *
 * `config.js` reads the environment at import time, exactly as the monolith
 * did, so each case re-imports the module under a controlled environment.
 */

const ENV_KEYS = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_SENDER_EMAIL",
  "GMAIL_REDIRECT_URI",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "EMAIL_PRIMARY_PROVIDER",
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
];

const SECRET = "s3cret-value-must-never-appear";

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
  jest.resetModules();
});

/** Import the config fresh, under the environment currently set. */
function freshConfig() {
  let mod;
  jest.isolateModules(() => {
    mod = require("@/lib/email/config");
  });
  return mod;
}

describe("which provider the environment will use", () => {
  test("complete Gmail credentials make Gmail primary", () => {
    process.env.GMAIL_CLIENT_ID = SECRET;
    process.env.GMAIL_CLIENT_SECRET = SECRET;
    process.env.GMAIL_REFRESH_TOKEN = SECRET;
    const { describeEmailConfig } = freshConfig();
    const config = describeEmailConfig();
    expect(config.primaryProvider).toBe("gmail");
    expect(config.gmail.configured).toBe(true);
    expect(config.gmail.missing).toEqual([]);
  });

  test("without them it degrades to Resend, and says which names are missing", () => {
    process.env.GMAIL_CLIENT_ID = SECRET;
    // …no secret, no refresh token.
    const { describeEmailConfig } = freshConfig();
    const config = describeEmailConfig();
    expect(config.primaryProvider).toBe("resend");
    expect(config.gmail.configured).toBe(false);
    expect(config.gmail.missing).toEqual(["GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"]);
  });

  test("EMAIL_PRIMARY_PROVIDER=resend is reported as the force that overrode Gmail", () => {
    process.env.GMAIL_CLIENT_ID = SECRET;
    process.env.GMAIL_CLIENT_SECRET = SECRET;
    process.env.GMAIL_REFRESH_TOKEN = SECRET;
    process.env.EMAIL_PRIMARY_PROVIDER = "resend";
    const { describeEmailConfig } = freshConfig();
    const config = describeEmailConfig();
    expect(config.primaryProvider).toBe("resend");
    expect(config.gmail.configured).toBe(true); // present, but not chosen
    expect(config.forcedByEnv).toBe("EMAIL_PRIMARY_PROVIDER=resend");
  });

  test("Resend is reported by presence, and the attachment caveat is spelled out", () => {
    process.env.RESEND_API_KEY = SECRET;
    const { describeEmailConfig } = freshConfig();
    const config = describeEmailConfig();
    expect(config.resend.configured).toBe(true);
    expect(config.attachments.supportedBy).toEqual(["gmail"]);
    expect(config.attachments.note).toContain("no attachment support");
  });
});

describe("it never leaks a secret", () => {
  test("no credential VALUE appears anywhere in the answer", () => {
    process.env.GMAIL_CLIENT_ID = SECRET;
    process.env.GMAIL_CLIENT_SECRET = SECRET;
    process.env.GMAIL_REFRESH_TOKEN = SECRET;
    process.env.RESEND_API_KEY = SECRET;
    const { describeEmailConfig } = freshConfig();
    expect(JSON.stringify(describeEmailConfig())).not.toContain(SECRET);
  });
});
