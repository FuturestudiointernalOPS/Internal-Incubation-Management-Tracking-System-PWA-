import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { requireAuth, getSession } from "@/lib/auth";
import { readNotificationInbox, publishInboxNotification, applyInboxNotificationAction } from "@/services/communications/inboxNotifications";

/**
 * NOTIFICATIONS API — SIGNAL AGGREGATION
 * Fetches real-time alerts for the Super Admin (Approvals, Alerts, etc.)
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const { recipient_id, title, message, type } = await req.json();

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: "Title and message required" },
        { status: 400 },
      );
    }

    const outcome = await publishInboxNotification({ session, recipient_id, title, message, type });
    if (outcome.denied) return NextResponse.json({ success: false, error: outcome.denied.error }, { status: outcome.denied.status });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST Notification Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);

    // Try to get notifications — if auth fails, return empty (graceful degradation)
    try {
      const authError = await requireAuth();
      if (authError) {
        return NextResponse.json({ success: true, notifications: [] });
      }
    } catch (_) {
      return NextResponse.json({ success: true, notifications: [] });
    }

    const session = await getSession();
    const payload = await readNotificationInbox({ session, requestedId: searchParams.get("recipient_id"), groupBy: searchParams.get("group_by") });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("GET Notifications Error:", error);
    return NextResponse.json({ success: true, notifications: [] });
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const { id, action } = await req.json();

    const outcome = await applyInboxNotificationAction({ session, id, action });
    if (outcome.denied) return NextResponse.json({ success: false, error: outcome.denied.error }, { status: outcome.denied.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH Notifications Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
