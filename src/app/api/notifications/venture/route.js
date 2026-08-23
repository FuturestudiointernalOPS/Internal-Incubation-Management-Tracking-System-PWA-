import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  listNotifications, getNotification, markNotificationRead, markAllNotificationsRead,
  archiveNotification, deleteNotification, getUnreadCount, sendTemplatedNotification,
  getNotificationTemplates, getNotificationPreferences, updateNotificationPreferences,
} from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

  const s = new URL(req.url).searchParams;
  let recipientId = s.get("recipient_id") || session.cid || "sa";
  if (
    s.get("recipient_id") &&
    String(s.get("recipient_id")) !== String(session.cid) &&
    session.role !== "super_admin"
  ) {
    recipientId = session.cid;
  }
  const type = s.get("type") || "list";

  if (type === "list") {
    const notifications = await listNotifications(recipientId, {
      type: s.get("filter_type"), status: s.get("status"),
      limit: parseInt(s.get("limit")) || 50,
    });
    const unread = await getUnreadCount(recipientId);
    return NextResponse.json({ success: true, notifications, unread_count: unread });
  }

  if (type === "unread_count") {
    const count = await getUnreadCount(recipientId);
    return NextResponse.json({ success: true, unread_count: count });
  }

  if (type === "templates") {
    const templates = await getNotificationTemplates();
    return NextResponse.json({ success: true, templates });
  }

  if (type === "preferences") {
    const prefs = await getNotificationPreferences(recipientId);
    return NextResponse.json({ success: true, preferences: prefs });
  }

  if (type === "detail" && s.get("notification_id")) {
    const n = await getNotification(parseInt(s.get("notification_id")));
    if (!n) return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    if (String(n.recipient_id) !== String(session.cid) && session.role !== "super_admin") {
      return NextResponse.json({ success: false, error: "You cannot view this notification." }, { status: 403 });
    }
    return NextResponse.json({ success: true, notification: n });
  }

  return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
});

export const POST = createHandler(async (req) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

  const body = await req.json();
  let recipientId = body.recipient_id || session.cid || "sa";
  if (
    body.recipient_id &&
    String(body.recipient_id) !== String(session.cid) &&
    session.role !== "super_admin"
  ) {
    recipientId = session.cid;
  }

  if (body.action === "mark_read") {
    const n = await getNotification(parseInt(body.notification_id));
    if (!n) return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    if (String(n.recipient_id) !== String(session.cid) && session.role !== "super_admin") {
      return NextResponse.json({ success: false, error: "You cannot modify this notification." }, { status: 403 });
    }
    await markNotificationRead(parseInt(body.notification_id));
    return NextResponse.json({ success: true });
  }

  if (body.action === "mark_all_read") {
    await markAllNotificationsRead(recipientId);
    return NextResponse.json({ success: true });
  }

  if (body.action === "archive") {
    const n = await getNotification(parseInt(body.notification_id));
    if (!n) return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    if (String(n.recipient_id) !== String(session.cid) && session.role !== "super_admin") {
      return NextResponse.json({ success: false, error: "You cannot modify this notification." }, { status: 403 });
    }
    await archiveNotification(parseInt(body.notification_id));
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete") {
    const n = await getNotification(parseInt(body.notification_id));
    if (!n) return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    if (String(n.recipient_id) !== String(session.cid) && session.role !== "super_admin") {
      return NextResponse.json({ success: false, error: "You cannot modify this notification." }, { status: 403 });
    }
    await deleteNotification(parseInt(body.notification_id));
    return NextResponse.json({ success: true });
  }

  if (body.action === "send_test") {
    const result = await sendTemplatedNotification({
      templateKey: "welcome", recipientId,
      variables: { platform_name: "Venture OS", user_name: session.name || "User" },
    });
    return NextResponse.json({ success: true, notification_id: result.id });
  }

  if (body.action === "update_preferences") {
    await updateNotificationPreferences(recipientId, body.updates);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
