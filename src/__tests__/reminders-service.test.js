/**
 * The reminder layer — when a reminder is due, and the guard that stops it being
 * sent twice.
 *
 * The behaviour that matters is the guarding, so most of these tests are about
 * what does NOT happen: a completed activity is not chased, and a reminder
 * already sent is not sent again. WHO a reminder reaches, and where it goes, is
 * pinned in `reminders-recipients.test.js`.
 */
jest.mock("@/models/ventureAssigneeEmails", () => ({
  selectAssigneeEmails: jest.fn(async () => ({ rows: [] })),
  selectContactEmailsByCids: jest.fn(async () => ({ rows: [] })),
  selectContactCidByEmail: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/ventureReminders", () => ({
  insertReminderLog: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  markReminderSent: jest.fn(async () => ({ rows: [] })),
  markReminderFailed: jest.fn(async () => ({ rows: [] })),
  selectLeadManagerRecipients: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/ventureAssigneeLinks", () => ({
  selectAssigneeLinks: jest.fn(async () => ({ rows: [] })),
}));

const mockSend = jest.fn(async () => ({ success: true }));
jest.mock("@/lib/email", () => ({
  sendVentureReminderEmail: (...args) => mockSend(...args),
  isPlaceholderEmail: () => false,
}));

const mockDownload = jest.fn(async () => null);
jest.mock("@/lib/ventureEvidence", () => ({
  downloadEvidenceBytes: (...args) => mockDownload(...args),
}));

const { selectAssigneeEmails, selectContactCidByEmail } = require("@/models/ventureAssigneeEmails");
const { insertReminderLog, markReminderFailed, markReminderSent, selectLeadManagerRecipients } = require("@/models/ventureReminders");
const { hasPlatformAccount } = require("@/services/reminders/recipients");
const {
  daysUntil,
  dueReminders,
  normalizeDaysBefore,
  reminderKey,
  rulesForItem,
} = require("@/services/reminders/rules");
const { sendManualReminder, sendRuleReminder } = require("@/services/reminders/engine");

const ITEM = {
  id: "activity:41",
  kind: "activity",
  ref: "MS-01",
  title: "Validate Côte d'Ivoire market demand",
  activity: "Validate Côte d'Ivoire market demand",
  deliverable: "Market validation report",
  definition_of_done: "20 interviews",
  owner: { name: "Amina", cid: null, external: true },
  supporting: "David, Grace",
  supporting_names: ["David", "Grace"],
  start: "2026-10-12",
  finish: "2026-10-23",
  is_complete: false,
};

const VENTURE_RULES = [
  { id: 1, scope: "venture", trigger: "start", days_before: 3, notify_owner: true, notify_supporting: true, is_active: true },
  { id: 2, scope: "venture", trigger: "finish", days_before: 2, notify_owner: true, notify_supporting: false, is_active: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  selectAssigneeEmails.mockResolvedValue({ rows: [] });
  selectContactCidByEmail.mockResolvedValue({ rows: [] });
  insertReminderLog.mockResolvedValue({ rows: [{ id: 1 }] });
  selectLeadManagerRecipients.mockResolvedValue({ rows: [] });
  // The workspace mailbox is the primary transport, and the only one that can
  // carry a file attachment.
  mockSend.mockResolvedValue({ success: true, provider: "gmail" });
  mockDownload.mockResolvedValue(null);
});

describe("days before is a setting", () => {
  test("accepts a whole number of days inside the range", () => {
    expect(normalizeDaysBefore(3)).toBe(3);
    expect(normalizeDaysBefore("2")).toBe(2);
    expect(normalizeDaysBefore(0)).toBe(0);
  });

  test("refuses what is not a usable number of days", () => {
    expect(normalizeDaysBefore("soon")).toBeNull();
    expect(normalizeDaysBefore(-1)).toBeNull();
    expect(normalizeDaysBefore(999)).toBeNull();
  });

  test("counts whole days between two dates", () => {
    expect(daysUntil("2026-10-20", "2026-10-23")).toBe(3);
    expect(daysUntil("2026-10-23", "2026-10-23")).toBe(0);
    expect(daysUntil("2026-10-24", "2026-10-23")).toBe(-1);
  });
});

