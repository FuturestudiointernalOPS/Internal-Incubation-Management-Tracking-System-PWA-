import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { notifyOverdueTasks } from "@/services/communications/notifications";

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
    // The secret travels in a header so it stops landing in access logs; the
    // query parameter is still accepted for existing schedulers (deprecated).
    const key = req.headers.get("x-cron-secret") || searchParams.get("key");

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

    const { overdueCount } = await notifyOverdueTasks();

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
