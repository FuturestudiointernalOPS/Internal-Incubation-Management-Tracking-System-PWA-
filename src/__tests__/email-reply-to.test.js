/**
 * Optional Reply-To — the smallest addition to the shared email transport.
 *
 * Two things are pinned here, and they pull in opposite directions:
 *
 *   1. WHEN `replyTo` IS OMITTED, EVERYTHING IS EXACTLY AS BEFORE. Dozens of
 *      existing senders call this chain with the old argument shape, so the
 *      default header must stay the studio's own address.
 *
 *   2. A Reply-To IS A RAW MIME HEADER. An address carrying CR/LF would inject
 *      arbitrary headers (a second Bcc, a different body), and one carrying a
 *      comma would start a second recipient. It is therefore validated in TWO
 *      places — at the dispatch point and again where the header is written —
 *      and an unusable value is dropped, never forwarded. The message is still
 *      sent.
 */
jest.mock("@/lib/email/gmail", () => ({
  ...jest.requireActual("@/lib/email/gmail"),
  sendViaGmail: jest.fn(),
}));

jest.mock("@/lib/email/resend", () => ({
  sendViaResend: jest.fn(),
}));

import { resolveReplyToAddress } from "@/lib/email/addresses";
import { buildGmailRawMessage, sendViaGmail } from "@/lib/email/gmail";
import { sendViaResend } from "@/lib/email/resend";
import { sendEmail } from "@/lib/email/send";

/** The raw message is base64url; decode it to read the headers. */
const decode = (raw) => Buffer.from(raw, "base64url").toString("utf8");

describe("resolveReplyToAddress", () => {
  it("accepts a plain address and normalises it", () => {
    expect(resolveReplyToAddress("Founder@AgriNova.CO")).toBe("founder@agrinova.co");
    expect(resolveReplyToAddress("  a.b+tag@sub.agrinova.co  ")).toBe("a.b+tag@sub.agrinova.co");
  });

  it("refuses anything that could break a header or add a recipient", () => {
    expect(resolveReplyToAddress("a@b.co\r\nBcc: evil@attacker.test")).toBeNull();
    expect(resolveReplyToAddress("a@b.co\nX-Injected: 1")).toBeNull();
    expect(resolveReplyToAddress("a@b.co, evil@attacker.test")).toBeNull();
    expect(resolveReplyToAddress("a@b.co; evil@attacker.test")).toBeNull();
    expect(resolveReplyToAddress("Name <a@b.co>")).toBeNull();
    expect(resolveReplyToAddress("a b@c.co")).toBeNull();
    expect(resolveReplyToAddress('a"b@c.co')).toBeNull();
    expect(resolveReplyToAddress("a\\b@c.co")).toBeNull();
  });

  it("refuses malformed and placeholder addresses", () => {
    expect(resolveReplyToAddress("not-an-address")).toBeNull();
    expect(resolveReplyToAddress("a@b")).toBeNull();
    expect(resolveReplyToAddress("import-42@placeholder.local")).toBeNull();
    expect(resolveReplyToAddress("x@example.com")).toBeNull();
    expect(resolveReplyToAddress("")).toBeNull();
    expect(resolveReplyToAddress(null)).toBeNull();
    expect(resolveReplyToAddress(undefined)).toBeNull();
    expect(resolveReplyToAddress(12345)).toBeNull();
  });

  it("refuses an over-long address", () => {
    expect(resolveReplyToAddress(`${"a".repeat(250)}@agrinova.co`)).toBeNull();
  });
});

describe("buildGmailRawMessage — the Reply-To header", () => {
  const base = { to: "lead@future.studio", subject: "Hello", html: "<p>Body</p>" };

  it("keeps the studio address when no replyTo is given (unchanged behaviour)", () => {
    const headers = decode(buildGmailRawMessage(base)).split("\n");
    const reply = headers.find((line) => line.startsWith("Reply-To:"));
    expect(reply).toBeTruthy();
    expect(reply).not.toContain("undefined");
    expect(reply).toMatch(/^Reply-To: .+@.+$/);
  });

  it("uses the given address when it is usable", () => {
    const headers = decode(buildGmailRawMessage({ ...base, replyTo: "founder@venture.co" })).split("\n");
    expect(headers).toContain("Reply-To: founder@venture.co");
  });

  it("never lets a crafted address inject a header — even when called directly", () => {
    const raw = decode(
      buildGmailRawMessage({ ...base, replyTo: "founder@venture.co\r\nBcc: evil@attacker.test" }),
    );
    expect(raw).not.toContain("Bcc:");
    expect(raw).not.toContain("evil@attacker.test");
  });
});

describe("sendEmail — sanitised at the dispatch point", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendViaGmail.mockResolvedValue({ success: true, provider: "gmail" });
    sendViaResend.mockResolvedValue({ success: true, provider: "resend" });
  });

  it("forwards a usable replyTo", async () => {
    await sendEmail({ to: "lead@future.studio", subject: "s", html: "h", provider: "gmail", replyTo: "founder@venture.co" });
    expect(sendViaGmail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "founder@venture.co" }));
  });

  it("drops a header-injecting replyTo but still sends", async () => {
    await sendEmail({
      to: "lead@future.studio",
      subject: "s",
      html: "h",
      provider: "gmail",
      replyTo: "founder@venture.co\r\nBcc: evil@attacker.test",
    });
    expect(sendViaGmail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: null }));
  });

  it("sends exactly as before when replyTo is omitted", async () => {
    await sendEmail({ to: "lead@future.studio", subject: "s", html: "h", provider: "gmail" });
    expect(sendViaGmail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: null }));
  });
});
