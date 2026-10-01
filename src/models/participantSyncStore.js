/**
 * Contacts — v2_participants sync (REPOSITORY layer).
 *
 * The two statements that keep a contact's v2_participants row Active: the
 * keyed upsert, and the plain status update used when the table has no
 * (email, program_id) unique constraint. The fallback POLICY lives in
 * `@/services/contacts/participantSync`.
 *
 * SQL is byte-identical to what used to sit inline in `models/groups.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** Upsert a participant as Active, keyed on the (email, program_id) constraint. */
export function upsertParticipantActive(programId, name, email, phone) {
  return db.execute({
    sql: `INSERT INTO v2_participants (program_id, name, email, phone, status)
          VALUES (?, ?, ?, ?, 'Active')
          ON CONFLICT(email, program_id) DO UPDATE SET status = 'Active'`,
    args: [programId, name, email, phone],
  });
}

/** Plain Active status update — the no-constraint fallback. */
export function setParticipantActiveByEmail(programId, email) {
  return db.execute({
    sql: "UPDATE v2_participants SET status = 'Active' WHERE email = ? AND program_id = ?",
    args: [email, programId],
  });
}
