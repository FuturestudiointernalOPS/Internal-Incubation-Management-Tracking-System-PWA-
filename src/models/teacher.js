import db from "@/lib/db";

/**
 * Teacher model — data access for the teacher API controllers under
 * `src/app/api/teacher/` and `src/app/api/v2/teacher/` (weekly reports,
 * document fulfillment).
 *
 * Each exported function wraps exactly one SQL statement, and SQL is
 * byte-identical to the queries that used to live inline in the controllers,
 * so behavior is unchanged (see docs/MVC_REFACTOR.md §4).
 *
 * Route → function-group mapping (extraction is strictly 1:1 with the
 * original inline call sites; the `/api/v2/teacher/*` counterparts carry a
 * `V2` marker, mirroring the pre-extraction code):
 *
 *  src/app/api/teacher/reports/route.js        →  6 functions
 *  src/app/api/v2/teacher/reports/route.js     →  6 functions
 *  src/app/api/teacher/fulfillment/route.js    →  3 functions
 *  src/app/api/v2/teacher/fulfillment/route.js →  3 functions
 */

// ── GET/POST /api/teacher/reports ───────────────────────────────────────────

/** teacher reports GET — weekly reports filtered by program/week, newest first. */
export async function listWeeklyReports(program_id, week_number) {
  let sql = "SELECT * FROM v2_weekly_reports WHERE 1=1";
  const args = [];

  if (program_id) {
    sql += " AND program_id = ?";
    args.push(program_id);
  }
  if (week_number) {
    sql += " AND week_number = ?";
    args.push(parseInt(week_number));
  }

  sql += " ORDER BY created_at DESC";

  return db.execute({ sql, args });
}

/** teacher reports POST — existing report lookup (update instead of insert). */
export async function findWeeklyReportByProgramWeekTeacher(
  program_id,
  week_number,
  teacher_id,
) {
  return db.execute({
    sql: "SELECT id FROM v2_weekly_reports WHERE program_id = ? AND week_number = ? AND teacher_id = ?",
    args: [program_id, week_number, teacher_id],
  });
}

/** teacher reports POST — full weekly report update when the report exists. */
export async function updateWeeklyReport({
  reportId,
  reception_score,
  progress_notes,
  student_reception,
  action_taken,
  week_status,
  week_rating,
  main_topic,
  assignment_given,
  assignment_kpi_ids,
  assignment_objective,
  assignment_outcome,
  attendance_level,
  participation_level,
  participants_need_attention,
  participants_attention_notes,
  standout_participants,
  standout_notes,
  delivery_quality,
  participant_understanding,
  delivery_challenges,
  delivery_challenge_note,
  had_issues,
  requires_admin_attention,
  issue_types,
  additional_issue_note,
  program_on_track,
  planned_adjustments,
}) {
  return db.execute({
    sql: `UPDATE v2_weekly_reports SET
                  reception_score = ?,
                  progress_notes = ?,
                  student_reception = ?,
                  action_taken = ?,
                  week_status = ?,
                  week_rating = ?,
                  main_topic = ?,
                  assignment_given = ?,
                  assignment_kpi_ids = ?,
                  assignment_objective = ?,
                  assignment_outcome = ?,
                  attendance_level = ?,
                  participation_level = ?,
                  participants_need_attention = ?,
                  participants_attention_notes = ?,
                  standout_participants = ?,
                  standout_notes = ?,
                  delivery_quality = ?,
                  participant_understanding = ?,
                  delivery_challenges = ?,
                  delivery_challenge_note = ?,
                  had_issues = ?,
                  requires_admin_attention = ?,
                  issue_types = ?,
                  additional_issue_note = ?,
                  program_on_track = ?,
                  planned_adjustments = ?,
                  updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`,
    args: [
      reception_score,
      progress_notes || null,
      student_reception || null,
      action_taken || null,
      week_status || null,
      week_rating || null,
      main_topic || null,
      assignment_given != null ? assignment_given : null,
      assignment_kpi_ids ? (typeof assignment_kpi_ids === "string" ? assignment_kpi_ids : JSON.stringify(assignment_kpi_ids)) : null,
      assignment_objective || null,
      assignment_outcome || null,
      attendance_level || null,
      participation_level || null,
      participants_need_attention != null ? participants_need_attention : null,
      participants_attention_notes || null,
      standout_participants != null ? standout_participants : null,
      standout_notes || null,
      delivery_quality || null,
      participant_understanding || null,
      delivery_challenges != null ? delivery_challenges : null,
      delivery_challenge_note || null,
      had_issues != null ? had_issues : null,
      requires_admin_attention != null ? requires_admin_attention : null,
      issue_types ? (typeof issue_types === "string" ? issue_types : JSON.stringify(issue_types)) : null,
      additional_issue_note || null,
      program_on_track != null ? program_on_track : null,
      planned_adjustments || null,
      reportId,
    ],
  });
}

