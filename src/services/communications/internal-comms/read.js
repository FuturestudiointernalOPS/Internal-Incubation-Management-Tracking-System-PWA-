
import { ensureMessagesIsReadColumnForMarkRead, markConversationMessagesRead, markMessageNotificationsRead, updateMessagesReadByIds } from "@/models/communications";

import { resolveMessageVisibilityPlan } from "./scope";

/**
 * Mark messages read. Returns `{ denied: { error, status } }` when the caller is
 * not part of the named conversation.
 *
 * The `messageIds` branch is restricted to the caller's message visibility (the
 * same plan the inbox renders), so a caller can only mark read rows they could
 * actually list — an id they cannot see updates zero rows. The conversation
 * branch is already scoped to the sender/recipient pair.
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
    // SECURITY: only the messages this caller may see can be marked read.
    const plan = await resolveMessageVisibilityPlan(session, sessionCid);
    await updateMessagesReadByIds(messageIds, plan);
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
