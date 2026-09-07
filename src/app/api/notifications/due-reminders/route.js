import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  getTasksDueInNext24Hours,
  findRecentDueReminder,
  createDueReminderNotification,
} from "@/models/workspace";

/**
 * POST /api/notifications/due-reminders?key=SECRET_KEY
 *
 * Due Date Reminder Engine
 *
 * Queries tasks that are due within the next 24 hours (excluding completed,
 * archived, and carried_over tasks) and creates a due_reminder notification
 * for each task's user — skipping any task that already has a reminder sent
 * within the last 6 hours to avoid duplicates.
 *
 * Secured by a simple API key query parameter.
 * Intended to be called by a cron / scheduled job.
 */

const REMINDERS_SECRET = process.env.REMINDERS_SECRET_KEY;

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!REMINDERS_SECRET) {
      return NextResponse.json(
        { success: false, error: "Service not configured." },
        { status: 503 },
      );
    }

    if (!key || key !== REMINDERS_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Invalid or missing key." },
        { status: 401 },
      );
    }

    await initDb();

    // 1. Find tasks due within the next 24 hours
    const dueTasks = await getTasksDueInNext24Hours();

    const tasks = dueTasks.rows || [];
    let remindersCreated = 0;

    for (const task of tasks) {
      // 2. Deduplicate — skip if a due_reminder notification already exists
      //    for this task within the last 6 hours
      const existing = await findRecentDueReminder(
        task.user_id,
        `%${task.title}%`,
      );

      if (existing.rows && existing.rows.length > 0) {
        continue; // Already notified recently
      }

      // 3. Create the notification
      const endDateStr = task.end_date
        ? new Date(task.end_date).toISOString().split("T")[0]
        : "tomorrow";

      await createDueReminderNotification(
        task.user_id,
        "Due Date Reminder",
        `Task "${task.title}" is due tomorrow (${endDateStr}).`,
      );

      remindersCreated++;
    }

    return NextResponse.json({
      success: true,
      reminders_created: remindersCreated,
    });
  } catch (error) {
    console.error("Due Reminder Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
