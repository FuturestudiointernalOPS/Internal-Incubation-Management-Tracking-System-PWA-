/**
 * OBSERVABILITY — the email external boundary.
 *
 * An email provider is an external system: its failures must be VISIBLE as
 * structured events (provider, duration, fallback used) and must never carry the
 * recipient address, which is personal data. This drives the real dispatcher
 * with a stubbed Resend transport and no Gmail credentials.
 */

process.env.RESEND_API_KEY = "test-key";
process.env.EMAIL_PRIMARY_PROVIDER = "resend";
delete process.env.GMAIL_CLIENT_ID;
delete process.env.GMAIL_CLIENT_SECRET;
delete process.env.GMAIL_REFRESH_TOKEN;

const mockResendSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn(() => ({ emails: { send: (...args) => mockResendSend(...args) } })),
}));

const { sendEmail } = require("@/lib/email");

const RECIPIENT = "guest@outside.io";

afterAll(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_PRIMARY_PROVIDER;
  delete process.env.LOG_LEVEL;
});

describe("a successful send is observable and quiet about the recipient", () => {
  test("emits email_sent and never the address", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    process.env.LOG_LEVEL = "debug";
    mockResendSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    const result = await sendEmail({ to: RECIPIENT, subject: "Hi", html: "<p>hi</p>" });

    expect(result.success).toBe(true);
    const line = log.mock.calls.map((call) => call[0]).join("\n");
    expect(line).toContain("email_sent");
    expect(line).not.toContain(RECIPIENT);
    log.mockRestore();
  });
});

describe("a total failure is observable and actionable", () => {
  test("emits email_send_failed with the providers, never the address", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    mockResendSend.mockResolvedValue({ data: null, error: { message: "quota exceeded" } });

    const result = await sendEmail({ to: RECIPIENT, subject: "Hi", html: "<p>hi</p>" });

    expect(result.success).toBe(false);
    const line = error.mock.calls.map((call) => call[0]).join("\n");
    expect(line).toContain("email_send_failed");
    expect(line).toContain("resend");
    expect(line).not.toContain(RECIPIENT);
    error.mockRestore();
  });
});
