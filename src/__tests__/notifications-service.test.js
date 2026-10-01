jest.mock("@/models/workspace", () => ({
  getOverdueTasks: jest.fn(),
  findRecentOverdueNotification: jest.fn(),
  createOverdueNotification: jest.fn(),
}));

import {
  getOverdueTasks,
  findRecentOverdueNotification,
  createOverdueNotification,
} from "@/models/workspace";
import { notifyOverdueTasks } from "@/services/communications/notifications";

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
