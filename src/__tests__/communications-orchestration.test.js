jest.mock("@/models/workspace", () => ({
  createNotification: jest.fn(), getRecentNotifications: jest.fn(),
  countUnreadNotifications: jest.fn(), getNotificationRecipientById: jest.fn(),
  markNotificationRead: jest.fn(), markNotificationsSeen: jest.fn(),
}));
jest.mock("@/services/ventures/notifications", () => ({
  getNotification: jest.fn(), markNotificationRead: jest.fn(),
  archiveNotification: jest.fn(), deleteNotification: jest.fn(),
  listNotifications: jest.fn(), getUnreadCount: jest.fn(),
  markAllNotificationsRead: jest.fn(), sendTemplatedNotification: jest.fn(),
  getNotificationTemplates: jest.fn(), getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
}));
jest.mock("@/models/communications", () => ({
  getFollowupById: jest.fn(), updateFollowup: jest.fn(),
  isContactInFacilitatorTeams: jest.fn(), isContactInFacilitatorTeamsForUpdate: jest.fn(),
}));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("@/server/authz/capabilities", () => ({
  hasProgramManagementAccess: (role) => ["staff", "super_admin", "program_manager"].includes(role),
}));
jest.mock("@/models/authorization/accessQueries", () => ({ getFacilitatorTeamScope: jest.fn() }));
jest.mock("@/services/authorization/resourceGuards", () => ({ evaluateAssignmentAccess: jest.fn() }));

import * as inbox from "@/models/workspace";
import * as venture from "@/services/ventures/notifications";
import * as followups from "@/models/communications";
import { getSession } from "@/server/auth/session";
import { getFacilitatorTeamScope } from "@/models/authorization/accessQueries";
import { evaluateAssignmentAccess } from "@/services/authorization/resourceGuards";
import { readNotificationInbox, publishInboxNotification, applyInboxNotificationAction } from "@/services/communications/inboxNotifications";
import { readVentureNotificationCenter, actOnVentureNotification } from "@/services/communications/ventureNotifications";
import { evaluateFollowupParticipantAccess, updateScopedFollowup } from "@/services/communications/followups";

const session = { cid: "USR1", role: "participant" };
beforeEach(() => jest.resetAllMocks());

test("inbox ignores a participant's requested recipient, marks only unread rows seen, and counts all unread", async () => {
  inbox.getRecentNotifications.mockResolvedValue({ rows: [
    { id: 0, is_read: 0 }, { id: 2, is_read: 1 }, { id: 3 },
  ] });
  inbox.countUnreadNotifications.mockResolvedValue({ rows: [{ c: "75" }] });
  const result = await readNotificationInbox({ session, requestedId: "OTHER" });
  expect(inbox.getRecentNotifications).toHaveBeenCalledWith("USR1");
  expect(inbox.markNotificationsSeen).toHaveBeenCalledWith([0, 3]);
  expect(result).toEqual({ success: true, notifications: [{ id: 0, is_read: 0 }, { id: 3 }], unread_count: 75 });
});

test("seen and count failures preserve the unread list and its fallback count", async () => {
  inbox.getRecentNotifications.mockResolvedValue({ rows: [{ id: 1, is_read: 0 }] });
  inbox.markNotificationsSeen.mockRejectedValue(new Error("seen unavailable"));
  inbox.countUnreadNotifications.mockRejectedValue(new Error("count unavailable"));
  expect(await readNotificationInbox({ session })).toEqual({ success: true, notifications: [{ id: 1, is_read: 0 }], unread_count: 1 });
});

test("notification creation and marking read refuse another participant's inbox before writing", async () => {
  expect(await publishInboxNotification({ session, recipient_id: "OTHER", title: "Title", message: "Body" })).toMatchObject({ denied: { status: 403 } });
  expect(inbox.createNotification).not.toHaveBeenCalled();
  inbox.getNotificationRecipientById.mockResolvedValue({ rows: [{ recipient_id: "OTHER" }] });
  expect(await applyInboxNotificationAction({ session, id: "12", action: "read" })).toMatchObject({ denied: { status: 403 } });
  expect(inbox.markNotificationRead).not.toHaveBeenCalled();
});

test.each(["mark_read", "archive", "delete"])("venture %s checks ownership before mutation", async (action) => {
  venture.getNotification.mockResolvedValue({ recipient_id: "OTHER" });
  expect(await actOnVentureNotification({ session, body: { action, notification_id: "8" } })).toEqual({ denied: { error: "You cannot modify this notification.", status: 403 } });
  expect(venture.markNotificationRead).not.toHaveBeenCalled();
  expect(venture.archiveNotification).not.toHaveBeenCalled();
  expect(venture.deleteNotification).not.toHaveBeenCalled();
});

test("venture list keeps default pagination and the independent unread count", async () => {
  venture.listNotifications.mockResolvedValue([{ id: 1 }]);
  venture.getUnreadCount.mockResolvedValue(70);
  const queryParams = new URLSearchParams("recipient_id=OTHER&limit=0");
  expect(await readVentureNotificationCenter({ session, queryParams })).toEqual({ notifications: [{ id: 1 }], unread_count: 70 });
  expect(venture.listNotifications).toHaveBeenCalledWith("USR1", { type: null, status: null, limit: 50 });
});

test("followup assignment refusal propagates before team lookup", async () => {
  const denial = { allowed: false, status: 403, errorKey: "errors.insufficientPermissions" };
  evaluateAssignmentAccess.mockResolvedValue(denial);
  expect(await evaluateFollowupParticipantAccess({ session: { ...session, role: "facilitator" }, programId: "P1", participantId: "OTHER" })).toEqual(denial);
  expect(getFacilitatorTeamScope).not.toHaveBeenCalled();
});

test("followup update uses its stored program and participant, refusing an out-of-team write", async () => {
  followups.getFollowupById.mockResolvedValue({ rows: [{ program_id: "P1", participant_id: "OTHER" }] });
  getSession.mockResolvedValue({ ...session, role: "facilitator" });
  evaluateAssignmentAccess.mockResolvedValue({ allowed: true });
  getFacilitatorTeamScope.mockResolvedValue({ scope: "teams", teamIds: ["T1"] });
  followups.isContactInFacilitatorTeamsForUpdate.mockResolvedValue({ rows: [] });
  expect(await updateScopedFollowup({ id: "F1", status: "completed" })).toMatchObject({ allowed: false, status: 403 });
  expect(evaluateAssignmentAccess).toHaveBeenCalledWith({ resource: "program", contextId: "P1" });
  expect(followups.isContactInFacilitatorTeamsForUpdate).toHaveBeenCalledWith("OTHER", ["T1"]);
  expect(followups.updateFollowup).not.toHaveBeenCalled();
});

test("missing followup preserves the legacy no-op update", async () => {
  followups.getFollowupById.mockResolvedValue({ rows: [] });
  expect(await updateScopedFollowup({ id: "MISSING", notes: "Note" })).toEqual({ allowed: true });
  expect(followups.updateFollowup).toHaveBeenCalledWith({ id: "MISSING", notes: "Note", status: undefined, meetingLink: undefined, scheduledAt: undefined });
  expect(evaluateAssignmentAccess).not.toHaveBeenCalled();
});
