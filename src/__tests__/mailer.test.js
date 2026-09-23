/**
 * Senders — the thin mailer front over the platform email service.
 *
 * The mailer used to be a Resend-only sender that answered a *simulated*
 * success when no key was configured, so callers reported "sent" for an email
 * that never left. These tests pin the two guarantees that replaced it:
 *   1. the send is delegated to the shared transport (which owns the
 *      Google-Workspace-first / Resend-fallback switch and the placeholder
 *      guard), and
 *   2. the outcome returned is the transport's REAL one — never a fake success.
 */

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(),
}));

const { sendEmail: sendPlatformEmail } = require("@/lib/email");
const { sendEmail } = require("@/lib/mailer");

beforeEach(() => {
  jest.clearAllMocks();
  sendPlatformEmail.mockResolvedValue({ success: true, provider: "gmail" });
});

describe("mailer.sendEmail", () => {
  it("renders a plain body as HTML and delegates to the shared transport", async () => {
    await sendEmail({ to: "guest@outside.io", subject: "Hello", body: "Line 1\nLine 2 & <tag>" });

    expect(sendPlatformEmail).toHaveBeenCalledTimes(1);
    const mail = sendPlatformEmail.mock.calls[0][0];
    expect(mail.to).toBe("guest@outside.io");
    expect(mail.subject).toBe("Hello");
    expect(mail.html).toContain("white-space: pre-wrap");
    expect(mail.html).toContain("Line 1\nLine 2 &amp; &lt;tag&gt;");
    expect(mail.html).not.toContain("<tag>");
  });

  it("passes an HTML body through untouched and forwards the sender name", async () => {
    await sendEmail({
      to: "guest@outside.io",
      subject: "Hello",
      body: "<p>hi</p>",
      isHtml: true,
      fromName: "Future Studio Admin",
    });

    const mail = sendPlatformEmail.mock.calls[0][0];
    expect(mail.html).toBe("<p>hi</p>");
    expect(mail.fromName).toBe("Future Studio Admin");
  });

  it("returns the transport outcome unchanged — a failure is never a simulated success", async () => {
    sendPlatformEmail.mockResolvedValueOnce({ success: false, provider: "resend", error: "quota" });

    const result = await sendEmail({ to: "guest@outside.io", subject: "Hello", body: "x" });

    expect(result).toEqual({ success: false, provider: "resend", error: "quota" });
  });
});
