import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

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

const REMINDERS_SECRET = process.env.REMINDERS_SECRET_KEY || "changeme";

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key || key !== REMINDERS_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Invalid or missing key." },
        { status: 401 },
      );
    }

    await initDb();

    // 1. Find tasks due within the next 24 hours
    const dueTasks = await db.execute({
      sql: `SELECT id, user_id, title, end_date
            FROM tasks
            WHERE end_date BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
              AND status NOT IN ('completed', 'archived', 'carried_over')`,
      args: [],
    });

    const tasks = dueTasks.rows || [];
    let remindersCreated = 0;

    for (const task of tasks) {
      // 2. Deduplicate — skip if a due_reminder notification already exists
      //    for this task within the last 6 hours
      const existing = await db.execute({
        sql: `SELECT id FROM v2_notifications
              WHERE recipient_id = ?
                AND type = 'due_reminder'
                AND message ILIKE ?
                AND created_at >= NOW() - INTERVAL '6 hours'
              LIMIT 1`,
        args: [task.user_id, `%${task.title}%`],
      });

      if (existing.rows && existing.rows.length > 0) {
        continue; // Already notified recently
      }

      // 3. Create the notification
      const endDateStr = task.end_date
        ? new Date(task.end_date).toISOString().split("T")[0]
        : "tomorrow";

      await db.execute({
        sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
              VALUES (?, ?, ?, 'due_reminder', 0, NOW())`,
        args: [
          task.user_id,
          "Due Date Reminder",
          `Task "${task.title}" is due tomorrow (${endDateStr}).`,
        ],
      });

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
