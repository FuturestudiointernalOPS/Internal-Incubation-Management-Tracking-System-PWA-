jest.mock("@/models/workspace", () => ({
  getOverdueTasks: jest.fn(),
  findRecentOverdueNotification: jest.fn(),
  createOverdueNotification: jest.fn(),
  getTasksDueInNext24Hours: jest.fn(),
  findRecentDueReminder: jest.fn(),
  createDueReminderNotification: jest.fn(),
}));

import {
  getOverdueTasks,
  findRecentOverdueNotification,
  createOverdueNotification,
  getTasksDueInNext24Hours,
  findRecentDueReminder,
  createDueReminderNotification,
} from "@/models/workspace";
import { notifyOverdueTasks, notifyDueReminders } from "@/services/communications/notifications";

describe("notifyOverdueTasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findRecentOverdueNotification.mockResolvedValue({ rows: [] });
    createOverdueNotification.mockResolvedValue({});
  });

  it("returns 0 when no task is overdue", async () => {
    getOverdueTasks.mockResolvedValue({ rows: [] });
    await expect(notifyOverdueTasks()).resolves.toEqual({ overdueCount: 0 });
    expect(createOverdueNotification).not.toHaveBeenCalled();
  });

  it("creates one notification per task with the formatted date", async () => {
    getOverdueTasks.mockResolvedValue({
      rows: [{ user_id: 7, title: "Ship it", end_date: "2026-09-30T10:00:00.000Z" }],
    });
    await expect(notifyOverdueTasks()).resolves.toEqual({ overdueCount: 1 });
    expect(findRecentOverdueNotification).toHaveBeenCalledWith(7, "%Ship it%");
    expect(createOverdueNotification).toHaveBeenCalledWith(
      7,
      "Overdue Task",
      'Task "Ship it" was due 2026-09-30 and is now overdue!',
    );
  });

  it("skips a task already notified within 24h", async () => {
    getOverdueTasks.mockResolvedValue({
      rows: [{ user_id: 7, title: "Ship it", end_date: "2026-09-30T10:00:00.000Z" }],
    });
    findRecentOverdueNotification.mockResolvedValue({ rows: [{ id: 1 }] });
    await expect(notifyOverdueTasks()).resolves.toEqual({ overdueCount: 0 });
    expect(createOverdueNotification).not.toHaveBeenCalled();
  });

  it("uses 'unknown' when end_date is missing", async () => {
    getOverdueTasks.mockResolvedValue({
      rows: [{ user_id: 3, title: "No date", end_date: null }],
    });
    await notifyOverdueTasks();
    expect(createOverdueNotification).toHaveBeenCalledWith(
      3,
      "Overdue Task",
      'Task "No date" was due unknown and is now overdue!',
    );
  });
});

describe("notifyDueReminders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findRecentDueReminder.mockResolvedValue({ rows: [] });
    createDueReminderNotification.mockResolvedValue({});
  });

  it("returns 0 when no task is due soon", async () => {
    getTasksDueInNext24Hours.mockResolvedValue({ rows: [] });
    await expect(notifyDueReminders()).resolves.toEqual({ remindersCreated: 0 });
    expect(createDueReminderNotification).not.toHaveBeenCalled();
  });

  it("creates one reminder per task with the formatted date", async () => {
    getTasksDueInNext24Hours.mockResolvedValue({
      rows: [{ user_id: 7, title: "Ship it", end_date: "2026-10-02T10:00:00.000Z" }],
    });
    await expect(notifyDueReminders()).resolves.toEqual({ remindersCreated: 1 });
    expect(findRecentDueReminder).toHaveBeenCalledWith(7, "%Ship it%");
    expect(createDueReminderNotification).toHaveBeenCalledWith(
      7,
      "Due Date Reminder",
      'Task "Ship it" is due tomorrow (2026-10-02).',
    );
  });

  it("skips a task already reminded within 6h", async () => {
    getTasksDueInNext24Hours.mockResolvedValue({
      rows: [{ user_id: 7, title: "Ship it", end_date: "2026-10-02T10:00:00.000Z" }],
    });
    findRecentDueReminder.mockResolvedValue({ rows: [{ id: 1 }] });
    await expect(notifyDueReminders()).resolves.toEqual({ remindersCreated: 0 });
    expect(createDueReminderNotification).not.toHaveBeenCalled();
  });

  it("falls back to 'tomorrow' when end_date is missing", async () => {
    getTasksDueInNext24Hours.mockResolvedValue({
      rows: [{ user_id: 3, title: "No date", end_date: null }],
    });
    await notifyDueReminders();
    expect(createDueReminderNotification).toHaveBeenCalledWith(
      3,
      "Due Date Reminder",
      'Task "No date" is due tomorrow (tomorrow).',
    );
  });
});
