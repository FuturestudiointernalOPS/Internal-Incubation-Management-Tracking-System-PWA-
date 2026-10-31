import db from "@/lib/db";

/** Sessions per program (count + completed). Used by GET /api/pm/programs metrics. */
export async function countSessionsByProgram() {
  return db.execute(
    `SELECT program_id, COUNT(*) as count,
            SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'completed' THEN 1 ELSE 0 END) as completed
     FROM v2_sessions GROUP BY program_id`,
  );
}

/** Active (deduped, non-facilitator) participants per program. Used by GET metrics. */
export async function countActiveParticipantsByProgram() {
  return db.execute(
    `SELECT program_id, COUNT(*) as count FROM (
             SELECT CAST(pp.program_id AS TEXT) AS program_id,
                    LOWER(COALESCE(c.email, pp.participant_id, '')) AS dedupe_key
             FROM participant_programs pp
             JOIN contacts c ON pp.participant_id = c.cid
             WHERE LOWER(COALESCE(c.status, '')) = 'active'
               AND c.deleted = 0 AND c.deleted_at IS NULL AND c.archived_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM v2_program_staff ps
                 WHERE CAST(ps.program_id AS TEXT) = CAST(pp.program_id AS TEXT)
                   AND ps.role = 'facilitator'
                   AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
               )
           ) t GROUP BY program_id`,
  );
}

/** Document requirements per program (count + completed). Used by GET metrics. */
export async function countDocumentRequirementsByProgram() {
  return db.execute(
    "SELECT program_id, COUNT(*) as count, SUM(is_completed) as completed FROM v2_document_requirements GROUP BY program_id",
  );
}

/** Weekly-report weeks per program (distinct). Used by GET metrics. */
export async function countReportWeeksByProgram() {
  return db.execute(
    "SELECT program_id, COUNT(DISTINCT week_number) as weeks FROM v2_weekly_reports GROUP BY program_id",
  );
}

/** Families linked to a program (id, program_id). Used by GET metrics. */
export async function getAssignedFamiliesByProgram() {
  return db.execute(
    "SELECT id, program_id FROM families WHERE program_id IS NOT NULL",
  );
}

/** Submissions per program (total + approved/completed). Used by GET metrics. */
export async function countSubmissionsByProgram() {
  return db.execute(
    "SELECT program_id, COUNT(*) as total, COUNT(CASE WHEN status = 'approved' OR status = 'completed' THEN 1 END) as approved FROM v2_submissions GROUP BY program_id",
  );
}

/** Facilitators (v2_program_staff role='facilitator') of one program. Used by GET. */
export async function getProgramFacilitators(programId) {
  return db.execute({
    sql: `SELECT ps.id, ps.staff_id, ps.role, ps.permissions, c.name, c.email
                FROM v2_program_staff ps
                LEFT JOIN contacts c ON ps.staff_id = c.cid OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id))
                WHERE CAST(ps.program_id AS TEXT) = ? AND ps.role = 'facilitator'`,
    args: [String(programId)],
  });
}
