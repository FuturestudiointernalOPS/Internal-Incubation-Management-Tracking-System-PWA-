
import { createMessage, ensureMessagesAttachmentNameColumn, ensureMessagesAttachmentUrlColumn, ensureMessagesIsReadColumn, getSenderNameByCidOrId, insertDirectMessageNotification, insertGroupMessageNotification, insertProgramMessageNotification } from "@/models/communications";


import { resolveUserMessageScope, recipientSharesProgram, resolveGroupMemberIds, resolveProgramMemberIds } from "./scope";
/**
 * Send one internal message. Returns `{ id }`, or `{ denied: { error, status } }`
 * when the caller sends as somebody else, broadcasts to all without the right,
 * or targets something outside their program/group scope.
 */
export async function sendInternalMessage({ session, payload }) {
  const {
    sender_id,
    recipient_id,
    target_type,
    target_id,
    subject,
    body,
    priority,
    attachment_url,
    attachment_name,
  } = payload || {};

  // SECURITY: Sender must match the authenticated user. Default to the
  // authenticated user when sender_id is missing/falsy — otherwise a null
  // sender_id reaches the INSERT and leaks a raw SQL error as a 500.
  const sessionCid = session.cid;
  const effectiveSenderId = sender_id || sessionCid;
  if (effectiveSenderId !== sessionCid && session.role !== "super_admin") {
    return { denied: { error: "Cannot send messages as another user.", status: 403 } };
  }

  // SECURITY: Broadcast to all users is reserved to super_admin
  if (target_type === "all" && session.role !== "super_admin") {
    return { denied: { error: "Only super admins can broadcast to all users.", status: 403 } };
  }

  // PROGRAM-SCOPED MESSAGING: non-SA senders may only message targets within
  // their own program/group scope.
  if (session.role !== "super_admin") {
    const scope = await resolveUserMessageScope(session);
    if (target_type === "program" && target_id) {
      if (!scope.programIds.has(String(target_id))) {
        return { denied: { error: "errors.insufficientPermissions", status: 403 } };
      }
    } else if (target_type === "role" && target_id) {
      const normalizedTargetId = String(target_id);
      const inScope =
        (normalizedTargetId === "__staff__" && scope.isFutureStudioStaff) ||
        scope.groupIds.has(normalizedTargetId);
      if (!inScope) {
        return { denied: { error: "errors.insufficientPermissions", status: 403 } };
      }
    } else if (recipient_id) {
      const sharesProgram = await recipientSharesProgram(recipient_id, scope);
      if (!sharesProgram) {
        return { denied: { error: "errors.insufficientPermissions", status: 403 } };
      }
    }
  }

  // Ensure the optional columns exist (safe migrations)
  try {
    await ensureMessagesIsReadColumn();
  } catch (_) {}
  try {
    await ensureMessagesAttachmentUrlColumn();
  } catch (_) {}
  try {
    await ensureMessagesAttachmentNameColumn();
  } catch (_) {}

  const insertResult = await createMessage({
    senderId: effectiveSenderId,
    recipientId: recipient_id,
    targetType: target_type,
    targetId: target_id,
    subject,
    body,
    priority,
    attachmentUrl: attachment_url,
    attachmentName: attachment_name,
  });
  const newMessageId = insertResult.rows[0]?.id;

  // Get sender name for the notification
  let senderName = effectiveSenderId;
  try {
    const senderResult = await getSenderNameByCidOrId(effectiveSenderId);
    if (senderResult.rows.length > 0) senderName = senderResult.rows[0].name;
  } catch (_) {}

  // Trigger Notifications on Message Transmission
  const notificationTitle = "New Message";
  const notificationMessage = `You have 1 new message from ${senderName}`;

  if (recipient_id) {
    await insertDirectMessageNotification(recipient_id, notificationTitle, notificationMessage);
  } else if (target_type === "role" && target_id) {
    // Group message — notify every member of the group (family or staff)
    const memberIds = await resolveGroupMemberIds(target_id);
    for (const memberId of memberIds) {
      if (String(memberId) === String(effectiveSenderId)) continue;
      await insertGroupMessageNotification(memberId, notificationTitle, notificationMessage);
    }
  } else if (target_type === "program" && target_id) {
    // Program message — notify participants, staff, PM and assistants
    const memberIds = await resolveProgramMemberIds(target_id);
    for (const memberId of memberIds) {
      if (String(memberId) === String(effectiveSenderId)) continue;
      await insertProgramMessageNotification(memberId, notificationTitle, notificationMessage);
    }
  }

  return { id: newMessageId };
}

