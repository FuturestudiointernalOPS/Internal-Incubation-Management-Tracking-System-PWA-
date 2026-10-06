import db from "@/lib/db";

/**
 * Facilitation model — attendance (REPOSITORY layer).
 *
 * The attendance table self-heal, the mark upserts/clears, facilitator team
 * scope and the per-participant summary/listing reads. Split verbatim out of
 * `models/facilitation.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Idempotent creation of the v2_attendance table. */
export async function createAttendanceTable() {
  return db.execute({
    sql: `CREATE TABLE IF NOT EXISTS v2_attendance (
          id SERIAL PRIMARY KEY,
          session_id TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'neutral',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
    args: [],
  });
}

/** Idempotent add of the program_id column on v2_attendance. */
export async function addAttendanceProgramIdColumn() {
  return db.execute({ sql: "ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS program_id TEXT", args: [] });
}

/** Idempotent add of the date column on v2_attendance. */
export async function addAttendanceDateColumn() {
  return db.execute({ sql: "ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE", args: [] });
}

/** Idempotent add of the updated_at column on v2_attendance. */
export async function addAttendanceUpdatedAtColumn() {
  return db.execute({ sql: "ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()", args: [] });
}

/** Remove legacy duplicate attendance marks (same session+date+participant), keeping the newest. */
export async function dedupeLegacyAttendanceRows() {
  return db.execute({
    sql: `DELETE FROM v2_attendance a USING v2_attendance b
              WHERE a.session_id = b.session_id AND a.date = b.date AND a.participant_id = b.participant_id
                AND a.updated_at < b.updated_at`,
    args: [],
  });
}

/** Uniqueness index enforcing one attendance mark per participant per session per day. */
export async function createAttendanceUniqueIndex() {
  return db.execute({
    sql: "CREATE UNIQUE INDEX IF NOT EXISTS uq_v2_attendance_session_date_participant ON v2_attendance (session_id, date, participant_id)",
    args: [],
  });
}

/** Contacts belonging to any of the given team ids (facilitator team scope). */
export async function getContactsInTeams(teamIds) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE v2_team_id IN (" + teamIds.map(() => "?").join(",") + ")",
    args: teamIds,
  });
}

/** Delete a participant's attendance mark for a session/date (explicit clear + upsert path). */
export async function deleteAttendanceMark(sessionId, date, participantId) {
  return db.execute({
    sql: "DELETE FROM v2_attendance WHERE session_id = ? AND date = ? AND participant_id = ?",
    args: [sessionId, date, participantId],
  });
}

/** Insert one attendance mark. */
export async function insertAttendanceMark(attendance) {
  return db.execute({
    sql: "INSERT INTO v2_attendance (session_id, program_id, participant_id, status, date) VALUES (?, ?, ?, ?, ?)",
    args: [
      attendance.session_id,
      attendance.program_id || null,
      attendance.participant_id,
      attendance.status,
      attendance.date,
    ],
  });
}

/** Per-participant attendance rates for a program (optionally scoped to a facilitator's teams). */
export async function getAttendanceSummary(programId, facGroupFilter, facGroupArgs) {
  return db.execute({
    sql: `
          SELECT
            a.participant_id,
            c.name as participant_name,
            COUNT(*) as total_sessions,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
            SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
            ROUND(
              (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::decimal / 
              NULLIF((SELECT COUNT(DISTINCT date) FROM v2_attendance WHERE program_id = a.program_id), 0)) * 100
            , 1) as attendance_rate
          FROM v2_attendance a
          LEFT JOIN contacts c ON a.participant_id::text = c.cid
          WHERE a.program_id = ? AND ${facGroupFilter ? facGroupFilter : "1=1"}
          GROUP BY a.participant_id, c.name, a.program_id
          ORDER BY attendance_rate DESC
        `,
    args: [programId, ...facGroupArgs],
  });
}

/** Attendance rows with participant name, filtered and ordered for the listing view. */
export async function listAttendance(filters) {
  const { sessionId, dateStr, programId, participantId, facGroupFilter, facGroupArgs } = filters;
  let sql = "SELECT a.*, c.name as participant_name FROM v2_attendance a LEFT JOIN contacts c ON a.participant_id::text = c.cid WHERE 1=1";
  const args = [];

  if (sessionId) {
    sql += " AND a.session_id = ?";
    args.push(sessionId);
  }
  if (dateStr) {
    sql += " AND a.date = ?";
    args.push(dateStr);
  }
  if (programId) {
    sql += " AND a.program_id = ?";
    args.push(programId);
  }
  if (participantId) {
    sql += " AND a.participant_id = ?";
    args.push(participantId);
  }
  if (facGroupFilter) {
    sql += " AND " + facGroupFilter;
    args.push(...facGroupArgs);
  }
  sql += " ORDER BY date DESC, created_at DESC";

  return db.execute({ sql, args });
}