/** teacher reports POST — activity log entry for an updated report. */
export async function logWeeklyReportUpdatedActivity(userIdentity, weekNumber) {
  return db.execute({
    sql: "INSERT INTO activity_logs (user_identity, action, module, status) VALUES (?, ?, ?, ?)",
    args: [
      userIdentity,
      `Updated Weekly Report (Week ${weekNumber})`,
      "Programs",
      "success",
    ],
  });
}

/** teacher reports POST — insert a full weekly report when none exists yet. */
export async function insertWeeklyReport({
  program_id,
  week_number,
  teacher_id,
  teacher_name,
  reception_score,
  progress_notes,
  student_reception,
  action_taken,
  week_status,
  week_rating,
  main_topic,
  assignment_given,
  assignment_kpi_ids,
  assignment_objective,
  assignment_outcome,
  attendance_level,
  participation_level,
  participants_need_attention,
  participants_attention_notes,
  standout_participants,
  standout_notes,
  delivery_quality,
  participant_understanding,
  delivery_challenges,
  delivery_challenge_note,
  had_issues,
  requires_admin_attention,
  issue_types,
  additional_issue_note,
  program_on_track,
  planned_adjustments,
}) {
  return db.execute({
    sql: `INSERT INTO v2_weekly_reports
                  (program_id, week_number, teacher_id, teacher_name, reception_score, progress_notes, student_reception, action_taken,
                   week_status, week_rating, main_topic,
                   assignment_given, assignment_kpi_ids, assignment_objective, assignment_outcome,
                   attendance_level, participation_level, participants_need_attention, participants_attention_notes, standout_participants, standout_notes,
                   delivery_quality, participant_understanding, delivery_challenges, delivery_challenge_note,
                   had_issues, requires_admin_attention, issue_types, additional_issue_note,
                   program_on_track, planned_adjustments)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                          ?, ?, ?,
                          ?, ?, ?, ?,
                          ?, ?, ?, ?, ?, ?,
                          ?, ?, ?, ?,
                          ?, ?, ?, ?,
                          ?, ?) RETURNING id`,
    args: [
      program_id,
      week_number,
      teacher_id,
      teacher_name,
      reception_score || 5,
      progress_notes || null,
      student_reception || null,
      action_taken || null,
      week_status || null,
      week_rating || null,
      main_topic || null,
      assignment_given != null ? assignment_given : null,
      assignment_kpi_ids ? (typeof assignment_kpi_ids === "string" ? assignment_kpi_ids : JSON.stringify(assignment_kpi_ids)) : null,
      assignment_objective || null,
      assignment_outcome || null,
      attendance_level || null,
      participation_level || null,
      participants_need_attention != null ? participants_need_attention : null,
      participants_attention_notes || null,
      standout_participants != null ? standout_participants : null,
      standout_notes || null,
      delivery_quality || null,
      participant_understanding || null,
      delivery_challenges != null ? delivery_challenges : null,
      delivery_challenge_note || null,
      had_issues != null ? had_issues : null,
      requires_admin_attention != null ? requires_admin_attention : null,
      issue_types ? (typeof issue_types === "string" ? issue_types : JSON.stringify(issue_types)) : null,
      additional_issue_note || null,
      program_on_track != null ? program_on_track : null,
      planned_adjustments || null,
    ],
  });
}

/** teacher reports POST — activity log entry for a created report. */
export async function logWeeklyReportCreatedActivity(userIdentity, weekNumber) {
  return db.execute({
    sql: "INSERT INTO activity_logs (user_identity, action, module, status) VALUES (?, ?, ?, ?)",
    args: [
      userIdentity,
      `Created Weekly Report (Week ${weekNumber})`,
      "Programs",
      "success",
    ],
  });
}

