/**
 * Inbox notification rules for /api/notifications (pure decisions, no SQL, no
 * HTTP). The route keeps transport: the 400/403/404 responses and the
 * fail-open try/catch around each read.
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
