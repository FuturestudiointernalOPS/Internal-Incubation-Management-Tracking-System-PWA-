import db from "@/lib/db";

/** Reuse investor_notes: venture notes do not require an invested pipeline. */
export function listPrivateVentureNotes(investorId, ventureId) {
  return db.execute({ sql: `SELECT id, content, created_at FROM investor_notes
    WHERE investor_id = ? AND venture_id = ? AND note_type = 'private'
    ORDER BY created_at DESC`, args: [investorId, ventureId] });
}

export function insertPrivateVentureNote(investorId, ventureId, content) {
  return db.execute({ sql: `INSERT INTO investor_notes (investor_id, venture_id, note_type, content)
    VALUES (?, ?, 'private', ?) RETURNING id, content, created_at`, args: [investorId, ventureId, content] });
}
