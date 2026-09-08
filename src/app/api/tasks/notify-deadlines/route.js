import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  getTasksEndingWithin24Hours,
  createDeadlineNotification,
} from "@/models/taskLifecycle";

/**
 * UPCOMING DEADLINE NOTIFICATIONS (Ticket 1.9)
 *
 * POST /api/tasks/notify-deadlines
 *   Checks tasks with end_date within the next 24 hours and notifies assignees.
 *   Idempotent — won't notify twice for the same task on the same day.
 *
 * Called via cron. Protected by CRON_SECRET header.
 */

export async function POST(req) {
  try {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    await initDb();

    // Find tasks ending in the next 24 hours that haven't been notified today
    const tasks = await getTasksEndingWithin24Hours();

    let notified = 0;
    for (const task of tasks.rows) {
      const recipientId = task.assigned_to || task.user_id;
      if (!recipientId) continue;

      const hoursLeft = Math.max(
        1,
        Math.ceil((new Date(task.end_date) - new Date()) / 3600000),
      );
      const timeLabel = hoursLeft <= 1 ? "1 hour" : `${hoursLeft} hours`;

      await createDeadlineNotification(
        recipientId,
        "Upcoming Deadline",
        `Task "${task.title}" (#${task.id}) is due in ${timeLabel}`,
        "deadline",
      );
      notified++;
    }

    return NextResponse.json({ success: true, notified });
  } catch (error) {
    console.error("notify-deadlines error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
