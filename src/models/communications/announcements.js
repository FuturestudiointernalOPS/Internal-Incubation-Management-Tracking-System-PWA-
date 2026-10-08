import db from "@/lib/db";

/**
 * Communications — announcement reads and writes (REPOSITORY layer).
 *
 * Split verbatim out of `models/communications.js` — see docs/LAYER_SPLIT.md.
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Safe migration: ensure v2_announcements exists (GET path). */
export async function ensureAnnouncementsTable() {
  return db.execute(`
        CREATE TABLE IF NOT EXISTS v2_announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL DEFAULT '',
          target_type TEXT NOT NULL DEFAULT 'all',
          target_id TEXT,
          is_pinned BOOLEAN DEFAULT false,
          is_archived BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
}

/**
 * GET /api/announcements — announcement rows for the requested audience:
 * admin sees everything including archived, otherwise active rows (optionally
 * filtered to a specific target audience + global announcements).
 */
export async function listAnnouncements({
  showAll,
  isSuperAdmin,
  targetType,
  targetId,
}) {
  let query;
  let args = [];

  if (showAll && isSuperAdmin) {
    // Admin: return everything including archived
    query =
      "SELECT * FROM v2_announcements ORDER BY is_pinned DESC, created_at DESC";
  } else if (targetType && targetId) {
    // Specific audience + global announcements
    query = `SELECT * FROM v2_announcements
        WHERE is_archived = false
          AND (target_type = 'all' OR (target_type = ? AND target_id = ?))
        ORDER BY is_pinned DESC, created_at DESC`;
    args = [targetType, targetId];
  } else {
    // Return all active announcements (for dashboards)
    query = `SELECT * FROM v2_announcements
        WHERE is_archived = false
        ORDER BY is_pinned DESC, created_at DESC`;
  }

  return db.execute({ sql: query, args });
}

/** Safe migration: ensure v2_announcements exists (POST path). */
export async function ensureAnnouncementsTableForInsert() {
  return db.execute(`
        CREATE TABLE IF NOT EXISTS v2_announcements (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL DEFAULT '',
          target_type TEXT NOT NULL DEFAULT 'all',
          target_id TEXT,
          is_pinned BOOLEAN DEFAULT false,
          is_archived BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
}

/** Create an announcement and return its id. */
export async function createAnnouncement({
  title,
  body,
  authorId,
  authorName,
  targetType,
  targetId,
  isPinned,
}) {
  return db.execute({
    sql: `INSERT INTO v2_announcements (title, body, author_id, author_name, target_type, target_id, is_pinned)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      title,
      body,
      authorId,
      authorName,
      targetType || "all",
      targetId || null,
      isPinned ? true : false,
    ],
  });
}

/** Organization-wide announcement notification for every active user. */
export async function notifyAllActiveUsersOfAnnouncement(title, body) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                SELECT cid, ?, ?, 'announcement', 0, NOW() FROM users WHERE status = 'active'`,
    args: [title, body],
  });
}

/** Announcement notification for all active members of a target group. */
export async function notifyAnnouncementGroupMembers(title, body, groupName) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                SELECT gm.user_id, ?, ?, 'announcement', 0, NOW()
                FROM v2_group_members gm
                INNER JOIN users u ON u.cid = gm.user_id AND u.status = 'active'
                WHERE gm.group_name = ?`,
    args: [title, body, groupName],
  });
}

/** Announcement author_id for ownership checks. */
export async function getAnnouncementAuthorById(id) {
  return db.execute({
    sql: "SELECT author_id FROM v2_announcements WHERE id = ?",
    args: [id],
  });
}

/**
 * PUT /api/announcements — partial update of the editable announcement
 * fields. Only the fields provided (non-undefined) are included; the caller
 * guarantees at least one field is present.
 */
export async function updateAnnouncementFields({ id, is_archived, is_pinned, title, body }) {
  // Build update
  const updates = [];
  const args = [];
  if (is_archived !== undefined) {
    updates.push("is_archived = ?");
    args.push(is_archived);
  }
  if (is_pinned !== undefined) {
    updates.push("is_pinned = ?");
    args.push(is_pinned);
  }
  if (title !== undefined) {
    updates.push("title = ?");
    args.push(title);
  }
  if (body !== undefined) {
    updates.push("body = ?");
    args.push(body);
  }

  updates.push("updated_at = NOW()");
  args.push(id);

  return db.execute({
    sql: `UPDATE v2_announcements SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Announcement author_id for ownership checks (DELETE path). */
export async function getAnnouncementAuthorByIdForDelete(id) {
  return db.execute({
    sql: "SELECT author_id FROM v2_announcements WHERE id = ?",
    args: [id],
  });
}

/** Soft-archive an announcement. */
export async function archiveAnnouncementById(id) {
  return db.execute({
    sql: "UPDATE v2_announcements SET is_archived = true, updated_at = NOW() WHERE id = ?",
    args: [id],
  });
}
