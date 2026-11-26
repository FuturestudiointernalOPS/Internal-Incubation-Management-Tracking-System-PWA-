import db from "@/lib/db";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";

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
export async function listActiveStaffAssignmentsByCode(ventureRef, cid) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "SELECT id, scope_type, scope_ref_type, scope_ref_id, responsibility_code FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' ORDER BY id DESC",
    args: [ventureId, cid],
  });
}

/** A Venture's live notes, optionally narrowed to a scope reference. */
export async function listVentureNotes({ ventureCode: ventureRef, scopeType, scopeId }) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  let sql = "SELECT * FROM venture_notes WHERE venture_id = ? AND is_archived = FALSE";
  const args = [ventureId];
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

/** Which kinds of note the API may store. Anything else is a milestone note. */
export const NOTE_KINDS = ["milestone", "activity"];

/**
 * Insert an internal note (with optional attachments), returning the new id.
 *
 * `noteKind` says WHAT the note is, not where it sits: every note is filed on a
 * milestone (the route refuses any other scope), so only this column can tell an
 * activity report from a note written on the milestone itself.
 */
export async function insertVentureNote({ ventureCode: ventureRef, authorCid, authorName, title, body, scopeRefType, scopeRefId, attachments, noteKind }) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `INSERT INTO venture_notes (venture_id, author_cid, author_name, title, body, scope_ref_type, scope_ref_id, note_kind${attachments ? ", attachments" : ""})
            VALUES (?,?,?,?,?,?,?,?${attachments ? ", ?::jsonb" : ""}) RETURNING id`,
    args: attachments
      ? [ventureId, authorCid, authorName, title, body, scopeRefType, scopeRefId, noteKind || "milestone", JSON.stringify(attachments)]
      : [ventureId, authorCid, authorName, title, body, scopeRefType, scopeRefId, noteKind || "milestone"],
  });
}

/** One note of a Venture, by id. */
export async function getVentureNote(noteId, ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({ sql: "SELECT * FROM venture_notes WHERE id = ? AND venture_id = ?", args: [noteId, ventureId] });
}

/** Soft-archive one note. */
export async function archiveVentureNote(noteId) {
  return db.execute({ sql: "UPDATE venture_notes SET is_archived = TRUE, updated_at = NOW() WHERE id = ?", args: [noteId] });
}
