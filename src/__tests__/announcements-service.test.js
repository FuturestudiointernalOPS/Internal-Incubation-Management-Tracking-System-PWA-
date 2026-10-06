jest.mock("@/models/communications", () => ({
  archiveAnnouncementById: jest.fn(),
  createAnnouncement: jest.fn(),
  ensureAnnouncementsTable: jest.fn(),
  ensureAnnouncementsTableForInsert: jest.fn(),
  getAnnouncementAuthorById: jest.fn(),
  getAnnouncementAuthorByIdForDelete: jest.fn(),
  listAnnouncements: jest.fn(),
  notifyAllActiveUsersOfAnnouncement: jest.fn(),
  notifyAnnouncementGroupMembers: jest.fn(),
  updateAnnouncementFields: jest.fn(),
}));

import {
  archiveAnnouncementById,
  createAnnouncement,
  ensureAnnouncementsTable,
  ensureAnnouncementsTableForInsert,
  getAnnouncementAuthorById,
  getAnnouncementAuthorByIdForDelete,
  listAnnouncements,
  notifyAllActiveUsersOfAnnouncement,
  notifyAnnouncementGroupMembers,
  updateAnnouncementFields,
} from "@/models/communications";
import {
  listAnnouncementFeed,
  publishAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
} from "@/services/communications/announcements";

const author = { cid: "4", name: "Ada", email: "ada@example.com", role: "staff" };
const stranger = { cid: "9", role: "staff" };
const superAdmin = { cid: "1", role: "super_admin" };

beforeEach(() => {
  jest.resetAllMocks();
  ensureAnnouncementsTable.mockResolvedValue(undefined);
  ensureAnnouncementsTableForInsert.mockResolvedValue(undefined);
  listAnnouncements.mockResolvedValue({ rows: [] });
  createAnnouncement.mockResolvedValue({ rows: [{ id: 42 }] });
  notifyAllActiveUsersOfAnnouncement.mockResolvedValue(undefined);
  notifyAnnouncementGroupMembers.mockResolvedValue(undefined);
  getAnnouncementAuthorById.mockResolvedValue({ rows: [{ author_id: "4" }] });
  getAnnouncementAuthorByIdForDelete.mockResolvedValue({ rows: [{ author_id: "4" }] });
  updateAnnouncementFields.mockResolvedValue(undefined);
  archiveAnnouncementById.mockResolvedValue(undefined);
});

describe("listAnnouncementFeed", () => {
  it("returns the rows and flags a super_admin", async () => {
    listAnnouncements.mockResolvedValue({ rows: [{ id: 1 }] });
    const rows = await listAnnouncementFeed({
      session: superAdmin,
      showAll: true,
      targetType: "group",
      targetId: "g1",
    });
    expect(rows).toEqual([{ id: 1 }]);
    expect(listAnnouncements).toHaveBeenCalledWith({
      showAll: true,
      isSuperAdmin: true,
      targetType: "group",
      targetId: "g1",
    });
  });

  it("does not flag a non-super_admin", async () => {
    await listAnnouncementFeed({ session: author, showAll: false });
    expect(listAnnouncements).toHaveBeenCalledWith(
      expect.objectContaining({ isSuperAdmin: false }),
    );
  });

  it("still lists when the table-creation step fails", async () => {
    ensureAnnouncementsTable.mockRejectedValue(new Error("boom"));
    listAnnouncements.mockResolvedValue({ rows: [{ id: 7 }] });
    await expect(listAnnouncementFeed({ session: author })).resolves.toEqual([{ id: 7 }]);
  });
});

describe("publishAnnouncement", () => {
  it("takes the author from the session, never from the body", async () => {
    await publishAnnouncement({
      session: author,
      payload: {
        title: "T",
        body: "B",
        author_id: "999",
        author_name: "Mallory",
        target_type: "all",
        is_pinned: true,
      },
    });
    expect(createAnnouncement).toHaveBeenCalledWith({
      title: "T",
      body: "B",
      authorId: "4",
      authorName: "Ada",
      targetType: "all",
      targetId: undefined,
      isPinned: true,
    });
  });

  it("falls back from name to email to the session id", async () => {
    const payload = { title: "T", body: "B" };
    await publishAnnouncement({ session: { cid: "4", email: "a@x.io" }, payload });
    expect(createAnnouncement).toHaveBeenLastCalledWith(
      expect.objectContaining({ authorName: "a@x.io" }),
    );
    await publishAnnouncement({ session: { cid: "4" }, payload });
    expect(createAnnouncement).toHaveBeenLastCalledWith(
      expect.objectContaining({ authorName: "4" }),
    );
  });

  it("returns the new id, or undefined when no row comes back", async () => {
    const payload = { title: "T", body: "B" };
    await expect(publishAnnouncement({ session: author, payload })).resolves.toEqual({ id: 42 });
    createAnnouncement.mockResolvedValue({ rows: [] });
    const result = await publishAnnouncement({ session: author, payload });
    expect(result.id).toBeUndefined();
  });

  it("notifies the whole organisation for target_type 'all'", async () => {
    await publishAnnouncement({
      session: author,
      payload: { title: "T", body: "B", target_type: "all", target_id: "x" },
    });
    expect(notifyAllActiveUsersOfAnnouncement).toHaveBeenCalledWith("New Announcement: T", "B");
    expect(notifyAnnouncementGroupMembers).not.toHaveBeenCalled();
  });

  it("notifies the whole organisation when the target is missing or incomplete", async () => {
    await publishAnnouncement({ session: author, payload: { title: "T", body: "B" } });
    await publishAnnouncement({
      session: author,
      payload: { title: "T", body: "B", target_type: "group" },
    });
    expect(notifyAllActiveUsersOfAnnouncement).toHaveBeenCalledTimes(2);
    expect(notifyAnnouncementGroupMembers).not.toHaveBeenCalled();
  });

  it("notifies only the group members for a group target", async () => {
    await publishAnnouncement({
      session: author,
      payload: { title: "T", body: "B", target_type: "group", target_id: "g1" },
    });
    expect(notifyAnnouncementGroupMembers).toHaveBeenCalledWith("New Announcement: T", "B", "g1");
    expect(notifyAllActiveUsersOfAnnouncement).not.toHaveBeenCalled();
  });

  it("sends no notification for any other target type", async () => {
    await publishAnnouncement({
      session: author,
      payload: { title: "T", body: "B", target_type: "program", target_id: "p1" },
    });
    expect(notifyAllActiveUsersOfAnnouncement).not.toHaveBeenCalled();
    expect(notifyAnnouncementGroupMembers).not.toHaveBeenCalled();
  });

  it("truncates a notification body longer than 200 characters to 200", async () => {
    await publishAnnouncement({ session: author, payload: { title: "T", body: "x".repeat(250) } });
    expect(notifyAllActiveUsersOfAnnouncement).toHaveBeenLastCalledWith(
      "New Announcement: T",
      "x".repeat(197) + "...",
    );
    await publishAnnouncement({ session: author, payload: { title: "T", body: "y".repeat(200) } });
    expect(notifyAllActiveUsersOfAnnouncement).toHaveBeenLastCalledWith(
      "New Announcement: T",
      "y".repeat(200),
    );
  });

  it("still publishes when the notification fan-out fails", async () => {
    notifyAllActiveUsersOfAnnouncement.mockRejectedValue(new Error("boom"));
    await expect(
      publishAnnouncement({ session: author, payload: { title: "T", body: "B" } }),
    ).resolves.toEqual({ id: 42 });
  });

  it("still publishes when the table-creation step fails", async () => {
    ensureAnnouncementsTableForInsert.mockRejectedValue(new Error("boom"));
    await publishAnnouncement({ session: author, payload: { title: "T", body: "B" } });
    expect(createAnnouncement).toHaveBeenCalledTimes(1);
  });
});