// ── GET/POST /api/v2/teacher/reports (legacy V2 API, still used by V1 pages) ─

/** v2 teacher reports GET — weekly reports filtered by program/week, newest first. */
export async function listV2WeeklyReports(program_id, week_number) {
  let sql = "SELECT * FROM v2_weekly_reports WHERE 1=1";
  const args = [];

  if (program_id) {
    sql += " AND program_id = ?";
    args.push(program_id);
  }
  if (week_number) {
    sql += " AND week_number = ?";
    args.push(parseInt(week_number));
  }

  sql += " ORDER BY created_at DESC";

  return db.execute({ sql, args });
}

/** v2 teacher reports POST — existing report lookup (update instead of insert). */
export async function findV2WeeklyReportByProgramWeekTeacher(
  program_id,
  week_number,
  teacher_id,
) {
  return db.execute({
    sql: "SELECT id FROM v2_weekly_reports WHERE program_id = ? AND week_number = ? AND teacher_id = ?",
    args: [program_id, week_number, teacher_id],
  });
}

/** v2 teacher reports POST — legacy field update when the report exists. */
export async function updateV2WeeklyReport({
  reportId,
  reception_score,
  progress_notes,
  student_reception,
  action_taken,
}) {
  return db.execute({
    sql: `UPDATE v2_weekly_reports SET
                  reception_score = ?,
                  progress_notes = ?,
                  student_reception = ?,
                  action_taken = ?,
                  updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`,
    args: [
      reception_score,
      progress_notes,
      student_reception,
      action_taken,
      reportId,
    ],
  });
}

/** v2 teacher reports POST — activity log entry for an updated report. */
export async function logV2WeeklyReportUpdatedActivity(userIdentity, weekNumber) {
  return db.execute({
    sql: "INSERT INTO activity_logs (user_identity, action, module, status) VALUES (?, ?, ?, ?)",
    args: [
      userIdentity,
      `Updated Weekly Report (Week ${weekNumber})`,
      "Programs",
      "success",
    ],
  });
}

/** v2 teacher reports POST — insert a legacy weekly report when none exists yet. */
export async function insertV2WeeklyReport({
  program_id,
  week_number,
  teacher_id,
  teacher_name,
  reception_score,
  progress_notes,
  student_reception,
  action_taken,
}) {
  return db.execute({
    sql: `INSERT INTO v2_weekly_reports
                  (program_id, week_number, teacher_id, teacher_name, reception_score, progress_notes, student_reception, action_taken)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      program_id,
      week_number,
      teacher_id,
      teacher_name,
      reception_score || 5,
      progress_notes,
      student_reception,
      action_taken,
    ],
  });
}

/** v2 teacher reports POST — activity log entry for a created report. */
export async function logV2WeeklyReportCreatedActivity(userIdentity, weekNumber) {
  return db.execute({
    sql: "INSERT INTO activity_logs (user_identity, action, module, status) VALUES (?, ?, ?, ?)",
    args: [
      userIdentity,
      `Created Weekly Report (Week ${weekNumber})`,
      "Programs",
      "success",
    ],
  });
}

// ── GET /api/teacher/fulfillment ────────────────────────────────────────────

/** teacher fulfillment GET — participants for the fulfillment program. */
export async function getFulfillmentParticipantsByProgram(program_id) {
  return db.execute({
    sql: "SELECT id, name, cid, email, phone FROM v2_participants WHERE program_id = ?",
    args: [program_id],
  });
}

/** teacher fulfillment GET — document requirements for the program/week. */
export async function getFulfillmentRequirementsByProgramWeek(
  program_id,
  week_number,
) {
  return db.execute({
    sql: "SELECT id, title FROM v2_document_requirements WHERE program_id = ? AND week_number = ?",
    args: [program_id, week_number],
  });
}

/** teacher fulfillment GET — submissions for the given document requirement ids. */
export async function getSubmissionsByDocumentIds(reqIds) {
  const placeholders = reqIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT * FROM v2_submissions WHERE document_id IN (${placeholders})`,
    args: reqIds.map(String),
  });
}

