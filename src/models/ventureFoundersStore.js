/**
 * Venture founders / co-founders — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/founders`: the founder rows and
 * their role/ownership/suspension columns, the invitation writes, the
 * accepted-founders counts that guard removal, and the append-only ownership
 * history.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Reads ────────────────────────────────────────────────────────────────────

/** The managing founder row (id, owner flag, role) for an email in a Venture. */
export function selectFounderForManage(ventureId, email) {
  return db.execute({
    sql: "SELECT id, is_owner, role FROM venture_founders WHERE venture_id = ? AND LOWER(email) = LOWER(?)",
    args: [ventureId, email],
  });
}

/** Every founder of a Venture, owner first then creation order. */
export function selectFoundersForVenture(ventureId) {
  return db.execute({
    sql: `SELECT id, venture_id, email, name, phone, title, role, is_owner, status,
                 invitation_token, invitation_sent_at, invitation_accepted_at,
                 invitation_expires_at, suspended_at, suspended_by,
                 created_at, updated_at
          FROM venture_founders
          WHERE venture_id = ?
          ORDER BY is_owner DESC, created_at ASC`,
    args: [ventureId],
  });
}

/** One founder row by numeric id. */
export function selectFounderById(id) {
  return db.execute({
    sql: `SELECT * FROM venture_founders WHERE id = ?`,
    args: [id],
  });
}

/** One founder row by email (case-insensitive). */
export function selectFounderByEmail(email) {
  return db.execute({
    sql: `SELECT * FROM venture_founders WHERE LOWER(email) = LOWER(?)`,
    args: [email],
  });
}

/** One founder row by contact id (CID). */
export function selectFounderByContactId(contactId) {
  return db.execute({
    sql: `SELECT * FROM venture_founders WHERE contact_id = ?`,
    args: [contactId],
  });
}

/** The id + status of an email's founder row within a Venture. */
export function selectFounderIdAndStatusByEmail(ventureId, email) {
  return db.execute({
    sql: "SELECT id, status FROM venture_founders WHERE venture_id = ? AND LOWER(email) = LOWER(?)",
    args: [ventureId, email],
  });
}

/** The id of an email's founder row within a Venture. */
export function selectFounderIdByEmail(ventureId, email) {
  return db.execute({
    sql: "SELECT id FROM venture_founders WHERE venture_id = ? AND LOWER(email) = LOWER(?)",
    args: [ventureId, email],
  });
}

/** How many founders have accepted within a Venture. */
export function countAcceptedFounders(ventureId) {
  return db.execute({
    sql: "SELECT COUNT(*) as cnt FROM venture_founders WHERE venture_id = ? AND status = 'accepted'",
    args: [ventureId],
  });
}

/** How many OTHER founders (than `founderId`) have accepted within a Venture. */
export function countOtherAcceptedFounders(ventureId, founderId) {
  return db.execute({
    sql: "SELECT COUNT(*) as cnt FROM venture_founders WHERE venture_id = ? AND id != ? AND status = 'accepted'",
    args: [ventureId, founderId],
  });
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Re-arm an existing pending founder's invitation. */
export function resendFounderInvitation(founderId, token, expiresAt, role, name) {
  return db.execute({
    sql: `UPDATE venture_founders
          SET invitation_token = ?, invitation_sent_at = NOW(), invitation_expires_at = ?,
              role = ?, name = ?, status = 'pending', updated_at = NOW()
          WHERE id = ?`,
    args: [token, expiresAt, role, name, founderId],
  });
}

/** Create a pending founder invitation row. */
export function insertFounderInvitation(ventureId, email, name, role, token, expiresAt) {
  return db.execute({
    sql: `INSERT INTO venture_founders (venture_id, email, name, role, invitation_token, invitation_sent_at, invitation_expires_at, status)
          VALUES (?, ?, ?, ?, ?, NOW(), ?, 'pending')`,
    args: [ventureId, email, name, role, token, expiresAt],
  });
}

/** Patch a subset of a founder's columns (SET clauses built by the service). */
export function updateFounderColumns(sets, args) {
  return db.execute({
    sql: `UPDATE venture_founders SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Delete a founder row within its Venture. */
export function deleteFounderRow(founderId, ventureId) {
  return db.execute({
    sql: "DELETE FROM venture_founders WHERE id = ? AND venture_id = ?",
    args: [founderId, ventureId],
  });
}

/** Append an ownership-transfer record. */
export function insertOwnershipHistory({
  ventureId, previousOwnerId, previousOwnerEmail, previousOwnerName,
  newOwnerId, newOwnerEmail, newOwnerName, transferredById, transferredByEmail,
}) {
  return db.execute({
    sql: `INSERT INTO ownership_history (venture_id, previous_owner_id, previous_owner_email, previous_owner_name,
          new_owner_id, new_owner_email, new_owner_name, transferred_by_id, transferred_by_email)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      ventureId,
      previousOwnerId,
      previousOwnerEmail,
      previousOwnerName,
      newOwnerId,
      newOwnerEmail,
      newOwnerName,
      transferredById,
      transferredByEmail,
    ],
  });
}

/** Drop the owner flag from the outgoing owner. */
export function clearFounderOwner(ownerId) {
  return db.execute({
    sql: "UPDATE venture_founders SET is_owner = FALSE, updated_at = NOW() WHERE id = ?",
    args: [ownerId],
  });
}

/** Set the owner flag on the incoming owner. */
export function setFounderOwner(ownerId) {
  return db.execute({
    sql: "UPDATE venture_founders SET is_owner = TRUE, role = 'founder', updated_at = NOW() WHERE id = ?",
    args: [ownerId],
  });
}

/** Stamp a founder as suspended. */
export function suspendFounderRow(suspendedBy, founderId) {
  return db.execute({
    sql: "UPDATE venture_founders SET suspended_at = NOW(), suspended_by = ?, updated_at = NOW() WHERE id = ?",
    args: [suspendedBy, founderId],
  });
}

/** Clear a founder's suspension. */
export function reactivateFounderRow(founderId) {
  return db.execute({
    sql: "UPDATE venture_founders SET suspended_at = NULL, suspended_by = NULL, updated_at = NOW() WHERE id = ?",
    args: [founderId],
  });
}