describe("which rules are in force for a work item", () => {
  test("the Venture default applies to every item", () => {
    const rules = rulesForItem(VENTURE_RULES, ITEM);
    expect(rules.map((rule) => rule.trigger).sort()).toEqual(["finish", "start"]);
  });

  test("a per-item rule REPLACES the default for the same trigger, not adds to it", () => {
    const override = { id: 9, scope: "work_item", work_item_kind: "activity", work_item_id: "41", trigger: "start", days_before: 7, is_active: true };
    const rules = rulesForItem([...VENTURE_RULES, override], ITEM);

    const startRules = rules.filter((rule) => rule.trigger === "start");
    expect(startRules).toHaveLength(1);
    expect(startRules[0].days_before).toBe(7);
  });

  test("a per-item rule written for another item is ignored", () => {
    const other = { id: 9, scope: "work_item", work_item_kind: "activity", work_item_id: "99", trigger: "start", days_before: 7, is_active: true };
    const rules = rulesForItem([...VENTURE_RULES, other], ITEM);
    expect(rules.find((rule) => rule.trigger === "start").days_before).toBe(3);
  });

  test("a paused rule is out of force", () => {
    const rules = rulesForItem([{ ...VENTURE_RULES[0], is_active: false }], ITEM);
    expect(rules).toHaveLength(0);
  });
});

describe("one tracker row does not become three reminders", () => {
  // A tracker row arrives as THREE work items — the milestone above it, the
  // activity, and the deliverable it produces — and all three carry the same
  // reference. A rule covering every level would email the owner three times
  // about one line of the tracker.
  const ROW_AS_THREE = [
    { id: "milestone:300", ref: "MS-01", start: "2026-10-12", finish: "2026-10-23", is_complete: false },
    { id: "activity:41", ref: "MS-01", start: "2026-10-12", finish: "2026-10-23", is_complete: false },
    { id: "deliverable:77", ref: "MS-01", start: "2026-10-12", finish: "2026-10-23", is_complete: false },
  ];

  test("a Venture rule covers the ACTIVITY — the level that carries the owner and the dates", () => {
    const due = dueReminders({ items: ROW_AS_THREE, rules: VENTURE_RULES, today: "2026-10-09" });

    expect(due).toHaveLength(1);
    expect(due[0].item.id).toBe("activity:41");
  });

  test("another level can be named deliberately — a milestone holding nothing is worth chasing", () => {
    const due = dueReminders({
      items: ROW_AS_THREE,
      rules: [{ ...VENTURE_RULES[0], work_item_kind: "milestone" }],
      today: "2026-10-09",
    });

    expect(due.map((reminder) => reminder.item.id)).toEqual(["milestone:300"]);
  });

  test("an unknown level falls back to the activity rather than covering everything", () => {
    const due = dueReminders({
      items: ROW_AS_THREE,
      rules: [{ ...VENTURE_RULES[0], work_item_kind: "everything" }],
      today: "2026-10-09",
    });

    expect(due).toHaveLength(1);
    expect(due[0].item.id).toBe("activity:41");
  });
});

describe("what is due today", () => {
  test("inside the window, and never for work already complete", () => {
    const due = dueReminders({ items: [ITEM], rules: VENTURE_RULES, today: "2026-10-09" });
    expect(due).toHaveLength(1);
    expect(due[0].trigger).toBe("start");
    expect(due[0].daysLeft).toBe(3);

    const completed = dueReminders({ items: [{ ...ITEM, is_complete: true }], rules: VENTURE_RULES, today: "2026-10-09" });
    expect(completed).toHaveLength(0);
  });

  test("still fires when the sweep missed the exact day", () => {
    // An outage on day -3 must not swallow the reminder: day -2 is still inside.
    const due = dueReminders({ items: [ITEM], rules: VENTURE_RULES, today: "2026-10-10" });
    expect(due).toHaveLength(1);
    expect(due[0].daysLeft).toBe(2);
  });

  test("does not fire before the window opens, or long after it passed", () => {
    expect(dueReminders({ items: [ITEM], rules: VENTURE_RULES, today: "2026-10-01" })).toHaveLength(0);
    expect(dueReminders({ items: [ITEM], rules: VENTURE_RULES, today: "2026-11-30" })).toHaveLength(0);
  });

  test("an item with no date for a trigger is simply not reminded", () => {
    const due = dueReminders({
      items: [{ ...ITEM, start: null }],
      rules: [VENTURE_RULES[0]],
      today: "2026-10-09",
    });
    expect(due).toHaveLength(0);
  });
});

