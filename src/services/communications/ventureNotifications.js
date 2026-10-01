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
