/**
 * ANNOUNCEMENTS — the feed / publish / moderate use-cases.
 *
 * An announcement's author is always the session, never the request body, and
 * only the author or a Super Admin may edit or archive it. Publishing fans out
 * notifications (org-wide, or to a group) and is non-blocking.
 *
 * Reads and writes go through `@/models/communications`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

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

/** The active / all feed for the requested audience. */
export async function listAnnouncementFeed({ session, showAll, targetType, targetId }) {
  // Ensure table exists (safe migration)
  try {
    await ensureAnnouncementsTable();
  } catch (_) {}

  const result = await listAnnouncements({
    showAll,
    isSuperAdmin: session.role === "super_admin",
    targetType,
    targetId,
  });
  return result.rows;
}

/** Publish an announcement as the session; returns its id. */
export async function publishAnnouncement({ session, payload }) {
  const { title, body, target_type, target_id, is_pinned } = payload || {};

  // Ensure table exists (safe migration)
  try {
    await ensureAnnouncementsTableForInsert();
  } catch (_) {}

  // The author is WHO IS SIGNED IN, never what the request claims. Someone who
  // holds the capability to post must not be able to attribute the post to
  // somebody else, so `author_id`/`author_name` in the body are not read at all.
  const effectiveAuthorId = session.cid;
  const effectiveAuthorName = session.name || session.email || effectiveAuthorId;

  const insertResult = await createAnnouncement({
    title,
    body,
    authorId: effectiveAuthorId,
    authorName: effectiveAuthorName,
    targetType: target_type,
    targetId: target_id,
    isPinned: is_pinned,
  });

  const newId = insertResult.rows[0]?.id;

  // Send notifications to targeted users (non-blocking)
  try {
    const notificationTitle = `New Announcement: ${title}`;
    const notificationBody = body.length > 200 ? body.substring(0, 197) + "..." : body;

    if (target_type === "all" || !target_type || !target_id) {
      // Organization-wide: notify all users
      await notifyAllActiveUsersOfAnnouncement(notificationTitle, notificationBody);
    } else if (target_type === "group") {
      // Target by group: notify all users in that group
      await notifyAnnouncementGroupMembers(notificationTitle, notificationBody, target_id);
    }
  } catch (_) {
    // Notifications are non-blocking
  }

  return { id: newId };
}

/** Edit an announcement (author or Super Admin only). */
export async function updateAnnouncement({ session, payload }) {
  const { id, is_archived, is_pinned, title, body } = payload || {};

  // Verify ownership or super_admin
  const existing = await getAnnouncementAuthorById(id);
  if (existing.rows.length === 0) {
    return { denied: { error: "Announcement not found.", status: 404 } };
  }
  if (existing.rows[0].author_id !== session.cid && session.role !== "super_admin") {
    return {
      denied: {
        error: "Only the author or super_admin can edit this announcement.",
        status: 403,
      },
    };
  }

  if (
    is_archived === undefined &&
    is_pinned === undefined &&
    title === undefined &&
    body === undefined
  ) {
    return { denied: { error: "No fields to update.", status: 400 } };
  }

  await updateAnnouncementFields({ id, is_archived, is_pinned, title, body });
  return { ok: true };
}

/** Soft-archive an announcement (author or Super Admin only). */
export async function archiveAnnouncement({ session, id }) {
  // Verify ownership or super_admin
  const existing = await getAnnouncementAuthorByIdForDelete(id);
  if (existing.rows.length === 0) {
    return { denied: { error: "Announcement not found.", status: 404 } };
  }
  if (existing.rows[0].author_id !== session.cid && session.role !== "super_admin") {
    return {
      denied: {
        error: "Only the author or super_admin can archive this announcement.",
        status: 403,
      },
    };
  }

  // Soft archive
  await archiveAnnouncementById(id);
  return { ok: true };
}