describe("updateAnnouncement", () => {
  it("answers 404 when the announcement does not exist", async () => {
    getAnnouncementAuthorById.mockResolvedValue({ rows: [] });
    await expect(
      updateAnnouncement({ session: author, payload: { id: 5, title: "N" } }),
    ).resolves.toEqual({ denied: { error: "Announcement not found.", status: 404 } });
    expect(updateAnnouncementFields).not.toHaveBeenCalled();
  });

  it("answers 403 to someone who is neither the author nor super_admin", async () => {
    await expect(
      updateAnnouncement({ session: stranger, payload: { id: 5, title: "N" } }),
    ).resolves.toEqual({
      denied: {
        error: "Only the author or super_admin can edit this announcement.",
        status: 403,
      },
    });
    expect(updateAnnouncementFields).not.toHaveBeenCalled();
  });

  it("lets the author edit and forwards the fields", async () => {
    await expect(
      updateAnnouncement({ session: author, payload: { id: 5, title: "N" } }),
    ).resolves.toEqual({ ok: true });
    expect(updateAnnouncementFields).toHaveBeenCalledWith({
      id: 5,
      is_archived: undefined,
      is_pinned: undefined,
      title: "N",
      body: undefined,
    });
  });

  it("lets a super_admin edit someone else's announcement", async () => {
    await expect(
      updateAnnouncement({ session: superAdmin, payload: { id: 5, body: "N" } }),
    ).resolves.toEqual({ ok: true });
  });

  it("answers 400 when there is nothing to update", async () => {
    await expect(
      updateAnnouncement({ session: author, payload: { id: 5 } }),
    ).resolves.toEqual({ denied: { error: "No fields to update.", status: 400 } });
    expect(updateAnnouncementFields).not.toHaveBeenCalled();
  });

  it("checks ownership before the empty-update check", async () => {
    const outcome = await updateAnnouncement({ session: stranger, payload: { id: 5 } });
    expect(outcome.denied.status).toBe(403);
  });

  it("counts is_archived: false as a field to update", async () => {
    await expect(
      updateAnnouncement({ session: author, payload: { id: 5, is_archived: false } }),
    ).resolves.toEqual({ ok: true });
    expect(updateAnnouncementFields).toHaveBeenCalledTimes(1);
  });
});

describe("archiveAnnouncement", () => {
  it("answers 404 using the delete lookup", async () => {
    getAnnouncementAuthorByIdForDelete.mockResolvedValue({ rows: [] });
    await expect(archiveAnnouncement({ session: author, id: "5" })).resolves.toEqual({
      denied: { error: "Announcement not found.", status: 404 },
    });
    expect(getAnnouncementAuthorById).not.toHaveBeenCalled();
    expect(archiveAnnouncementById).not.toHaveBeenCalled();
  });

  it("answers 403 to someone who is neither the author nor super_admin", async () => {
    await expect(archiveAnnouncement({ session: stranger, id: "5" })).resolves.toEqual({
      denied: {
        error: "Only the author or super_admin can archive this announcement.",
        status: 403,
      },
    });
    expect(archiveAnnouncementById).not.toHaveBeenCalled();
  });

  it("lets the author archive", async () => {
    await expect(archiveAnnouncement({ session: author, id: "5" })).resolves.toEqual({ ok: true });
    expect(archiveAnnouncementById).toHaveBeenCalledWith("5");
  });

  it("lets a super_admin archive someone else's announcement", async () => {
    await expect(archiveAnnouncement({ session: superAdmin, id: "5" })).resolves.toEqual({ ok: true });
    expect(archiveAnnouncementById).toHaveBeenCalledWith("5");
  });
});
