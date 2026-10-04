import db from "@/lib/db";

/**
 * Venture Journey model — lifecycle and lead (REPOSITORY layer).
 *
 * The pause/resume/archive transitions and the lead-founder change statements
 * behind `/api/ventures/[id]/lifecycle` and `/api/ventures/[id]/lead`. Split
 * verbatim out of `models/ventureJourney.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Venture row (id + VNT code) resolved from a UUID-form id. */
export async function getLifecycleVentureByUuid(id) {
  return db.execute({
    sql: "SELECT id, venture_id FROM ventures WHERE id::text = ?",
    args: [id],
  });
}

/** Venture internal id resolved from the public VNT code (existence check). */
export async function getLifecycleVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Apply a lifecycle transition (pause/resume/archive) to a venture. */
export async function updateVentureLifecycleStatus(status, isArchived, ventureId) {
  return db.execute({
    sql: `UPDATE ventures
            SET status = ?, is_archived = COALESCE(?, is_archived), updated_at = NOW()
            WHERE venture_id = ?`,
    args: [status, isArchived, ventureId],
  });
}

/** Venture VNT code resolved from a UUID-form id. */
export async function getLeadVentureCodeByUuid(id) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE id::text = ?",
    args: [id],
  });
}

/** Lead-founder venture membership for a contact (lead-change guard). */
export async function findLeadFounderMembership(ventureId, contactCid) {
  return db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND (contact_id = ? OR user_cid = ?) AND lead_founder = TRUE AND removed_at IS NULL",
    args: [ventureId, contactCid, contactCid],
  });
}

/** Audit a lead change in venture_activity_log. */
export async function logVentureLeadChanged(ventureId, actorCid, actorName, detailsJson) {
  return db.execute({
    sql: `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details, created_at)
              VALUES (?, 'LEAD_CHANGED', ?, ?, ?::jsonb, NOW())`,
    args: [ventureId, actorCid, actorName, detailsJson],
  });
}
