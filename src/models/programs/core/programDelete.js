import db from "@/lib/db";

/** Protected-data count (participants/sessions/submissions/deliverables). Used by DELETE. */
export async function countProtectedProgramData(programId) {
  return db.execute({
    sql: `SELECT
              (SELECT COUNT(*) FROM participant_programs WHERE CAST(program_id AS TEXT) = ?) +
              (SELECT COUNT(*) FROM v2_sessions WHERE CAST(program_id AS TEXT) = ?) +
              (SELECT COUNT(*) FROM v2_submissions WHERE CAST(program_id AS TEXT) = ?) +
              (SELECT COUNT(*) FROM v2_deliverables WHERE CAST(program_id AS TEXT) = ?)
            AS protected_count`,
    args: [programId, programId, programId, programId],
  });
}

/** Permanent delete of an (unprotected) program. Used by DELETE /api/pm/programs. */
export async function deleteProgramById(id) {
  return db.execute({
    sql: "DELETE FROM v2_programs WHERE id = ?",
    args: [id],
  });
}
