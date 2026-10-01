import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { notifyUpcomingDeadlines } from "@/services/tasks/deadlines";

/**
 * UPCOMING DEADLINE NOTIFICATIONS (Ticket 1.9) — controller layer.
 *
 * POST /api/tasks/notify-deadlines
 *   Checks tasks with end_date within the next 24 hours and notifies assignees.
 *   Idempotent — won't notify twice for the same task on the same day.
 *
 * Called via cron. Protected by the CRON_SECRET header (an authentication
 * concern, kept here); the reminder logic lives in
 * `@/services/tasks/deadlines`.
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

    const result = await notifyUpcomingDeadlines();
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("notify-deadlines error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
