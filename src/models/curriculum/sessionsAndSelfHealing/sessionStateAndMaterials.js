import db from "@/lib/db";

/** Active (non-facilitator) participant count used by send_reminder. */
export async function countActiveParticipantsForProgram(programId) {
  return db.execute({
    sql: `SELECT COUNT(*) as cnt
                FROM participant_programs pp
                JOIN contacts c ON pp.participant_id = c.cid
                WHERE CAST(pp.program_id AS TEXT) = ?
                  AND c.deleted = 0
                  AND c.deleted_at IS NULL
                  AND c.archived_at IS NULL
                  AND LOWER(COALESCE(c.status, '')) = 'active'
                  AND NOT EXISTS (
                    SELECT 1 FROM v2_program_staff ps
                    WHERE CAST(ps.program_id AS TEXT) = CAST(pp.program_id AS TEXT)
                      AND ps.role = 'facilitator'
                      AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
                  )`,
    args: [programId],
  });
}

/** Flip a session's status (e.g. 'not started' → 'in progress'). */
export async function updateSessionStatus(status, id) {
  return db.execute({
    sql: "UPDATE v2_sessions SET status = ? WHERE id = ?",
    args: [status, id],
  });
}

/** Flip a requirement's is_completed flag (accepts the same 1/0 value). */
export async function setDeliverableCompletion(isCompleted, id) {
  return db.execute({
    sql: "UPDATE v2_document_requirements SET is_completed = ? WHERE id = ?",
    args: [isCompleted, id],
  });
}

/** Assign a team to a session. */
export async function setSessionTeam(teamId, id) {
  return db.execute({
    sql: "UPDATE v2_sessions SET team_id = ? WHERE id = ?",
    args: [teamId, id],
  });
}

/** Current extra_materials JSON of a session (anchor_material read). */
export async function getSessionExtraMaterials(sessionId) {
  return db.execute({
    sql: "SELECT extra_materials FROM v2_sessions WHERE id = ?",
    args: [sessionId],
  });
}

/** Persist the re-serialized extra_materials JSON (anchor_material write). */
export async function updateSessionExtraMaterials(extraMaterials, sessionId) {
  return db.execute({
    sql: "UPDATE v2_sessions SET extra_materials = ? WHERE id = ?",
    args: [extraMaterials, sessionId],
  });
}
