/**
 * CRM — in-app attention notifications.
 *
 * The sweep reuses the platform inbox. These tests pin: the recipient (the
 * record's owner), the per-record-per-kind-per-day dedupe, the localized
 * template payload with its link, and the process throttle.
 */

jest.mock("@/services/crm/dashboard", () => ({ STALE_AFTER_DAYS: 14 }));
jest.mock("@/models/crm/notifications", () => ({
  ensureCrmNotificationColumns: jest.fn(async () => {}),
  getCrmOverdueNotificationCandidates: jest.fn(),
  getCrmDormantNotificationCandidates: jest.fn(),
  getCrmStuckNotificationCandidates: jest.fn(),
  findCrmNotification: jest.fn(),
  createCrmNotification: jest.fn(),
}));

const {
  getCrmOverdueNotificationCandidates,
  getCrmDormantNotificationCandidates,
  getCrmStuckNotificationCandidates,
  findCrmNotification,
  createCrmNotification,
} = require("@/models/crm/notifications");
const {
  sweepCrmNotifications,
  NOTIFICATION_SWEEP_INTERVAL_MS,
} = require("@/services/crm/notifications");
const { notificationText } = require("@/lib/notificationText");

const NOW = new Date("2026-10-13T12:00:00Z");

beforeEach(() => {
  jest.clearAllMocks();
  getCrmOverdueNotificationCandidates.mockResolvedValue({ rows: [] });
  getCrmDormantNotificationCandidates.mockResolvedValue({ rows: [] });
  getCrmStuckNotificationCandidates.mockResolvedValue({ rows: [] });
  findCrmNotification.mockResolvedValue({ rows: [] });
  createCrmNotification.mockResolvedValue({});
});

test("the sweep is throttled per process unless forced", async () => {
  const first = await sweepCrmNotifications();
  expect(first.skipped).toBe(false);

  const second = await sweepCrmNotifications();
  expect(second.skipped).toBe(true);

  const forced = await sweepCrmNotifications({ force: true });
  expect(forced.skipped).toBe(false);
  expect(NOTIFICATION_SWEEP_INTERVAL_MS).toBeGreaterThan(0);
});

test("each candidate becomes one linked, localized notification for its owner", async () => {
  getCrmOverdueNotificationCandidates.mockResolvedValue({
    rows: [{
      entity: "lead",
      id: "l-1",
      name: "MTN",
      owner_cid: "owner-1",
      next_action: "Call back",
      due: "2026-10-01T00:00:00Z",
    }],
  });
  getCrmDormantNotificationCandidates.mockResolvedValue({
    rows: [{ id: "o-1", name: "Moov", owner_cid: "owner-1" }],
  });
  getCrmStuckNotificationCandidates.mockResolvedValue({
    rows: [{
      id: "o-2",
      name: "Bank",
      owner_cid: "owner-1",
      stage_name: "Proposal",
      target_days: "7",
      days_in_stage: "12",
    }],
  });

  const result = await sweepCrmNotifications({ force: true, now: NOW });

  expect(result).toMatchObject({ created: 3, duplicates: 0, unowned: 0 });

  const byType = Object.fromEntries(
    createCrmNotification.mock.calls.map(([row]) => [row.type, row]),
  );

  expect(byType.crm_overdue).toMatchObject({
    recipientId: "owner-1",
    templateKey: "crm.notifications.overdue",
    link: "/crm/leads/l-1",
    dedupeKey: "crm:overdue:lead:l-1:2026-10-13",
    params: { name: "MTN", action: "Call back", date: "2026-10-01" },
  });
  expect(byType.crm_dormant).toMatchObject({
    recipientId: "owner-1",
    templateKey: "crm.notifications.dormant",
    link: "/crm/opportunities/o-1",
    dedupeKey: "crm:dormant:opportunity:o-1:2026-10-13",
    params: { name: "Moov", days: 14 },
  });
  expect(byType.crm_stuck).toMatchObject({
    recipientId: "owner-1",
    templateKey: "crm.notifications.stuck",
    link: "/crm/opportunities/o-2",
    params: { name: "Bank", stage: "Proposal", days: 12, target: 7 },
  });
});

test("a record with no owner produces no notification", async () => {
  getCrmOverdueNotificationCandidates.mockResolvedValue({
    rows: [{
      entity: "lead",
      id: "l-1",
      name: "MTN",
      owner_cid: null,
      next_action: "Call back",
      due: "2026-10-01",
    }],
  });

  const result = await sweepCrmNotifications({ force: true, now: NOW });

  expect(result.unowned).toBe(1);
  expect(createCrmNotification).not.toHaveBeenCalled();
});

test("an alert already sent today is not sent again", async () => {
  getCrmOverdueNotificationCandidates.mockResolvedValue({
    rows: [{
      entity: "lead",
      id: "l-1",
      name: "MTN",
      owner_cid: "owner-1",
      next_action: "Call back",
      due: "2026-10-01",
    }],
  });
  findCrmNotification.mockResolvedValue({ rows: [{ 1: 1 }] });

  const result = await sweepCrmNotifications({ force: true, now: NOW });

  expect(result.duplicates).toBe(1);
  expect(createCrmNotification).not.toHaveBeenCalled();
});

describe("notificationText", () => {
  const t = (key, params) =>
    key === "crm.notifications.overdue.title"
      ? "Prochaine action en retard"
      : key === "crm.notifications.overdue.message"
        ? `${params.name} — ${params.action}`
        : key;

  test("a CRM template is rendered in the reader's language", () => {
    expect(
      notificationText(
        {
          title: "Overdue next action",
          message: "MTN — Call back was due 2026-10-01.",
          template_key: "crm.notifications.overdue",
          params: { name: "MTN", action: "Call back" },
        },
        t,
      ),
    ).toEqual({ title: "Prochaine action en retard", message: "MTN — Call back" });
  });

  test("JSONB params arriving as a string are read", () => {
    const view = notificationText(
      {
        title: "x",
        message: "y",
        template_key: "crm.notifications.overdue",
        params: '{"name":"MTN","action":"Call back"}',
      },
      t,
    );
    expect(view.message).toBe("MTN — Call back");
  });

  test("a missing translation falls back to the stored prose", () => {
    const missing = (key) => key;
    expect(
      notificationText(
        {
          title: "Overdue next action",
          message: "Stored message",
          template_key: "crm.notifications.overdue",
          params: {},
        },
        missing,
      ),
    ).toEqual({ title: "Overdue next action", message: "Stored message" });
  });

  test("a non-CRM notification keeps its stored prose", () => {
    expect(
      notificationText({ title: "Hello", message: "World" }, t),
    ).toEqual({ title: "Hello", message: "World" });
  });
});
