import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * POST /api/notifications/overdue?key=SECRET_KEY
 *
 * Overdue Notification Engine
 *
 * Queries tasks that are past their end_date (excluding completed and archived)
 * and creates an "overdue" notification for each task's user — skipping any
 * task that already has an overdue notification sent within the last 24 hours
 * to avoid duplicates.
 *
 * Secured by a simple API key query parameter.
 * Intended to be called by a cron / scheduled job.
 */

const OVERDUE_SECRET = process.env.OVERDUE_SECRET_KEY;

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!OVERDUE_SECRET) {
      return NextResponse.json(
        { success: false, error: "Service not configured." },
        { status: 503 },
      );
    }

    if (!key || key !== OVERDUE_SECRET) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Invalid or missing key." },
        { status: 401 },
      );
    }

    await initDb();

    // 1. Find tasks that are past their due date
    const overdueTasks = await db.execute({
      sql: `SELECT id, user_id, title, end_date
            FROM tasks
            WHERE end_date < NOW()
              AND status NOT IN ('completed', 'archived')`,
      args: [],
    });

    const tasks = overdueTasks.rows || [];
    let overdueCount = 0;

    for (const task of tasks) {
      // 2. Deduplicate — skip if an "overdue" notification already exists
      //    for this task within the last 24 hours
      const existing = await db.execute({
        sql: `SELECT id FROM v2_notifications
              WHERE recipient_id = ?
                AND type = 'overdue'
                AND message ILIKE ?
                AND created_at >= NOW() - INTERVAL '24 hours'
              LIMIT 1`,
        args: [task.user_id, `%${task.title}%`],
      });

      if (existing.rows && existing.rows.length > 0) {
        continue; // Already notified recently
      }

      // 3. Format the end_date for display
      const endDateStr = task.end_date
        ? new Date(task.end_date).toISOString().split("T")[0]
        : "unknown";

      // 4. Create the overdue notification
      await db.execute({
        sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
              VALUES (?, ?, ?, 'overdue', 0, NOW())`,
        args: [
          task.user_id,
          "Overdue Task",
          `Task "${task.title}" was due ${endDateStr} and is now overdue!`,
        ],
      });

      overdueCount++;
    }

    return NextResponse.json({
      success: true,
      overdue_count: overdueCount,
    });
  } catch (error) {
    console.error("Overdue Notification Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
