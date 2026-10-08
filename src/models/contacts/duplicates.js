import db from "@/lib/db";

/**
 * Contact duplicate & merge store — the duplicate flag queue, the merge
 * reassignments and the merge-preview counts.
 *
 * Split out of `src/models/contacts.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/contacts` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── duplicate flags ───────────────────────────────────────────────────────────

/** Flag a phone-based duplicate pair (idempotent regardless of pair order). */
export async function createDuplicatePhoneFlag(cidA, cidB) {
  return db.execute({
    sql: `INSERT INTO contact_duplicate_flags (contact_cid_a, contact_cid_b, match_reason, confidence)
                      VALUES (?, ?, 'same_phone', 0.85)
                      ON CONFLICT ((LEAST(contact_cid_a, contact_cid_b)), (GREATEST(contact_cid_a, contact_cid_b))) DO NOTHING`,
    args: [cidA, cidB],
  });
}

/** Pending duplicate flags joined with both contact identities. */
export async function getPendingDuplicateFlags(limit) {
  return db.execute({
    sql: `SELECT df.*,
              ca.name AS contact_a_name, ca.email AS contact_a_email,
              cb.name AS contact_b_name, cb.email AS contact_b_email
            FROM contact_duplicate_flags df
            LEFT JOIN contacts ca ON ca.cid = df.contact_cid_a
            LEFT JOIN contacts cb ON cb.cid = df.contact_cid_b
            WHERE df.status = 'pending'
              AND (ca.deleted IS NULL OR ca.deleted = 0)
              AND (cb.deleted IS NULL OR cb.deleted = 0)
            ORDER BY df.created_at DESC
            LIMIT ?`,
    args: [limit],
  });
}

/** Dismiss a pending duplicate flag (never touches merged flags). */
export async function dismissDuplicateFlag(id, reviewedBy) {
  return db.execute({
    sql: `UPDATE contact_duplicate_flags
            SET status = 'dismissed', reviewed_by = ?, reviewed_at = NOW()
            WHERE id = ? AND status = 'pending'`,
    args: [reviewedBy, id],
  });
}

// ── merge — reassignments ────────────────────────────────────────────────────

/** Reassign all venture_members rows to the surviving contact. */
export async function reassignContactVentures(survivorCid, duplicateCid) {
  return db.execute({
    sql: "UPDATE venture_members SET contact_id = ? WHERE contact_id = ?",
    args: [survivorCid, duplicateCid],
  });
}

/** Reassign all timeline events to the surviving contact. */
export async function reassignContactTimelineEvents(survivorCid, duplicateCid) {
  return db.execute({
    sql: "UPDATE contact_timeline SET contact_cid = ? WHERE contact_cid = ?",
    args: [survivorCid, duplicateCid],
  });
}

/** Write the contact_merged event into the survivor's timeline. */
export async function createContactMergeTimelineEvent(
  survivorCid,
  duplicateCid,
  actorId,
  counts,
) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
            VALUES (?, 'contact_merged', ?, 'crm', ?, ?::jsonb)`,
    args: [
      survivorCid,
      `Merged from ${duplicateCid}`,
      actorId,
      JSON.stringify({ merged_from: duplicateCid, counts }),
    ],
  });
}

/** Soft-delete the duplicate contact and free its email (merge flow). */
export async function softDeleteDuplicateContact(deletedBy, cid) {
  return db.execute({
    sql: `UPDATE contacts
            SET deleted_at = NOW(), deleted_by = ?, deleted = 1,
                email = '__deleted_' || cid || '__' || email
            WHERE cid = ?`,
    args: [deletedBy, cid],
  });
}

/** Mark duplicate flags resolved as merged for both pair orderings. */
export async function resolveDuplicateFlagsForMerge(
  survivorCid,
  duplicateCid,
  reviewedBy,
) {
  return db.execute({
    sql: `UPDATE contact_duplicate_flags SET status = 'merged', reviewed_by = ?, reviewed_at = NOW()
            WHERE (contact_cid_a = ? AND contact_cid_b = ?) OR (contact_cid_a = ? AND contact_cid_b = ?)`,
    args: [reviewedBy, survivorCid, duplicateCid, duplicateCid, survivorCid],
  });
}

// ── merge preview — counts ────────────────────────────────────────────────────

/** Merge preview — count of participant_programs rows that would move. */
export async function countMergeParticipantPrograms(cid) {
  return db.execute({
    sql: "SELECT COUNT(*)::int AS c FROM participant_programs WHERE participant_id = ?",
    args: [cid],
  });
}

/** Merge preview — count of active venture_memberships that would move. */
export async function countMergeVentureMemberships(cid) {
  return db.execute({
    sql: "SELECT COUNT(*)::int AS c FROM venture_members WHERE contact_id = ? AND removed_at IS NULL",
    args: [cid],
  });
}

/** Merge preview — count of timeline events that would move. */
export async function countMergeTimelineEvents(cid) {
  return db.execute({
    sql: "SELECT COUNT(*)::int AS c FROM contact_timeline WHERE contact_cid = ?",
    args: [cid],
  });
}