describe("a reminder's identity keeps it to one send", () => {
  test("the key carries the date the rule watched, so tomorrow is a different key", () => {
    const monday = reminderKey({ ventureId: "VNT-1", item: ITEM, trigger: "start", date: "2026-10-12", email: "A@X.COM" });
    const sameDay = reminderKey({ ventureId: "VNT-1", item: ITEM, trigger: "start", date: "2026-10-12", email: "a@x.com" });
    const nextRun = reminderKey({ ventureId: "VNT-1", item: ITEM, trigger: "start", date: "2026-10-22", email: "a@x.com" });

    expect(monday).toBe(sameDay);
    expect(monday).not.toBe(nextRun);
  });
});

describe("sending claims the reminder before it sends", () => {
  test("a claim that finds the key already taken sends nothing", async () => {
    // The database returned no row: this exact reminder has already been sent.
    insertReminderLog.mockResolvedValue({ rows: [] });
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });

    const outcome = await sendRuleReminder({
      ventureCode: "VNT-1",
      ventureName: "KoraHome",
      item: ITEM,
      rule: VENTURE_RULES[0],
      trigger: "start",
      watchedDate: "2026-10-12",
      daysLeft: 3,
    });

    expect(outcome.sent).toBe(0);
    expect(outcome.already_sent).toBe(1);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("an automatic reminder is claimed with a key, and sent once", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });

    const outcome = await sendRuleReminder({
      ventureCode: "VNT-1",
      ventureName: "KoraHome",
      item: ITEM,
      rule: VENTURE_RULES[0],
      trigger: "start",
      watchedDate: "2026-10-12",
      daysLeft: 3,
    });

    expect(outcome.sent).toBe(1);
    expect(insertReminderLog).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: expect.stringContaining("2026-10-12") }));
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(markReminderSent).toHaveBeenCalled();
  });

  test("a failed send is recorded as failed and frees the slot to retry", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });
    mockSend.mockResolvedValue({ success: false, error: "the provider refused" });

    const outcome = await sendRuleReminder({
      ventureCode: "VNT-1",
      ventureName: "KoraHome",
      item: ITEM,
      rule: VENTURE_RULES[0],
      trigger: "start",
      watchedDate: "2026-10-12",
      daysLeft: 3,
    });

    expect(outcome.failed).toHaveLength(1);
    expect(outcome.sent).toBe(0);
    expect(markReminderFailed).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("refused") }));
    expect(markReminderSent).not.toHaveBeenCalled();
  });

  test("a manual reminder carries no key, so asking twice works", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });

    await sendManualReminder({ ventureCode: "VNT-1", ventureName: "KoraHome", item: ITEM, sentBy: "Gwyn" });

    expect(insertReminderLog).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: null, trigger: "manual" }));
  });

  test("nobody reachable is reported as such, and nothing is sent", async () => {
    const outcome = await sendManualReminder({ ventureCode: "VNT-1", ventureName: "KoraHome", item: ITEM });

    expect(outcome.no_recipients).toBe(true);
    expect(outcome.sent).toBe(0);
    expect(outcome.unreachable.map((entry) => entry.name)).toEqual(["Amina", "David", "Grace"]);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("a manual reminder goes to the owner AND the supporting people", async () => {
    selectAssigneeEmails.mockResolvedValue({
      rows: [
        { display_name: "Amina", email: "amina@example.com" },
        { display_name: "David", email: "david@example.com" },
      ],
    });

    const outcome = await sendManualReminder({ ventureCode: "VNT-1", ventureName: "KoraHome", item: ITEM });
    expect(outcome.sent).toBe(2);
  });

  test("an activity reminder is COPIED to the Venture's lead manager and its sender", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });
    selectLeadManagerRecipients.mockResolvedValue({
      rows: [{ cid: "LM-1", name: "Lena", email: "lena@example.com" }],
    });

    await sendManualReminder({
      ventureCode: "VNT-1",
      ventureName: "KoraHome",
      item: ITEM,
      sentBy: "Gwyn",
      sentByEmail: "gwyn@example.com",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "amina@example.com", cc: ["lena@example.com", "gwyn@example.com"] }),
    );
  });

  test("the recipient is never copied on their own reminder, and other kinds get no copy", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "lena@example.com" }] });
    selectLeadManagerRecipients.mockResolvedValue({
      rows: [{ cid: "LM-1", name: "Lena", email: "lena@example.com" }],
    });

    await sendManualReminder({
      ventureCode: "VNT-1",
      ventureName: "KoraHome",
      item: ITEM,
      sentByEmail: "gwyn@example.com",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "lena@example.com", cc: ["gwyn@example.com"] }),
    );

    mockSend.mockClear();
    await sendManualReminder({
      ventureCode: "VNT-1",
      ventureName: "KoraHome",
      item: { ...ITEM, id: "milestone:9", kind: "milestone" },
      sentByEmail: "gwyn@example.com",
    });
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ cc: [] }));
  });

  test("the manager's own words go out unchanged, and are recorded with the send", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });

    await sendManualReminder({
      ventureCode: "VNT-1",
      ventureName: "KoraHome",
      item: ITEM,
      sentBy: "Gwyn",
      subject: "KoraHome — a word before Friday",
      message: "Please bring the interview notes.",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "KoraHome — a word before Friday", message: "Please bring the interview notes." }),
    );
    expect(insertReminderLog).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "KoraHome — a word before Friday", body: "Please bring the interview notes." }),
    );
  });

  test("a reminder nobody wrote carries no subject, no message and no file", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });

    await sendManualReminder({ ventureCode: "VNT-1", ventureName: "KoraHome", item: ITEM });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: null, message: null, attachments: null }),
    );
    expect(insertReminderLog).toHaveBeenCalledWith(
      expect.objectContaining({ subject: null, body: null, attachmentPath: null, attachmentName: null }),
    );
  });

  test("the attached file is fetched ONCE and carried to every recipient", async () => {
    selectAssigneeEmails.mockResolvedValue({
      rows: [
        { display_name: "Amina", email: "amina@example.com" },
        { display_name: "David", email: "david@example.com" },
      ],
    });
    mockDownload.mockResolvedValue({ content: Buffer.from("evidence"), contentType: "application/pdf" });

    const outcome = await sendManualReminder({
      ventureCode: "VNT-1",
      ventureName: "KoraHome",
      item: ITEM,
      attachment: { path: "reminders/VNT-1/17_plan.pdf", name: "plan.pdf" },
    });

    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockDownload).toHaveBeenCalledWith("reminders/VNT-1/17_plan.pdf");
    expect(mockSend).toHaveBeenCalledTimes(2);
    for (const call of mockSend.mock.calls) {
      expect(call[0].attachments).toEqual([
        { filename: "plan.pdf", content: expect.any(Buffer), contentType: "application/pdf" },
      ]);
    }
    expect(insertReminderLog).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentPath: "reminders/VNT-1/17_plan.pdf",
        attachmentName: "plan.pdf",
      }),
    );
    // Nothing went out without the file, so nothing is reported as missing.
    expect(outcome.attachment_dropped).toBe(false);
  });

  test("a transport that cannot carry the file says so instead of losing it silently", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });
    mockDownload.mockResolvedValue({ content: Buffer.from("evidence"), contentType: "application/pdf" });
    // The transactional fallback has no attachment support.
    mockSend.mockResolvedValue({ success: true, provider: "resend" });

    const outcome = await sendManualReminder({
      ventureCode: "VNT-1",
      ventureName: "KoraHome",
      item: ITEM,
      attachment: { path: "reminders/VNT-1/17_plan.pdf", name: "plan.pdf" },
    });

    expect(outcome.sent).toBe(1);
    expect(outcome.attachment_dropped).toBe(true);
  });
});

describe("where the email's button leads", () => {
  test("an address read from a contact record is an account, with no lookup", async () => {
    expect(await hasPlatformAccount({ email: "a@example.com", source: "contact" })).toBe(true);
    expect(selectContactCidByEmail).not.toHaveBeenCalled();
  });

  test("an address typed by hand is an account only when a contact holds it", async () => {
    expect(await hasPlatformAccount({ email: "amina@example.com", source: "on_file" })).toBe(false);

    selectContactCidByEmail.mockResolvedValue({ rows: [{ cid: "USR_A" }] });
    expect(await hasPlatformAccount({ email: "Amina@Example.com", source: "on_file" })).toBe(true);
    expect(selectContactCidByEmail).toHaveBeenLastCalledWith("amina@example.com");
  });

  test("a failed lookup sends the reader to the login page, not to registration", async () => {
    selectContactCidByEmail.mockRejectedValue(new Error("db down"));
    expect(await hasPlatformAccount({ email: "amina@example.com", source: "on_file" })).toBe(true);
  });

  test("the send tells the email whether its reader has an account", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });
    await sendManualReminder({ ventureCode: "VNT-1", ventureName: "Acme", item: ITEM });
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: "amina@example.com", hasAccount: false }));
  });
});
