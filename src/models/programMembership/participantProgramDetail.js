import db from "@/lib/db";

/**
 * ProgramMembership model — participant program detail reads (REPOSITORY layer).
 *
 * The enrollment context, program content, roster, follow-up and knowledge-bank
 * reads used by `/api/participant/programs/[id]`, split verbatim out of
 * `models/programMembership.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

// ────────────────────────────────────────────────────────────
// /api/participant/programs/[id] — participant program detail
// ────────────────────────────────────────────────────────────

/** The participant's own contact enrollment context (program_id, group_name). */
export async function getParticipantProgramEnrollmentByCid(cid) {
  return db.execute({
    sql: "SELECT program_id, group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Program row by text id. */
export async function getParticipantProgramDetailById(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

/** Sessions of a program, ordered by week then start time. */
export async function getParticipantProgramDetailSessions(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC, start_at ASC",
    args: [programId],
  });
}

/** Document requirements (deliverables) of a program. */
export async function getParticipantProgramDetailDeliverables(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
    args: [programId],
  });
}

/** Submissions of a participant within a program, newest first. */
export async function getParticipantProgramDetailSubmissions(participantId, programId) {
  return db.execute({
    sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ? AND program_id::text = ? ORDER BY created_at DESC",
    args: [participantId, programId],
  });
}

/** Attendance marks of a participant within a program's sessions. */
export async function getParticipantProgramDetailAttendance(participantId, programId) {
  return db.execute({
    sql: "SELECT a.* FROM v2_attendance a JOIN v2_sessions s ON a.session_id::text = s.id::text WHERE a.participant_id::text = ? AND s.program_id::text = ? ORDER BY a.created_at ASC",
    args: [participantId, programId],
  });
}

/** KPIs of a program. */
export async function getParticipantProgramDetailKpis(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
    args: [programId],
  });
}

/** Program-staff roster (with contact name/role) of a program. */
export async function getParticipantProgramDetailStaff(programId) {
  return db.execute({
    sql: "SELECT ps.*, c.name AS staff_name, c.role AS staff_role FROM v2_program_staff ps LEFT JOIN contacts c ON ps.staff_id = c.cid WHERE ps.program_id = ?",
    args: [programId],
  });
}

/** Recent follow-ups attached to a program. */
export async function getParticipantProgramFollowups(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC LIMIT 10",
    args: [programId],
  });
}

/** Non-archived knowledge-bank resources, newest first. */
export async function getParticipantKnowledgeBankItems() {
  return db.execute({
    sql: "SELECT * FROM v2_knowledge_bank WHERE is_archived = 0 ORDER BY created_at DESC",
    args: [],
  });
}

/**
 * Knowledge-bank attachment rows for a set of note ids. The placeholder list
 * is derived from the number of ids, so the generated SQL is identical to the
 * original inline `note_id IN (?,?,...)` query.
 */
export async function getKnowledgeBankAttachmentsByNoteIds(noteIds) {
  return db.execute({
    sql:
      "SELECT * FROM v2_knowledge_attachments WHERE note_id IN (" +
      noteIds.map(() => "?").join(",") +
      ") ORDER BY created_at DESC",
    args: noteIds,
  });
}

/** Name of a program's assigned PM contact. */
export async function getParticipantProgramDetailPmName(pmCid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [pmCid],
  });
}

/** Whether any attendance rows exist for a program (attendance tracking). */
export async function getProgramDetailAttendanceCount(programId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS total FROM v2_attendance WHERE program_id::text = ?",
    args: [programId],
  });
}
