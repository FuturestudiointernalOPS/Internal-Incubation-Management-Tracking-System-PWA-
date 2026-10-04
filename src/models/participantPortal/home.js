import db from "@/lib/db";

/**
 * Participant home model — data access for GET /api/participant/home
 */

export async function getHomeContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, group_name, program_id, program_name, role FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

export async function getHomeProgramById(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

export async function getHomeSessionsByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC, start_at ASC",
    args: [programId],
  });
}

export async function getHomeDeliverablesByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
    args: [programId],
  });
}

export async function getHomeSubmissionsByParticipantProgram(participantId, programId) {
  return db.execute({
    sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ? AND program_id::text = ?",
    args: [participantId, programId],
  });
}

export async function getHomeAttendanceByProgram(participantId, programId) {
  return db.execute({
    sql: "SELECT a.* FROM v2_attendance a JOIN v2_sessions s ON a.session_id::text = s.id::text WHERE a.participant_id::text = ? AND s.program_id::text = ?",
    args: [participantId, programId],
  });
}

export async function getHomeKpisByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
    args: [programId],
  });
}

export async function countHomeAttendanceByProgramId(programId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS total FROM v2_attendance WHERE program_id::text = ?",
    args: [programId],
  });
}

export async function getHomeNotifications(participantId, email) {
  return db.execute({
    sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? OR recipient_id = 'all' OR recipient_id = ? ORDER BY created_at DESC LIMIT 10",
    args: [participantId, email],
  });
}

export async function getHomeEventsByProgramIds(programIdList) {
  const placeholders = programIdList.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT * FROM v2_events WHERE program_id IN (${placeholders}) AND start_time IS NOT NULL ORDER BY start_time ASC`,
    args: programIdList,
  });
}