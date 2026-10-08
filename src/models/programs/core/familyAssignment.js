import db from "@/lib/db";

/**
 * Family/segment assignment and participant enrollment — /api/programs.
 */

/**
 * Un-assign every family currently linked to the program except the ones still
 * in assignedSegments (placeholder list derived from the segment count).
 * Used by PUT /api/programs.
 */
export async function unassignFamiliesNotInList(programId, assignedSegments) {
  const placeholders = assignedSegments.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE families SET program_id = NULL WHERE program_id = ? AND id NOT IN (${placeholders})`,
    args: [programId, ...assignedSegments],
  });
}

/** Un-assign all families from a program. Used by PUT /api/programs. */
export async function unassignAllFamilies(programId) {
  return db.execute({
    sql: `UPDATE families SET program_id = NULL WHERE program_id = ?`,
    args: [programId],
  });
}

/** Link one family (by id) to a program. Used by PUT /api/programs. */
export async function assignFamilyToProgram(programId, familyId) {
  return db.execute({
    sql: `UPDATE families SET program_id = ? WHERE id = ?`,
    args: [programId, familyId],
  });
}

/** Family name lookup by id. Used by PUT /api/programs. */
export async function getFamilyNameById(familyId) {
  return db.execute({
    sql: `SELECT name FROM families WHERE id = ?`,
    args: [familyId],
  });
}

/** Contacts whose family group_name matches (case-insensitive). Used by PUT /api/programs. */
export async function getContactsByFamilyName(familyName) {
  return db.execute({
    sql: `SELECT cid, email FROM contacts WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))`,
    args: [familyName],
  });
}

/** Enroll a contact in a program via participant_programs. Used by PUT /api/programs. */
export async function addParticipantProgramMembership(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
                      VALUES (?, ?, 'active', NOW())
                      ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}
