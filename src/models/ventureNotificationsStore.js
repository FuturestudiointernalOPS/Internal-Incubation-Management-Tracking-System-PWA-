/**
 * Venture notification centre — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/notifications`: the notification
 * rows and their delivery log, the read/archive/delete writes, the unread count,
 * the templates and the per-user preferences.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 * (Distinct from `@/models/ventureActivityStore`, which writes the shared
 * `v2_notifications` inbox.)
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Notifications ────────────────────────────────────────────────────────────

/** Insert one venture notification, returning its id. */
export function insertNotificationRow({
  recipientId, recipientType, ventureId, type, title, body, dataJson, priority, source, sourceId,
}) {
  return db.execute({
    sql: `INSERT INTO venture_notifications (recipient_id, recipient_type, venture_id, type, title, body, data, priority, source, source_id) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?) RETURNING id`,
    args: [recipientId, recipientType, ventureId, type, title, body, dataJson, priority, source, sourceId],
  });
}

/** Append the in-app delivery-log row for a notification. */
export function insertNotificationDeliveryLog(notificationId) {
  return db.execute({ sql: `INSERT INTO venture_notification_delivery_logs (notification_id, channel, status) VALUES (?, 'in_app', 'sent')`, args: [notificationId] });
}

/** A recipient's notifications (optional type/status filters). */
export function selectNotifications(recipientId, { type, status, limit, offset } = {}) {
  let sql = "SELECT * FROM venture_notifications WHERE (recipient_id=? OR recipient_type='all')";
  const args = [recipientId];
  if (type) { sql += " AND type=?"; args.push(type); }
  if (status) { sql += " AND status=?"; args.push(status); }
  else { sql += " AND status != 'archived'"; }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return db.execute({ sql, args });
}

/** One notification row. */
export function selectNotificationById(notifId) {
  return db.execute({ sql: "SELECT * FROM venture_notifications WHERE id=?", args: [notifId] });
}

/** Mark one notification read. */
export function markNotificationReadRow(notifId) {
  return db.execute({ sql: "UPDATE venture_notifications SET status='read', read_at=NOW() WHERE id=?", args: [notifId] });
}

/** Mark a recipient's unread notifications read. */
export function markAllNotificationsReadRow(recipientId) {
  return db.execute({ sql: "UPDATE venture_notifications SET status='read', read_at=NOW() WHERE (recipient_id=? OR recipient_type='all') AND status='unread'", args: [recipientId] });
}

/** Archive one notification. */
export function archiveNotificationRow(notifId) {
  return db.execute({ sql: "UPDATE venture_notifications SET status='archived' WHERE id=?", args: [notifId] });
}

/** Delete one notification. */
export function deleteNotificationRow(notifId) {
  return db.execute({ sql: "DELETE FROM venture_notifications WHERE id=?", args: [notifId] });
}

/** Count a recipient's unread notifications. */
export function countUnreadNotifications(recipientId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_notifications WHERE (recipient_id=? OR recipient_type='all') AND status='unread'", args: [recipientId] });
}

// ── Templates ────────────────────────────────────────────────────────────────

/** The active notification templates, by name. */
export function selectNotificationTemplates() {
  return db.execute({ sql: "SELECT * FROM venture_notification_templates WHERE is_active=TRUE ORDER BY name" });
}

/** One active notification template by key. */
export function selectNotificationTemplateByKey(templateKey) {
  return db.execute({ sql: "SELECT * FROM venture_notification_templates WHERE template_key=? AND is_active=TRUE", args: [templateKey] });
}

// ── Preferences ──────────────────────────────────────────────────────────────

/** A user's notification preferences row. */
export function selectNotificationPreferences(userCid) {
  return db.execute({ sql: "SELECT * FROM venture_notification_preferences WHERE user_cid=?", args: [userCid] });
}

/** Create the default preferences row for a user. */
export function insertNotificationPreferences(userCid, preferencesJson) {
  return db.execute({
    sql: `INSERT INTO venture_notification_preferences (user_cid, preferences) VALUES (?, ?::jsonb)`,
    args: [userCid, preferencesJson],
  });
}

/** Apply a computed SET list to a user's preferences. */
export function updateNotificationPreferencesRow(sets, args) {
  return db.execute({ sql: `UPDATE venture_notification_preferences SET ${sets.join(",")} WHERE user_cid=?`, args });
}
