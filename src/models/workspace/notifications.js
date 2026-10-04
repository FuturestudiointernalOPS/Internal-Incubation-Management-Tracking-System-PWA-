import db from "@/lib/db";

/**
 * Workspace model — the notification inbox and the reminder engines
 * (REPOSITORY layer).
 *
 * The inbox reads/actions, the overdue engine and the due-date reminder engine,
 * split verbatim out of `models/workspace.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Create a notification row (unread, timestamped now). */
export async function createNotification(recipientId, title, message, type) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, ?, 0, NOW())`,
    args: [recipientId, title, message, type],
  });
}

let notificationLinkColumnPromise = null;

/** v2_notifications.link — the base schema predates it, so add it on first use. */
export function ensureNotificationLinkColumn() {
  if (!notificationLinkColumnPromise) {
    notificationLinkColumnPromise = db
      .execute("ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS link TEXT")
      .catch(() => {
        notificationLinkColumnPromise = null; // allow a retry on the next call
      });
  }
  return notificationLinkColumnPromise;
}

/**
 * Create a notification that carries a destination. The inbox turns it into
 * navigation for the types that know what to do with it (investor,
 * venture_invite). Kept separate from createNotification so the many existing
 * producers never depend on the link column.
 */
export async function createLinkedNotification(recipientId, title, message, type, link) {
  await ensureNotificationLinkColumn();
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
            VALUES (?, ?, ?, ?, 0, NOW(), ?)`,
    args: [recipientId, title, message, type, link],
  });
}

/** A recipient's 50 most recent notification rows. */
export async function getRecentNotifications(recipientId) {
  return db.execute({
    sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50",
    args: [recipientId],
  });
}

/**
 * The recipient's TRUE unread count — a COUNT, not the length of a page of rows.
 *
 * A badge fed by a limited list is wrong twice over: it caps at the page size,
 * so an inbox with more unread than the page shows a number that is too small,
 * and it can only shrink when the rows it happens to hold are read. Counting
 * the rows themselves is what makes the badge honest.
 */
export async function countUnreadNotifications(recipientId) {
  return db.execute({
    sql: `SELECT COUNT(*) AS c FROM v2_notifications
          WHERE recipient_id = ? AND (is_read = 0 OR is_read IS NULL)`,
    args: [recipientId],
  });
}

/** Notification row restricted to recipient_id, for ownership checks. */
export async function getNotificationRecipientById(notificationId) {
  return db.execute({
    sql: "SELECT recipient_id FROM v2_notifications WHERE id = ?",
    args: [notificationId],
  });
}

/** Mark a notification as read. */
export async function markNotificationRead(notificationId) {
  return db.execute({
    sql: "UPDATE v2_notifications SET is_read = 1, read_at = COALESCE(read_at, NOW()) WHERE id = ?",
    args: [notificationId],
  });
}

/**
 * Stamp fetched notification ids as SEEN (not read). Read = the user opened
 * the item; seen ≠ read is what makes unread badges feel correct. No-op when
 * ids is empty.
 */
export async function markNotificationsSeen(ids) {
  if (!ids || ids.length === 0) return { rows: [] };
  const placeholders = ids.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE v2_notifications SET seen_at = COALESCE(seen_at, NOW())
          WHERE id IN (${placeholders}) AND seen_at IS NULL`,
    args: ids,
  });
}

/** Tasks past their end_date (excluding completed and archived). */
export async function getOverdueTasks() {
  return db.execute({
    sql: `SELECT id, user_id, title, end_date
            FROM tasks
            WHERE end_date < NOW()
              AND status NOT IN ('completed', 'archived')`,
    args: [],
  });
}

/** Existing 'overdue' notification for a task within the last 24 hours. */
export async function findRecentOverdueNotification(recipientId, titlePattern) {
  return db.execute({
    sql: `SELECT id FROM v2_notifications
              WHERE recipient_id = ?
                AND type = 'overdue'
                AND message ILIKE ?
                AND created_at >= NOW() - INTERVAL '24 hours'
              LIMIT 1`,
    args: [recipientId, titlePattern],
  });
}

/** Insert an 'overdue' notification. */
export async function createOverdueNotification(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
              VALUES (?, ?, ?, 'overdue', 0, NOW())`,
    args: [recipientId, title, message],
  });
}

/** Tasks due within the next 24 hours (excluding completed/archived/carried_over). */
export async function getTasksDueInNext24Hours() {
  return db.execute({
    sql: `SELECT id, user_id, title, end_date
            FROM tasks
            WHERE end_date BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
              AND status NOT IN ('completed', 'archived', 'carried_over')`,
    args: [],
  });
}

/** Existing 'due_reminder' notification for a task within the last 6 hours. */
export async function findRecentDueReminder(recipientId, titlePattern) {
  return db.execute({
    sql: `SELECT id FROM v2_notifications
              WHERE recipient_id = ?
                AND type = 'due_reminder'
                AND message ILIKE ?
                AND created_at >= NOW() - INTERVAL '6 hours'
              LIMIT 1`,
    args: [recipientId, titlePattern],
  });
}

/** Insert a 'due_reminder' notification. */
export async function createDueReminderNotification(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
              VALUES (?, ?, ?, 'due_reminder', 0, NOW())`,
    args: [recipientId, title, message],
  });
}
