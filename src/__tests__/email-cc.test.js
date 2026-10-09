jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/lib/email/config", () => ({ EMAIL_PRIMARY_DEFAULT: "gmail" }));
jest.mock("@/lib/email/gmail", () => ({ sendViaGmail: jest.fn() }));
jest.mock("@/lib/email/resend", () => ({ sendViaResend: jest.fn() }));

const { parseEmailAddressList } = require("@/lib/email/addresses");
const { sendEmail } = require("@/lib/email/send");
const { sendViaGmail } = require("@/lib/email/gmail");
const { sendViaResend } = require("@/lib/email/resend");

describe("manual email Cc support", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("parses, normalizes and deduplicates copied addresses", () => {
    expect(parseEmailAddressList("Person@Acme.com; other@acme.com, person@acme.com")).toEqual({
      emails: ["person@acme.com", "other@acme.com"],
      invalid: [],
    });
  });

  it("rejects malformed and placeholder addresses", () => {
    expect(parseEmailAddressList("valid@acme.com, bad-address, sample@example.com")).toEqual({
      emails: ["valid@acme.com"],
      invalid: ["bad-address", "sample@example.com"],
    });
  });

  it("forwards Cc through the primary transport and its fallback", async () => {
    sendViaGmail.mockResolvedValue({ success: false, provider: "gmail" });
    sendViaResend.mockResolvedValue({ success: true, provider: "resend" });
    const cc = ["copy@acme.com"];

    await sendEmail({
      to: "respondent@acme.com",
      cc,
      subject: "Subject",
      html: "<p>Body</p>",
      provider: "gmail",
    });

    expect(sendViaGmail).toHaveBeenCalledWith(expect.objectContaining({ cc }));
    expect(sendViaResend).toHaveBeenCalledWith(expect.objectContaining({ cc }));
  });
});