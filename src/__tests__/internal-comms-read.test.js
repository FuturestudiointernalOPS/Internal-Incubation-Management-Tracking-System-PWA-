/**
 * The mark-read use-case hands the visibility plan to the repository.
 *
 * A Super Admin's id list needs no scope lookup; a caller outside the named
 * conversation is refused before anything is written.
 */

jest.mock("@/models/communications", () => ({
  ensureMessagesIsReadColumnForMarkRead: jest.fn().mockResolvedValue(true),
  updateMessagesReadByIds: jest.fn().mockResolvedValue({ rows: [], rowsAffected: 1 }),
  markMessageNotificationsRead: jest.fn().mockResolvedValue(true),
  markConversationMessagesRead: jest.fn().mockResolvedValue(true),
}));

import * as model from "@/models/communications";
import { markMessagesRead } from "@/services/communications/internalComms";

beforeEach(() => jest.clearAllMocks());

test("a super admin's id list is marked read through the unrestricted plan", async () => {
  await markMessagesRead({
    session: { cid: "ADMIN", role: "super_admin" },
    messageIds: [1, 2],
  });

  expect(model.updateMessagesReadByIds).toHaveBeenCalledWith([1, 2], {
    isSuperAdmin: true,
    targetCid: "ADMIN",
    groupIds: [],
    programIds: [],
    isFutureStudioStaff: false,
  });
  expect(model.markMessageNotificationsRead).toHaveBeenCalledWith("ADMIN");
});

test("marking a conversation you are not part of is refused before writing", async () => {
  const outcome = await markMessagesRead({
    session: { cid: "USR", role: "user" },
    conversationWith: { senderId: "A", recipientId: "B" },
  });

  expect(outcome).toEqual({
    denied: {
      error: "Cannot mark messages as read for a conversation you are not part of.",
      status: 403,
    },
  });
  expect(model.updateMessagesReadByIds).not.toHaveBeenCalled();
  expect(model.markConversationMessagesRead).not.toHaveBeenCalled();
});
