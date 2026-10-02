import {
  listNotifications, getNotification, markNotificationRead, markAllNotificationsRead,
  archiveNotification, deleteNotification, getUnreadCount, sendTemplatedNotification,
  getNotificationTemplates, getNotificationPreferences, updateNotificationPreferences,
} from "@/services/ventures/notifications";
/**
 * Venture notification access rules (pure decisions, no SQL, no HTTP).
 * The route keeps transport: it maps these answers to 401/403/404 responses.
 */

/**
 * Which recipient inbox a request acts on. A caller may only target another
 * recipient when they are a super_admin; otherwise they are pinned to their own
 * id. Defaults to the caller's id, then to "sa".
 */
export function resolveNotificationRecipient(session, requestedId) {
  let recipientId = requestedId || session.cid || "sa";
  if (
    requestedId &&
    String(requestedId) !== String(session.cid) &&
    session.role !== "super_admin"
  ) {
    recipientId = session.cid;
  }
  return recipientId;
}

/** A notification is visible/modifiable by its recipient or a super_admin. */
export function canAccessNotification(session, notification) {
  return (
    String(notification.recipient_id) === String(session.cid) ||
    session.role === "super_admin"
  );
}

/** Read dispatch; authorization failures remain values for the HTTP controller. */
export async function readVentureNotificationCenter({ session, queryParams }) {
  const recipientId = resolveNotificationRecipient(session, queryParams.get("recipient_id"));
  const type = queryParams.get("type") || "list";

  if (type === "list") {
    const notifications = await listNotifications(recipientId, {
      type: queryParams.get("filter_type"), status: queryParams.get("status"),
      limit: parseInt(queryParams.get("limit")) || 50,
    });
    const unread = await getUnreadCount(recipientId);
    return { notifications, unread_count: unread };
  }

  if (type === "unread_count") {
    const count = await getUnreadCount(recipientId);
    return { unread_count: count };
  }

  if (type === "templates") {
    const templates = await getNotificationTemplates();
    return { templates };
  }

  if (type === "preferences") {
    const preferences = await getNotificationPreferences(recipientId);
    return { preferences };
  }

  if (type === "detail" && queryParams.get("notification_id")) {
    const notification = await getNotification(parseInt(queryParams.get("notification_id")));
    if (!notification) return { denied: { error: "Notification not found.", status: 404 } };
    if (!canAccessNotification(session, notification)) {
      return { denied: { error: "You cannot view this notification.", status: 403 } };
    }
    return { notification };
  }

  return { denied: { error: "Invalid type.", status: 400 } };
}

/** Apply one notification action, preserving ownership checks before writes. */
export async function actOnVentureNotification({ session, body }) {
  const recipientId = resolveNotificationRecipient(session, body.recipient_id);

  if (body.action === "mark_read") {
    const notification = await getNotification(parseInt(body.notification_id));
    if (!notification) return { denied: { error: "Notification not found.", status: 404 } };
    if (!canAccessNotification(session, notification)) {
      return { denied: { error: "You cannot modify this notification.", status: 403 } };
    }
    await markNotificationRead(parseInt(body.notification_id));
    return {};
  }

  if (body.action === "mark_all_read") {
    await markAllNotificationsRead(recipientId);
    return {};
  }

  if (body.action === "archive") {
    const notification = await getNotification(parseInt(body.notification_id));
    if (!notification) return { denied: { error: "Notification not found.", status: 404 } };
    if (!canAccessNotification(session, notification)) {
      return { denied: { error: "You cannot modify this notification.", status: 403 } };
    }
    await archiveNotification(parseInt(body.notification_id));
    return {};
  }

  if (body.action === "delete") {
    const notification = await getNotification(parseInt(body.notification_id));
    if (!notification) return { denied: { error: "Notification not found.", status: 404 } };
    if (!canAccessNotification(session, notification)) {
      return { denied: { error: "You cannot modify this notification.", status: 403 } };
    }
    await deleteNotification(parseInt(body.notification_id));
    return {};
  }

  if (body.action === "send_test") {
    const result = await sendTemplatedNotification({
      templateKey: "welcome", recipientId,
      variables: { platform_name: "Venture OS", user_name: session.name || "User" },
    });
    return { notification_id: result.id };
  }

  if (body.action === "update_preferences") {
    await updateNotificationPreferences(recipientId, body.updates);
    return {};
  }

  return { denied: { error: "Invalid action.", status: 400 } };
}
