/**
 * The reminder email itself — the wording a manager writes, and the file that
 * travels with it.
 *
 * Two things are pinned here because they are easy to break later: a written
 * subject REPLACES the standard one (writing a reminder is pointless if the
 * template still speaks), and a written message is ESCAPED, so text typed into a
 * form can never become markup in someone's inbox.
 */
jest.mock("@/lib/email/delivery", () => ({
  sendAndRecord: jest.fn(async () => ({ success: true, provider: "gmail" })),
}));

const { sendAndRecord } = require("@/lib/email/delivery");
const { sendVentureReminderEmail } = require("@/lib/email/senders/reminders");

const ITEM = {
  id: "activity:41",
  ref: "MS-01",
  title: "Validate demand",
  finish: "2026-10-23",
};

/** The single call the sender made, as an object. */
const sent = () => sendAndRecord.mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
});

test("nothing written means the standard subject and no message block", async () => {
  await sendVentureReminderEmail({
    to: "amina@example.com",
    item: ITEM,
    ventureName: "KoraHome",
    ventureCode: "VNT-1",
    trigger: "finish",
    daysLeft: 2,
    watchedDate: "2026-10-23",
  });

  expect(sent().subject).toContain("Due soon");
  expect(sent().subject).toContain("Validate demand");
  expect(sent().html).not.toContain("border-left: 3px solid");
  expect(sent().attachments).toBeNull();
});

test("a written subject and message go out exactly as written", async () => {
  await sendVentureReminderEmail({
    to: "amina@example.com",
    item: ITEM,
    ventureName: "KoraHome",
    ventureCode: "VNT-1",
    trigger: "manual",
    subject: "A word before Friday",
    message: "Line one\nLine two",
  });

  expect(sent().subject).toBe("A word before Friday");
  expect(sent().html).toContain("Line one<br>Line two");
});

test("a written message is escaped, never rendered as markup", async () => {
  await sendVentureReminderEmail({
    to: "amina@example.com",
    item: ITEM,
    ventureName: "KoraHome",
    trigger: "manual",
    message: "<script>alert(1)</script>",
  });

  expect(sent().html).not.toContain("<script>alert(1)</script>");
  expect(sent().html).toContain("&lt;script&gt;");
});

test("an attachment is handed to the transport with the message", async () => {
  const files = [{ filename: "plan.pdf", content: Buffer.from("evidence"), contentType: "application/pdf" }];

  await sendVentureReminderEmail({
    to: "amina@example.com",
    item: ITEM,
    ventureName: "KoraHome",
    trigger: "manual",
    attachments: files,
  });

  expect(sent().attachments).toBe(files);
});
