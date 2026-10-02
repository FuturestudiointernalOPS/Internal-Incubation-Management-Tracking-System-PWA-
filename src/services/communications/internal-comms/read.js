
import { ensureMessagesIsReadColumnForMarkRead, markConversationMessagesRead, markMessageNotificationsRead, markMessagesReadByIds } from "@/models/communications";


/**
 * Mark messages read. Returns `{ denied: { error, status } }` when the caller is
 * not part of the named conversation.
 */
export async function markMessagesRead({ session, messageIds, conversationWith }) {
  const sessionCid = session.cid;

  // SECURITY: Validate the user is a participant in the conversation
  if (conversationWith) {
    if (
      conversationWith.recipientId !== sessionCid &&
      conversationWith.senderId !== sessionCid &&
      session.role !== "super_admin"
    ) {
      return {
        denied: {
          error: "Cannot mark messages as read for a conversation you are not part of.",
          status: 403,
        },
      };
    }
  }

  // Ensure is_read column exists
  try {
    await ensureMessagesIsReadColumnForMarkRead();
  } catch (_) {}

  if (Array.isArray(messageIds) && messageIds.length > 0) {
    await markMessagesReadByIds(messageIds);
    // Mark corresponding notifications as read
    try {
      await markMessageNotificationsRead(sessionCid);
    } catch (_) {}
  } else if (conversationWith) {
    // Mark all messages from a specific sender as read
    await markConversationMessagesRead(
      conversationWith.senderId,
      conversationWith.recipientId,
    );
  }

  return { ok: true };
}
