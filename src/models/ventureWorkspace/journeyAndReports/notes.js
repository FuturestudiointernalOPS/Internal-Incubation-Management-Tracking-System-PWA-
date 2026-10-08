import db from "@/lib/db";

// ── /api/ventures/[id]/notes ─────────────────────────────────────────────────

/** The canonical code behind a Venture db id (notes id resolver). */
export async function getVentureCodeByDbId(id) {
  return db.execute({ sql: "SELECT venture_id FROM ventures WHERE id::text = ?", args: [id] });
}

/** Whether a responsibility may view the internal_notes area. */
export async function getInternalNotesViewPermission(responsibilityCode) {
  return db.execute({
    sql: "SELECT allowed FROM venture_permission_matrix WHERE responsibility_code = ? AND area = 'internal_notes' AND action = 'view'",
    args: [responsibilityCode],
  });
}

/** A contact's active assignment rows on a Venture, by id desc. */
export async function listActiveStaffAssignmentsByCode(ventureCode, cid) {
  return db.execute({
    sql: "SELECT id, scope_type, scope_ref_type, scope_ref_id, responsibility_code FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' ORDER BY id DESC",
    args: [ventureCode, cid],
  });
}

/** A Venture's live notes, optionally narrowed to a scope reference. */
export function listVentureNotes({ ventureCode, scopeType, scopeId }) {
  let sql = "SELECT * FROM venture_notes WHERE venture_id = ? AND is_archived = FALSE";
  const args = [ventureCode];
  if (scopeType) {
    sql += " AND scope_ref_type = ?";
    args.push(String(scopeType));
  }
  if (scopeId) {
    sql += " AND scope_ref_id = ?";
    args.push(String(scopeId));
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/** Insert an internal note (with optional attachments), returning the new id. */
export function insertVentureNote({ ventureCode, authorCid, authorName, title, body, scopeRefType, scopeRefId, attachments }) {
  return db.execute({
    sql: `INSERT INTO venture_notes (venture_id, author_cid, author_name, title, body, scope_ref_type, scope_ref_id${attachments ? ", attachments" : ""})
            VALUES (?,?,?,?,?,?,?${attachments ? ", ?::jsonb" : ""}) RETURNING id`,
    args: attachments
      ? [ventureCode, authorCid, authorName, title, body, scopeRefType, scopeRefId, JSON.stringify(attachments)]
      : [ventureCode, authorCid, authorName, title, body, scopeRefType, scopeRefId],
  });
}

/** One note of a Venture, by id. */
export async function getVentureNote(noteId, ventureCode) {
  return db.execute({ sql: "SELECT * FROM venture_notes WHERE id = ? AND venture_id = ?", args: [noteId, ventureCode] });
}

/** Soft-archive one note. */
export async function archiveVentureNote(noteId) {
  return db.execute({ sql: "UPDATE venture_notes SET is_archived = TRUE, updated_at = NOW() WHERE id = ?", args: [noteId] });
}
