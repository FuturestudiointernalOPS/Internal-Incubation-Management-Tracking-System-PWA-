import db from "@/lib/db";

/**
 * Participant progress model — data access for GET /api/participant/progress
 */

export async function getProgressContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, program_id, group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

export async function getProgressProgramById(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

export async function getProgressSessionsByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC",
    args: [programId],
  });
}

export async function getProgressDeliverablesByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
    args: [programId],
  });
}

export async function getProgressSubmissionsByProgram(participantId, programId) {
  return db.execute({
    sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ? AND program_id::text = ? ORDER BY created_at DESC",
    args: [participantId, programId],
  });
}

export async function getProgressAttendanceByProgram(programId, participantId) {
  return db.execute({
    sql: "SELECT a.* FROM v2_attendance a WHERE a.program_id::text = ? AND a.participant_id::text = ?",
    args: [programId, participantId],
  });
}

export async function getProgressKpisByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
    args: [programId],
  });
}

export async function getProgressStandupsByUser(userId) {
  return db.execute({
    sql: "SELECT * FROM v2_standups WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
}

export async function getProgressCheckinsByParticipantProgram(participantId, programId) {
  return db.execute({
    sql: "SELECT * FROM v2_checkins WHERE participant_id = ? AND program_id = ? ORDER BY created_at DESC",
    args: [participantId, programId],
  });
}

export async function getProgressRetrosByUser(userId) {
  return db.execute({
    sql: "SELECT * FROM v2_retros WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
}

export async function getProgressReflectionsByUser(userId) {
  return db.execute({
    sql: "SELECT * FROM v2_reflections WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
}

export async function countProgressAttendanceByProgramId(programId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS total FROM v2_attendance WHERE program_id::text = ?",
    args: [programId],
  });
}