import db from "@/lib/db";

/**
 * Communications — internal-message reads and writes (REPOSITORY layer).
 *
 * The statements behind the inbox, the message send and the mark-read path,
 * split verbatim out of `models/communications.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per statement, named after the data.
 */

/** Safe migration: ensure v2_messages.is_deleted exists. */
export async function ensureMessagesIsDeletedColumn() {
  return db.execute(
    "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0",
  );
}

/** Safe migration: ensure v2_messages.is_read exists (before insert). */
export async function ensureMessagesIsReadColumn() {
  return db.execute(
    "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0",
  );
}

/** Safe migration: ensure v2_messages.attachment_url exists. */
export async function ensureMessagesAttachmentUrlColumn() {
  return db.execute(
    "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT",
  );
}

/** Safe migration: ensure v2_messages.attachment_name exists. */
export async function ensureMessagesAttachmentNameColumn() {
  return db.execute(
    "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT",
  );
}

/** Insert a new message and return its id. */
export async function createMessage({
  senderId,
  recipientId,
  targetType,
  targetId,
  subject,
  body,
  priority,
  attachmentUrl,
  attachmentName,
}) {
  return db.execute({
    sql: "INSERT INTO v2_messages (sender_id, recipient_id, target_type, target_id, subject, body, priority, is_read, attachment_url, attachment_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    args: [
      senderId,
      recipientId || null,
      targetType || "individual",
      targetId || null,
      subject,
      body,
      priority || "normal",
      0,
      attachmentUrl || null,
      attachmentName || null,
    ],
  });
}

/** Contact display name for a sender (looked up by cid or legacy id). */
export async function getSenderNameByCidOrId(identifier) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ? OR id = ?",
    args: [identifier, identifier],
  });
}

/** Notify a direct message recipient. */
export async function insertDirectMessageNotification(recipientId, title, message) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
    args: [recipientId, title, message, "message"],
  });
}

/** Notify one member of a role/group-target message. */
export async function insertGroupMessageNotification(memberId, title, message) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
    args: [memberId, title, message, "message"],
  });
}

/** Notify one member of a program-target message. */
export async function insertProgramMessageNotification(memberId, title, message) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)",
    args: [memberId, title, message, "message"],
  });
}

/** Safe migration: ensure v2_messages.is_read exists (before mark-read). */
export async function ensureMessagesIsReadColumnForMarkRead() {
  return db.execute(
    "ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0",
  );
}

/**
 * Mark a list of message ids as read, restricted to the caller's visibility.
 *
 * `plan` is the same decision the inbox uses (see
 * `services/communications/messageScope`): a Super Admin plan is unrestricted,
 * any other plan only admits the caller's own messages plus the group/program
 * scopes they belong to. The predicate is byte-identical to the inbox's, so a
 * caller can only mark read what they could actually list — the read-side
 * ownership guarantee the route-level session/capability checks never provided.
 */
export async function updateMessagesReadByIds(messageIds, plan) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return { rows: [], rowsAffected: 0 };
  }

  const placeholders = messageIds.map(() => "?").join(",");
  const args = [...messageIds];

  let visibility = "";
  if (!plan.isSuperAdmin) {
    const clauses = ["(recipient_id = ? OR sender_id = ?)"];
    args.push(plan.targetCid, plan.targetCid);

    if (plan.isFutureStudioStaff) {
      clauses.push("(target_type = 'role' AND target_id = '__staff__')");
    }
    if (plan.groupIds.length > 0) {
      clauses.push(
        `(target_type = 'role' AND target_id IN (${plan.groupIds.map(() => "?").join(",")}))`,
      );
      args.push(...plan.groupIds);
    }
    if (plan.programIds.length > 0) {
      clauses.push(
        `(target_type = 'program' AND target_id IN (${plan.programIds.map(() => "?").join(",")}))`,
      );
      args.push(...plan.programIds);
    }

    visibility = ` AND (${clauses.join(" OR ")})`;
  }

  return db.execute({
    sql: `UPDATE v2_messages SET is_read = 1 WHERE id IN (${placeholders})${visibility}`,
    args,
  });
}

/** Mark a user's message-type notifications as read. */
export async function markMessageNotificationsRead(sessionCid) {
  return db.execute({
    sql: "UPDATE v2_notifications SET is_read = 1 WHERE recipient_id = ? AND type = 'message' AND is_read = 0",
    args: [sessionCid],
  });
}

/** Mark all unread messages between a sender and recipient as read. */
export async function markConversationMessagesRead(senderId, recipientId) {
  return db.execute({
    sql: "UPDATE v2_messages SET is_read = 1 WHERE sender_id = ? AND recipient_id = ? AND (is_read IS NULL OR is_read = 0)",
    args: [senderId, recipientId],
  });
}
