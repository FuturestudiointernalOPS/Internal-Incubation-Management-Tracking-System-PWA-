import db from "@/lib/db";

/**
 * WHICH PERSON a name in a tracker turned out to be (REPOSITORY layer).
 *
 * The sibling of `ventureAssigneeEmails`: that one stores an ADDRESS against a
 * name, this one stores the IDENTITY. Both are keyed by the name the tracker
 * wrote, because the name is the reference — one decision about "who is Amina"
 * covers every mention of her in that Venture.
 *
 * It exists because a name can stand where no row can hold an identifier: the
 * people SUPPORTING a piece of work are a text field, not a link. So the link
 * lives beside the name rather than on a row.
 *
 * Linking creates NOTHING — no contact, no member, no platform access. It points
 * at a contact that already exists, and the name is never rewritten.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement.
 */

/** Every name this Venture has an identity for, keyed for lookup by display name. */
export function selectAssigneeLinks(ventureId) {
  return db.execute({
    sql: `SELECT id, display_name, contact_cid, updated_at
          FROM venture_assignee_links
          WHERE venture_id::text = ?::text
          ORDER BY LOWER(TRIM(display_name))`,
    args: [String(ventureId)],
  });
}

/**
 * Record (or correct) the person behind one name.
 *
 * Upsert on the lower-cased name: a decision about a name is corrected, never
 * duplicated, however the tracker capitalises it on each row.
 */
export function upsertAssigneeLink({ ventureId, displayName, contactCid, actorCid }) {
  return db.execute({
    sql: `INSERT INTO venture_assignee_links (venture_id, display_name, contact_cid, created_by)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (venture_id, LOWER(TRIM(display_name)))
          DO UPDATE SET contact_cid = EXCLUDED.contact_cid, updated_at = NOW()
          RETURNING id, display_name, contact_cid`,
    args: [
      String(ventureId),
      String(displayName).trim(),
      String(contactCid).trim(),
      actorCid || null,
    ],
  });
}

/** Forget the identity of one name. The name, and every assignment, stay. */
export function deleteAssigneeLink({ ventureId, displayName }) {
  return db.execute({
    sql: `DELETE FROM venture_assignee_links
          WHERE venture_id::text = ?::text AND LOWER(TRIM(display_name)) = LOWER(TRIM(?))`,
    args: [String(ventureId), String(displayName)],
  });
}
