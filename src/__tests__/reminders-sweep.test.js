/**
 * The reminder sweep — what a scheduled run does, and what one bad Venture must
 * not do to the rest.
 *
 * A sweep is the one part of the feature that runs unattended, so the tests here
 * are about containment: a Venture that cannot be read does not stop the ones
 * after it, a Venture with no rules is not touched at all, and per-Venture counts
 * are reported rather than summarised away.
 */
jest.mock("@/models/ventureWorkspace", () => ({
  getVentureDbIdByCodeOrId: jest.fn(async () => ({ rows: [{ id: "db-1" }] })),
  getVentureNameByIdOrCode: jest.fn(async () => ({ rows: [{ company_name: "KoraHome" }] })),
}));

jest.mock("@/models/ventureReminders", () => ({
  selectVenturesWithActiveRules: jest.fn(async () => ({ rows: [] })),
  selectReminderRules: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/services/workItems", () => ({
  buildWorkItems: jest.fn(async () => ({ items: [] })),
}));

jest.mock("@/services/reminders/engine", () => ({
  sendRuleReminder: jest.fn(async () => ({ sent: 0, already_sent: 0, failed: [], no_recipients: false })),
}));

const { getVentureDbIdByCodeOrId, getVentureNameByIdOrCode } = require("@/models/ventureWorkspace");
const { selectVenturesWithActiveRules, selectReminderRules } = require("@/models/ventureReminders");
const { buildWorkItems } = require("@/services/workItems");
const { sendRuleReminder } = require("@/services/reminders/engine");
const { runReminderSweep } = require("@/services/reminders/sweep");

const RULE = { id: 1, scope: "venture", trigger: "start", days_before: 3, notify_owner: true, notify_supporting: false, is_active: true };
const ITEM = {
  id: "activity:41",
  ref: "MS-01",
  title: "Validate demand",
  start: "2026-10-12",
  finish: "2026-10-23",
  is_complete: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  getVentureDbIdByCodeOrId.mockResolvedValue({ rows: [{ id: "db-1" }] });
  getVentureNameByIdOrCode.mockResolvedValue({ rows: [{ company_name: "KoraHome" }] });
  selectVenturesWithActiveRules.mockResolvedValue({ rows: [{ venture_id: "VNT-KORA" }] });
  selectReminderRules.mockResolvedValue({ rows: [RULE] });
  buildWorkItems.mockResolvedValue({ items: [ITEM] });
  sendRuleReminder.mockResolvedValue({ sent: 1, already_sent: 0, failed: [], no_recipients: false });
});

describe("the sweep's work list", () => {
  test("only Ventures that have an ACTIVE rule are swept", async () => {
    selectVenturesWithActiveRules.mockResolvedValue({ rows: [] });

    const report = await runReminderSweep({ now: new Date("2026-10-09T06:00:00Z") });

    expect(report.ventures).toHaveLength(0);
    expect(buildWorkItems).not.toHaveBeenCalled();
  });

  test("a Venture whose rules are all paused is read but not chased", async () => {
    selectReminderRules.mockResolvedValue({ rows: [{ ...RULE, is_active: false }] });

    const report = await runReminderSweep({ now: new Date("2026-10-09T06:00:00Z") });

    expect(report.ventures[0].due).toBe(0);
    expect(sendRuleReminder).not.toHaveBeenCalled();
  });

  test("one Venture can be swept on its own — how a rule is tested without waiting", async () => {
    await runReminderSweep({ ventureCode: "VNT-KORA", now: new Date("2026-10-09T06:00:00Z") });

    expect(selectVenturesWithActiveRules).not.toHaveBeenCalled();
    expect(buildWorkItems).toHaveBeenCalledWith(expect.objectContaining({ ventureCode: "VNT-KORA" }));
  });
});

describe("it sends what came due, and counts it", () => {
  test("the day is the runtime's UTC day — the same day the read uses", async () => {
    const report = await runReminderSweep({ now: new Date("2026-10-09T23:30:00Z") });
    expect(report.today).toBe("2026-10-09");
  });

  test("three days before Start is due, and the send is reported", async () => {
    const report = await runReminderSweep({ now: new Date("2026-10-09T06:00:00Z") });

    expect(report.ventures[0].due).toBe(1);
    expect(report.sent).toBe(1);
    expect(sendRuleReminder).toHaveBeenCalledWith(
      expect.objectContaining({ ventureCode: "VNT-KORA", trigger: "start", daysLeft: 3, watchedDate: "2026-10-12" }),
    );
  });

  test("work already done is never chased", async () => {
    buildWorkItems.mockResolvedValue({ items: [{ ...ITEM, is_complete: true }] });

    const report = await runReminderSweep({ now: new Date("2026-10-09T06:00:00Z") });
    expect(report.ventures[0].due).toBe(0);
    expect(sendRuleReminder).not.toHaveBeenCalled();
  });

  test("a send that reached nobody is counted as such, not as a success", async () => {
    sendRuleReminder.mockResolvedValue({ sent: 0, already_sent: 0, failed: [], no_recipients: true });

    const report = await runReminderSweep({ now: new Date("2026-10-09T06:00:00Z") });
    expect(report.sent).toBe(0);
    expect(report.no_recipients).toBe(1);
  });

  test("a second run the same day is reported as already sent", async () => {
    sendRuleReminder.mockResolvedValue({ sent: 0, already_sent: 1, failed: [], no_recipients: false });

    const report = await runReminderSweep({ now: new Date("2026-10-09T18:00:00Z") });
    expect(report.sent).toBe(0);
    expect(report.skipped).toBe(1);
  });
});

describe("one Venture cannot stop the others", () => {
  test("a Venture that cannot be read is reported, and the sweep continues", async () => {
    selectVenturesWithActiveRules.mockResolvedValue({ rows: [{ venture_id: "VNT-BROKEN" }, { venture_id: "VNT-KORA" }] });
    getVentureDbIdByCodeOrId.mockImplementation(async (code) =>
      code === "VNT-BROKEN" ? Promise.reject(new Error("connection reset")) : { rows: [{ id: "db-1" }] },
    );

    const report = await runReminderSweep({ now: new Date("2026-10-09T06:00:00Z") });

    expect(report.ventures).toHaveLength(2);
    expect(report.ventures[0].errors.join(" ")).toContain("could not be resolved");
    // The second Venture was still chased.
    expect(report.sent).toBe(1);
  });

  test("an unresolvable Venture is reported rather than silently skipped", async () => {
    getVentureDbIdByCodeOrId.mockResolvedValue({ rows: [] });

    const report = await runReminderSweep({ now: new Date("2026-10-09T06:00:00Z") });
    expect(report.ventures[0].errors.join(" ")).toContain("could not be resolved");
  });

  test("a failed send is collected with the work item it belonged to", async () => {
    sendRuleReminder.mockResolvedValue({
      sent: 0,
      already_sent: 0,
      failed: [{ error: "mailbox full" }],
      no_recipients: false,
    });

    const report = await runReminderSweep({ now: new Date("2026-10-09T06:00:00Z") });
    expect(report.failed).toBe(1);
    expect(report.ventures[0].errors.join(" ")).toContain("MS-01");
    expect(report.ventures[0].errors.join(" ")).toContain("mailbox full");
  });
});
