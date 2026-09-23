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

  const queryParams = new URL(req.url).searchParams;
  let recipientId = queryParams.get("recipient_id") || session.cid || "sa";
  if (
    queryParams.get("recipient_id") &&
    String(queryParams.get("recipient_id")) !== String(session.cid) &&
    session.role !== "super_admin"
  ) {
    recipientId = session.cid;
  }
  const type = queryParams.get("type") || "list";

  if (type === "list") {
    const notifications = await listNotifications(recipientId, {
      type: queryParams.get("filter_type"), status: queryParams.get("status"),
      limit: parseInt(queryParams.get("limit")) || 50,
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
    const preferences = await getNotificationPreferences(recipientId);
    return NextResponse.json({ success: true, preferences });
  }

  if (type === "detail" && queryParams.get("notification_id")) {
    const notification = await getNotification(parseInt(queryParams.get("notification_id")));
    if (!notification) return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    if (String(notification.recipient_id) !== String(session.cid) && session.role !== "super_admin") {
      return NextResponse.json({ success: false, error: "You cannot view this notification." }, { status: 403 });
    }
    return NextResponse.json({ success: true, notification });
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
    const notification = await getNotification(parseInt(body.notification_id));
    if (!notification) return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    if (String(notification.recipient_id) !== String(session.cid) && session.role !== "super_admin") {
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
    const notification = await getNotification(parseInt(body.notification_id));
    if (!notification) return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    if (String(notification.recipient_id) !== String(session.cid) && session.role !== "super_admin") {
      return NextResponse.json({ success: false, error: "You cannot modify this notification." }, { status: 403 });
    }
    await archiveNotification(parseInt(body.notification_id));
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete") {
    const notification = await getNotification(parseInt(body.notification_id));
    if (!notification) return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    if (String(notification.recipient_id) !== String(session.cid) && session.role !== "super_admin") {
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
