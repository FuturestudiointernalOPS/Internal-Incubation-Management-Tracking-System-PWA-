import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { requireAuth, getSession } from "@/lib/auth";
import { groupNotificationContext } from "@/lib/notificationContext";
import {
  createNotification,
  getRecentNotifications,
  countUnreadNotifications,
  getNotificationRecipientById,
  markNotificationRead,
  markNotificationsSeen,
} from "@/models/workspace";
import {
  resolveInboxRecipient,
  canCreateNotificationFor,
  canModifyInboxNotification,
  selectUnreadRows,
  collectNotificationIds,
  parseUnreadCount,
} from "@/services/communications/inboxNotifications";

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

    const recipientId = recipient_id || session.cid;
    if (!canCreateNotificationFor(session, recipient_id)) {
      return NextResponse.json(
        { success: false, error: "You cannot create notifications for other users." },
        { status: 403 },
      );
    }

    await createNotification(recipientId, title, message, type || "general");

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
    // non-privileged callers are forced onto their own inbox, no info leak
    const recipientId = resolveInboxRecipient(session, searchParams.get("recipient_id"));

    let rows = [];
    try {
      const result = await getRecentNotifications(recipientId);
      rows = result.rows || [];
      rows = selectUnreadRows(rows);

      // Opening the inbox marks fetched notifications as SEEN (not read).
      // Read = the user opened the item (PATCH read). Seen ≠ read is what
      // makes unread badges feel correct.
      const ids = collectNotificationIds(rows);
      if (ids.length > 0) {
        try {
          await markNotificationsSeen(ids);
        } catch (_) {}
      }
    } catch (_) {
      rows = [];
    }

    // The rows are the panel's list; the COUNT is the badge. They are read
    // separately because the list is paginated (50) while the badge must show
    // every unread row, so deriving one from the other under-reported.
    let unreadCount = 0;
    try {
      const counted = await countUnreadNotifications(recipientId);
      unreadCount = parseUnreadCount(counted);
    } catch (_) {
      unreadCount = rows.length;
    }

    // Drill-down mode (Vinance 3 Phase 1): ?group_by=context adds the §4
    // breadcrumb tree (venture → journey → milestone → task/session) as an
    // ADDITIVE field — the default `notifications` payload is unchanged.
    const payload = { success: true, notifications: rows, unread_count: unreadCount };
    if (searchParams.get("group_by") === "context") {
      payload.grouped = groupNotificationContext(rows);
    }
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

    if (action === "read") {
      const recipientResult = await getNotificationRecipientById(parseInt(id));
      if (!recipientResult.rows || recipientResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Notification not found." },
          { status: 404 },
        );
      }
      if (!canModifyInboxNotification(session, recipientResult.rows[0].recipient_id)) {
        return NextResponse.json(
          { success: false, error: "You cannot modify this notification." },
          { status: 403 },
        );
      }
      await markNotificationRead(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("PATCH Notifications Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
