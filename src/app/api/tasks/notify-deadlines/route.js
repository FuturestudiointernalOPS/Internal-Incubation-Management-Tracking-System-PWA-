import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * UPCOMING DEADLINE NOTIFICATIONS (Ticket 1.9)
 *
 * POST /api/tasks/notify-deadlines
 *   Checks tasks with end_date within the next 24 hours and notifies assignees.
 *   Idempotent — won't notify twice for the same task on the same day.
 *
 * Called by the frontend on page load, or via cron.
 */

export async function POST() {
  try {
    await initDb();

    // Find tasks ending in the next 24 hours that haven't been notified today
    const tasks = await db.execute({
      sql: `SELECT t.id, t.title, t.assigned_to, t.user_id, t.user_name, t.end_date
            FROM tasks t
            WHERE t.end_date IS NOT NULL
              AND t.end_date >= NOW()
              AND t.end_date <= NOW() + INTERVAL '24 hours'
              AND t.status NOT IN ('completed', 'carried_over', 'archived')
              AND NOT EXISTS (
                SELECT 1 FROM v2_notifications n
                WHERE n.recipient_id = COALESCE(t.assigned_to, t.user_id)
                  AND n.type = 'deadline'
                  AND n.created_at > NOW() - INTERVAL '24 hours'
                  AND n.message LIKE '%' || t.id || '%'
              )`,
    });

    let notified = 0;
    for (const task of tasks.rows) {
      const recipientId = task.assigned_to || task.user_id;
      if (!recipientId) continue;

      const hoursLeft = Math.max(1, Math.ceil((new Date(task.end_date) - new Date()) / 3600000));
      const timeLabel = hoursLeft <= 1 ? "1 hour" : `${hoursLeft} hours`;

      await db.execute({
        sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read)
              VALUES (?, ?, ?, ?, 0)`,
        args: [
          recipientId,
          "Upcoming Deadline",
          `Task "${task.title}" (#${task.id}) is due in ${timeLabel}`,
          "deadline",
        ],
      });
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
