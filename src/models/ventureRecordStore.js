/**
 * Venture core record (read / update / lead change) — statements
 * (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/record`: the Venture row and its
 * related reads (founders, members, activity, history, progress), the dynamic
 * Venture UPDATE and the lead-change writes.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";
import { listVentureMembers } from "@/models/ventureMembers";

// ── Reads ────────────────────────────────────────────────────────────────────

/** The VNT code of a Venture from its internal id given as text. */
export function selectVentureCodeByInternalId(ventureId) {
  return db.execute({ sql: "SELECT venture_id FROM ventures WHERE id::text = ?", args: [ventureId] });
}

/** One Venture row by its business key. */
export function selectVentureByBusinessKey(key) {
  return db.execute({ sql: "SELECT * FROM ventures WHERE venture_id = ?", args: [key] });
}

/** A Venture's founders, oldest first. */
export function selectFoundersByVenture(key) {
  return db.execute({ sql: "SELECT * FROM venture_founders WHERE venture_id = ? ORDER BY created_at ASC", args: [key] });
}

/** A Venture's live members (delegates to the members model). */
export function selectVentureMembersForRecord(key) {
  return listVentureMembers(key);
}

/** A Venture's recent activity with the actor resolved to a person. */
export function selectVentureActivityForJournal(key) {
  return db.execute({
    sql: `SELECT al.*, COALESCE(ca.name, cb.name) AS actor_resolved_name
          FROM venture_activity_log al
          LEFT JOIN contacts ca ON ca.cid = al.actor_cid
          LEFT JOIN contacts cb ON cb.cid = al.actor_name
          WHERE al.venture_id = ?
          ORDER BY al.created_at DESC LIMIT 20`,
    args: [key],
  });
}

/** A Venture's history, oldest first. */
export function selectVentureHistory(key) {
  return db.execute({ sql: "SELECT * FROM venture_history WHERE venture_id = ? ORDER BY created_at ASC", args: [key] });
}

/** A Venture's startup-profile progress row. */
export function selectVentureProfileProgress(key) {
  return db.execute({ sql: "SELECT * FROM startup_profile_progress WHERE venture_id = ?", args: [key] });
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Apply a computed SET list to a Venture by business key. */
export function updateVentureColumns(setClauses, args) {
  return db.execute({ sql: `UPDATE ventures SET ${setClauses.join(", ")} WHERE venture_id = ?`, args });
}

/** One live Venture member row. */
export function selectActiveVentureMember(memberId, ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_members WHERE id = ? AND venture_id = ? AND removed_at IS NULL",
    args: [memberId, ventureId],
  });
}

/** The contact id of the current lead/owner of a Venture, if any. */
export function selectCurrentVentureLead(ventureId) {
  return db.execute({
    sql: "SELECT contact_id FROM venture_members WHERE venture_id = ? AND (lead_founder = TRUE OR is_owner = TRUE) AND removed_at IS NULL ORDER BY id DESC LIMIT 1",
    args: [ventureId],
  });
}

/** Clear the current lead/owner flags on a Venture. */
export function clearVentureLead(ventureId) {
  return db.execute({
    sql: "UPDATE venture_members SET lead_founder = FALSE, is_owner = FALSE WHERE venture_id = ? AND (lead_founder = TRUE OR is_owner = TRUE)",
    args: [ventureId],
  });
}

/** Promote a member to lead founder / owner. */
export function promoteVentureMember(memberId) {
  return db.execute({
    sql: "UPDATE venture_members SET lead_founder = TRUE, is_owner = TRUE, member_type = 'founder', role = 'founder' WHERE id = ?",
    args: [memberId],
  });
}

/** Append a lead-change ownership-history row. */
export function insertLeadOwnershipHistory(ventureId, newOwnerId, newOwnerName, actorCid) {
  return db.execute({
    sql: `INSERT INTO ownership_history (venture_id, previous_owner_id, previous_owner_email, previous_owner_name,
          new_owner_id, new_owner_email, new_owner_name, transferred_by_id, transferred_by_email)
          VALUES (?, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
    args: [ventureId, newOwnerId, "", newOwnerName, actorCid, ""],
  });
}