// ── GET /api/v2/teacher/fulfillment (legacy V2 API, still used by V1 pages) ─

/** v2 teacher fulfillment GET — participants for the fulfillment program. */
export async function getV2FulfillmentParticipantsByProgram(program_id) {
  return db.execute({
    sql: "SELECT id, name, cid, email, phone FROM v2_participants WHERE program_id = ?",
    args: [program_id],
  });
}

/** v2 teacher fulfillment GET — document requirements for the program/week. */
export async function getV2FulfillmentRequirementsByProgramWeek(
  program_id,
  week_number,
) {
  return db.execute({
    sql: "SELECT id, title FROM v2_document_requirements WHERE program_id = ? AND week_number = ?",
    args: [program_id, week_number],
  });
}

/** v2 teacher fulfillment GET — submissions for the given document requirement ids. */
export async function getV2SubmissionsByDocumentIds(reqIds) {
  const placeholders = reqIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT * FROM v2_submissions WHERE document_id IN (${placeholders})`,
    args: reqIds.map(String),
  });
}

// ── GET /api/teacher/full-state ─────────────────────────────────────────────

/** teacher full-state GET — teams handled by the teacher. */
export async function getTeacherTeamsByHandlerCid(cid) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE handler_id = ?",
    args: [cid],
  });
}

/** teacher full-state GET — pending submissions for teams handled by the teacher. */
export async function getTeacherPendingSubmissionsByHandlerCid(cid) {
  return db.execute({
    sql: `SELECT s.*, r.title as requirement_title, ses.week_number FROM v2_submissions s JOIN v2_document_requirements r ON s.deliverable_id = r.id LEFT JOIN v2_sessions ses ON r.session_id = ses.id JOIN v2_teams t ON s.program_id = t.program_id WHERE t.handler_id = ? AND s.status = 'pending'`,
    args: [cid],
  });
}

/** teacher full-state GET — scheduled sessions (v2_sessions) for the teacher. */
export async function getTeacherSessionsByHandlerCid(cid) {
  return db.execute({
    sql: `SELECT s.*, p.name as program_name FROM v2_sessions s JOIN v2_programs p ON s.program_id = p.id WHERE s.handler_id = ? AND s.scheduled_date IS NOT NULL`,
    args: [cid],
  });
}

// ── GET /api/v2/teacher/full-state (legacy V2 API, still used by V1 pages) ──

/** v2 teacher full-state GET — programs the teacher assists or handles. */
export async function getV2TeacherProgramsByHandlerCid(cid) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE assigned_assistant_id LIKE ? OR id IN (SELECT program_id FROM v2_teams WHERE handler_id = ?)",
    args: [`%${cid}%`, cid],
  });
}

/** v2 teacher full-state GET — teams handled by the teacher. */
export async function getV2TeacherTeamsByHandlerCid(cid) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE handler_id = ?",
    args: [cid],
  });
}

/** v2 teacher full-state GET — pending submissions for programs the teacher covers. */
export async function getV2TeacherPendingSubmissionsByHandlerCid(cid) {
  return db.execute({
    sql: `SELECT s.*, r.title as requirement_title, ses.week_number, p.name as program_name
              FROM v2_submissions s
              JOIN v2_document_requirements r ON s.deliverable_id = r.id
              LEFT JOIN v2_sessions ses ON r.session_id = ses.id
              JOIN v2_programs p ON s.program_id = p.id
              WHERE (p.assigned_assistant_id LIKE ? OR p.id IN (SELECT program_id FROM v2_teams WHERE handler_id = ?))
              AND s.status = 'pending'`,
    args: [`%${cid}%`, cid],
  });
}

/** v2 teacher full-state GET — scheduled sessions for the teacher's coverage. */
export async function getV2TeacherSessionsByHandlerCid(cid) {
  return db.execute({
    sql: `SELECT s.*, p.name as program_name
              FROM v2_sessions s
              JOIN v2_programs p ON s.program_id = p.id
              WHERE (s.handler_id = ? OR p.assigned_assistant_id LIKE ? OR p.id IN (SELECT program_id FROM v2_teams WHERE handler_id = ?))
              AND s.scheduled_date IS NOT NULL`,
    args: [cid, `%${cid}%`, cid],
  });
}
