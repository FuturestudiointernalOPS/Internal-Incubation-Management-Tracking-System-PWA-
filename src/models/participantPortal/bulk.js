import db from "@/lib/db";

/**
 * Bulk participant programs model — data access for POST /api/participant-programs/bulk
 */

export async function getBulkProgramById(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

export async function checkBulkFacilitatorConflicts(programId, participantIds) {
  const participantCids = participantIds || [];
  if (participantCids.length === 0) return { rows: [] };
  const placeholders = participantCids.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT staff_id FROM v2_program_staff
          WHERE (staff_id IN (${placeholders})
                 OR LOWER(TRIM(staff_id)) IN (${placeholders}))
            AND CAST(program_id AS TEXT) = ?
            AND role = 'facilitator'`,
    args: [
      ...participantCids,
      ...participantCids.map((cid) => String(cid).toLowerCase()),
      String(programId),
    ],
  });
}

export async function insertBulkParticipantPrograms(participantIds, programId) {
  const participantCids = participantIds || [];
  if (participantCids.length === 0) return { rows: [], rowsAffected: 0 };
  const values = participantCids.map(() => "(?, ?)").join(", ");
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
              VALUES ${values}
              ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: participantCids.flatMap((cid) => [cid, programId]),
  });
}

export async function deleteBulkParticipantPrograms(participantIds, programId) {
  const participantCids = participantIds || [];
  if (participantCids.length === 0) return { rows: [], rowsAffected: 0 };
  const placeholders = participantCids.map(() => "?").join(", ");
  return db.execute({
    sql: `DELETE FROM participant_programs
          WHERE program_id = ? AND participant_id IN (${placeholders})`,
    args: [programId, ...participantCids],
  });
}

export async function insertBulkAudits(
  participantIds,
  programId,
  auditAction,
  performedBy,
) {
  const participantCids = participantIds || [];
  if (participantCids.length === 0) return { rows: [], rowsAffected: 0 };
  const values = participantCids.map(() => "(?, ?, ?, ?)").join(", ");
  return db.execute({
    sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
              VALUES ${values}`,
    args: participantCids.flatMap((cid) => [cid, programId, auditAction, performedBy]),
  });
}