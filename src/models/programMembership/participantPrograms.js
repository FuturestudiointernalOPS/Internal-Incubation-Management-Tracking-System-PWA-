import db from "@/lib/db";

/**
 * ProgramMembership model — participant program dashboard reads (REPOSITORY
 * layer).
 *
 * The enrollment context, program content and roster reads used by
 * `/api/participant/programs`, split verbatim out of
 * `models/programMembership.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

// ────────────────────────────────────────────────────────────
// /api/participant/programs — participant program dashboard
// ────────────────────────────────────────────────────────────

/** The participant's own contact profile (program membership context). */
export async function getParticipantContactProfile(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, program_id, program_name, group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Program row by text id. */
export async function getParticipantProgramById(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

/** Sessions of a program, ordered by week then start time. */
export async function getParticipantProgramSessions(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC, start_at ASC",
    args: [programId],
  });
}

/** Document requirements (deliverables) of a program. */
export async function getParticipantProgramDeliverables(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
    args: [programId],
  });
}

/** Submissions of a participant within a program. */
export async function getParticipantProgramSubmissions(participantId, programId) {
  return db.execute({
    sql: `SELECT s.* FROM v2_submissions s
                  WHERE s.participant_id = ? AND s.program_id::text = ?`,
    args: [participantId, programId],
  });
}

/** Attendance marks of a participant within a program's sessions. */
export async function getParticipantProgramAttendance(participantId, programId) {
  return db.execute({
    sql: `SELECT a.* FROM v2_attendance a
                  JOIN v2_sessions s ON a.session_id::text = s.id::text
                  WHERE a.participant_id = ? AND s.program_id::text = ?`,
    args: [participantId, programId],
  });
}

/** KPIs of a program. */
export async function getParticipantProgramKpis(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
    args: [programId],
  });
}

/** Program-staff roster (with contact name/role) of a program. */
export async function getParticipantProgramStaff(programId) {
  return db.execute({
    sql: "SELECT ps.*, c.name AS staff_name, c.role AS staff_role FROM v2_program_staff ps LEFT JOIN contacts c ON ps.staff_id::text = c.cid WHERE ps.program_id::text = ?",
    args: [programId],
  });
}

/** Whether any attendance rows exist for a program (attendance tracking). */
export async function getParticipantAttendanceCount(programId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS total FROM v2_attendance WHERE program_id::text = ?",
    args: [programId],
  });
}

/** Name of a program's assigned PM contact. */
export async function getParticipantProgramPmName(pmCid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [pmCid],
  });
}
