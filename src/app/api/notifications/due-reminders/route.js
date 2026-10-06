import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { notifyDueReminders } from "@/services/communications/notifications";

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
    // The secret travels in a header so it stops landing in access logs; the
    // query parameter is still accepted for existing schedulers (deprecated).
    const key = req.headers.get("x-cron-secret") || searchParams.get("key");

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

    const { remindersCreated } = await notifyDueReminders();

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
