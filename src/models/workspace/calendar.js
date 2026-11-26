import db from "@/lib/db";

/**
 * Workspace model — the unified calendar sources and sessions (REPOSITORY layer).
 *
 * Program-scope resolution, the six calendar event sources, the follow-up schema
 * guard and the session CRUD, split verbatim out of `models/workspace.js` — see
 * docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Program ids a facilitator handles (teams + facilitator staff rows). */
export async function getFacilitatorProgramScopePids(cid) {
  return db.execute({
    sql: `SELECT DISTINCT CAST(program_id AS TEXT) AS pid FROM v2_teams WHERE handler_id = ?
              UNION
              SELECT DISTINCT CAST(program_id AS TEXT) AS pid FROM v2_program_staff WHERE role = 'facilitator' AND staff_id = ?`,
    args: [cid, cid],
  });
}

/** Program ids a participant is enrolled in. */
export async function getParticipantProgramScopePids(cid) {
  return db.execute({
    sql: "SELECT DISTINCT CAST(program_id AS TEXT) AS pid FROM participant_programs WHERE participant_id = ?",
    args: [cid],
  });
}

/**
 * Calendar source — tasks with a start/end date. When a user id is provided
 * the generated SQL is identical to the original inline filter
 * `AND (user_id = ? OR assigned_to = ?)`.
 */
export async function getCalendarTasksWithDates(userId) {
  let sql = `SELECT id, title, start_date, end_date, status, project_id, user_id, assigned_to FROM tasks WHERE (start_date IS NOT NULL OR end_date IS NOT NULL)`;
  const args = [];
  if (userId) {
    sql += ` AND (user_id = ? OR assigned_to = ?)`;
    args.push(userId, userId);
  }
  return db.execute({ sql, args });
}

/**
 * Calendar source — programs with dates. The caller supplies the role-scope
 * fragment (` AND CAST(id AS TEXT) IN (?,...)`, or "") and its args, so the
 * generated SQL stays identical to the original inline query.
 */
export async function getCalendarPrograms(programTableScopeSql, programScopeArgs) {
  return db.execute({
    sql: `SELECT id, name, start_date, end_date, assigned_pm_id FROM v2_programs WHERE (start_date IS NOT NULL OR end_date IS NOT NULL) AND (is_archived IS NULL OR is_archived = 0)${programTableScopeSql}`,
    args: [...programScopeArgs],
  });
}

/** Calendar source — sessions with dates, scoped the same way as programs. */
export async function getCalendarSessions(programScopeSql, programScopeArgs) {
  return db.execute({
    sql: `SELECT s.id, s.title, s.start_at, s.start_time, s.end_time, s.type, s.teacher_id, s.program_id, p.name AS program_name
              FROM v2_sessions s
              LEFT JOIN v2_programs p ON s.program_id = p.id AND (p.is_archived IS NULL OR p.is_archived = 0)
              WHERE s.start_at IS NOT NULL${programScopeSql}`,
    args: [...programScopeArgs],
  });
}

/** Calendar source — deliverables with due dates, scoped to visible programs. */
export async function getCalendarDeliverables(programScopeSql, programScopeArgs) {
  return db.execute({
    sql: `SELECT d.id, d.title, d.due_date, d.week_number, d.program_id, p.name AS program_name
              FROM v2_deliverables d
              LEFT JOIN v2_programs p ON d.program_id = p.id AND (p.is_archived IS NULL OR p.is_archived = 0)
              WHERE d.due_date IS NOT NULL${programScopeSql}`,
    args: [...programScopeArgs],
  });
}

/** Best-effort schema guard: v2_followups.created_by column exists. */
export async function ensureFollowupsCreatedByColumn() {
  return db.execute("ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS created_by TEXT");
}

/**
 * Calendar source — follow-ups with scheduled_at, scoped to visible programs
 * and further filtered by the caller-supplied visibility clause (participant →
 * own rows; non-super-admin → rows they assigned, legacy NULL rows visible).
 */
export async function getCalendarFollowups(programScopeSql, programScopeArgs, visibilitySql, visibilityArgs) {
  const sql = `SELECT f.id, f.comment, f.scheduled_at, f.followup_type, f.team_id, f.program_id, t.name AS team_name, p.name AS program_name
              FROM v2_followups f
              LEFT JOIN v2_teams t ON f.team_id = t.id
              LEFT JOIN v2_programs p ON f.program_id = p.id
              WHERE f.scheduled_at IS NOT NULL${programScopeSql}${visibilitySql}`;
  const args = [...programScopeArgs, ...visibilityArgs];
  return db.execute({ sql, args });
}

/** Create a session and return its new id. */
export async function createSession(programId, title, weekNumber, type, teacherId, startAt) {
  return db.execute({
    sql: `INSERT INTO v2_sessions (program_id, title, week_number, type, teacher_id, start_at)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [programId, title, weekNumber, type, teacherId, startAt],
  });
}

/** List sessions, optionally filtered to one program, ordered by week. */
export async function listSessions(programId) {
  let sql = "SELECT * FROM v2_sessions";
  const args = [];
  if (programId) {
    sql += " WHERE program_id = ?";
    args.push(programId);
  }
  sql += " ORDER BY week_number ASC";
  return db.execute({ sql, args });
}
