const mockHistory = jest.fn();
const mockRecipient = jest.fn();
const mockUnread = jest.fn();
jest.mock("@/models/workspace", () => ({ getParticipantAnnouncementHistory: mockHistory, getNotificationRecipientById: mockRecipient, markNotificationUnread: mockUnread }));
const { readParticipantAnnouncements, applyInboxNotificationAction } = require("@/services/communications/inboxNotifications");
beforeEach(() => jest.clearAllMocks());
test("announcement history uses the session recipient and preserves read rows", async () => {
  mockHistory.mockResolvedValue({ rows: [{ id: 1, is_read: 1 }, { id: 2, is_read: 0 }] });
  const result = await readParticipantAnnouncements({ cid: "p1", role: "participant" });
  expect(mockHistory).toHaveBeenCalledWith("p1");
  expect(result.announcements).toHaveLength(2);
  expect(result.recipientId).toBe("p1");
});
test("participant cannot mark another recipient's announcement unread", async () => {
  mockRecipient.mockResolvedValue({ rows: [{ recipient_id: "other" }] });
  const result = await applyInboxNotificationAction({ session: { cid: "p1", role: "participant" }, id: 1, action: "unread" });
  expect(result.denied.status).toBe(403);
  expect(mockUnread).not.toHaveBeenCalled();
});
test("recipient can mark their announcement unread", async () => {
  mockRecipient.mockResolvedValue({ rows: [{ recipient_id: "p1" }] });
  await applyInboxNotificationAction({ session: { cid: "p1", role: "participant" }, id: 1, action: "unread" });
  expect(mockUnread).toHaveBeenCalledWith(1);
});
