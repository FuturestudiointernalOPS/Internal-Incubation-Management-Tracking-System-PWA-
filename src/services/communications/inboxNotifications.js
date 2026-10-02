import { groupNotificationContext } from "@/lib/notificationContext";
import {
  createNotification,
  getRecentNotifications,
  countUnreadNotifications,
  getNotificationRecipientById,
  markNotificationRead,
  markNotificationsSeen,
} from "@/models/workspace";
/**
 * Inbox notification decisions and orchestration (no SQL, no HTTP).
 * The route owns authentication, input validation and response serialization;
 * the service preserves fail-open reads, independent unread counts and ownership checks.
 */

// Roles allowed to act on another user's inbox.
const INBOX_ADMIN_ROLES = ["super_admin", "staff", "program_manager"];

/**
 * Which inbox a GET reads. Non-privileged callers are pinned to their own
 * inbox (no info leak). Defaults to the caller's id, then to "sa". A missing
 * session is tolerated and honours the requested id.
 */
export function resolveInboxRecipient(session, requestedId) {
  let recipientId = requestedId || session?.cid || "sa";
  if (
    session &&
    requestedId &&
    String(requestedId) !== String(session.cid) &&
    !INBOX_ADMIN_ROLES.includes(session.role)
  ) {
    recipientId = session.cid;
  }
  return recipientId;
}

/** May the caller create a notification for requestedId (empty = themself)? */
export function canCreateNotificationFor(session, requestedId) {
  return !(
    requestedId &&
    String(requestedId) !== String(session.cid) &&
    !INBOX_ADMIN_ROLES.includes(session.role)
  );
}

/** May the caller modify a notification addressed to notificationRecipientId? */
export function canModifyInboxNotification(session, notificationRecipientId) {
  return (
    String(notificationRecipientId) === String(session.cid) ||
    INBOX_ADMIN_ROLES.includes(session.role)
  );
}

/** Keep only unread rows (is_read 0 or missing; loose equality is legacy). */
export function selectUnreadRows(rows) {
  return rows.filter((row) => row.is_read == 0 || row.is_read == null);
}

/** Ids to mark as SEEN: every row id that is defined (0 is a valid id). */
export function collectNotificationIds(rows) {
  return (rows || [])
    .map((row) => row.id)
    .filter((notificationId) => notificationId !== undefined && notificationId !== null);
}

/**
 * The unread badge from a COUNT query result. Deliberately does not guard
 * `counted`: an undefined result must still throw so the route falls back to
 * the page length.
 */
export function parseUnreadCount(counted) {
  return parseInt(counted.rows?.[0]?.c || 0, 10);
}

export async function readNotificationInbox({ session, requestedId, groupBy }) {
  // non-privileged callers are forced onto their own inbox, no info leak
  const recipientId = resolveInboxRecipient(session, requestedId);

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
  if (groupBy === "context") {
    payload.grouped = groupNotificationContext(rows);
  }
  return payload;
}

export async function publishInboxNotification({ session, recipient_id, title, message, type }) {
  const recipientId = recipient_id || session.cid;
  if (!canCreateNotificationFor(session, recipient_id)) {
    return { denied: { error: "You cannot create notifications for other users.", status: 403 } };
  }

  await createNotification(recipientId, title, message, type || "general");

  return { ok: true };
}

export async function applyInboxNotificationAction({ session, id, action }) {
  if (action === "read") {
    const recipientResult = await getNotificationRecipientById(parseInt(id));
    if (!recipientResult.rows || recipientResult.rows.length === 0) {
      return { denied: { error: "Notification not found.", status: 404 } };
    }
    if (!canModifyInboxNotification(session, recipientResult.rows[0].recipient_id)) {
      return { denied: { error: "You cannot modify this notification.", status: 403 } };
    }
    await markNotificationRead(id);
    return { ok: true };
  }

  return { denied: { error: "Invalid action", status: 400 } };
}
