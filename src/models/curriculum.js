import db from "@/lib/db";

/**
 * Curriculum model — data access for the PM curriculum controller
 * (`src/app/api/pm/curriculum/route.js`): program sessions, session
 * requirements/deliverables, attendance, weekly PM reports.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 *  - Schema-maintenance DDL (the ensure* helpers in the controller) stays
 *    additive and idempotent; callers keep their own try/catch.
 */

// ── Schema self-healing (idempotent DDL guards) ──────────────────────────────

/** Session versioning — `version` column on v2_sessions. */
export async function addSessionVersionColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1",
    args: [],
  });
}

/** Session versioning — `timezone` column on v2_sessions. */
export async function addSessionTimezoneColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC'",
    args: [],
  });
}

/** Session versioning — snapshot table for pre-update session rows. */
export async function createSessionVersionsTable() {
  return db.execute({
    sql: `CREATE TABLE IF NOT EXISTS v2_session_versions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        session_id UUID NOT NULL,
        version INTEGER NOT NULL,
        snapshot JSONB NOT NULL,
        changed_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    args: [],
  });
}

/** Requirements — optional PM-provided resource-link `resource_url` column. */
export async function addRequirementResourceUrlColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_url TEXT",
    args: [],
  });
}

/** Requirements — optional PM-provided resource-link `resource_label` column. */
export async function addRequirementResourceLabelColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_label TEXT",
    args: [],
  });
}

/** Requirements — `assignee_type` column (attendance/system requirements). */
export async function addRequirementAssigneeTypeColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS assignee_type TEXT",
    args: [],
  });
}

/** Requirements — `assignee_id` column (attendance/system requirements). */
export async function addRequirementAssigneeIdColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS assignee_id TEXT",
    args: [],
  });
}

/** Weekly reports — `attachment_type` column (URL link or PDF upload). */
export async function addWeeklyReportAttachmentTypeColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS attachment_type TEXT",
    args: [],
  });
}

/** Weekly reports — `attachment_url` column (URL link or PDF upload). */
export async function addWeeklyReportAttachmentUrlColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS attachment_url TEXT",
    args: [],
  });
}

// ── Session versioning ───────────────────────────────────────────────────────

/** Full current v2_sessions row — snapshot source before an update. */
export async function getSessionRowById(sessionId) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE id = ?",
    args: [sessionId],
  });
}

/** Record one pre-update snapshot into the version history. */
export async function insertSessionVersion(sessionId, version, snapshot, changedBy) {
  return db.execute({
    sql: "INSERT INTO v2_session_versions (session_id, version, snapshot, changed_by) VALUES (?, ?, ?::jsonb, ?)",
    args: [sessionId, version, snapshot, changedBy],
  });
}

/** Advance the session's live `version` counter after a snapshot. */
export async function setSessionVersion(version, sessionId) {
  return db.execute({
    sql: "UPDATE v2_sessions SET version = ? WHERE id = ?",
    args: [version, sessionId],
  });
}

// ── POST: add_session ────────────────────────────────────────────────────────

/** Overlapping-session guard for a proposed session time slot. */
export async function findSessionScheduleConflict(
  programId,
  scheduledDate,
  endTime,
  startTime,
) {
  return db.execute({
    sql: `SELECT id, title FROM v2_sessions
                WHERE program_id = ?
                  AND type = 'session'
                  AND scheduled_date = ?
                  AND start_time < ?
                  AND end_time > ?
                LIMIT 1`,
    args: [programId, scheduledDate, endTime, startTime],
  });
}

/** Create a curriculum session (type 'session', default weight 1). */
export async function createSession(
  programId,
  title,
  description,
  weekNumber,
  type,
  status,
  weight,
  scheduledDate,
  endDate,
  startTime,
  endTime,
  assignmentType,
  taskType,
  handlerId,
  handlerName,
  kpiIds,
  notes,
  extraMaterials,
  timezone,
) {
  return db.execute({
    sql: "INSERT INTO v2_sessions (program_id, title, description, week_number, type, status, weight, scheduled_date, end_date, start_time, end_time, assignment_type, task_type, handler_id, handler_name, kpi_ids, notes, extra_materials, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    args: [
      programId,
      title,
      description,
      weekNumber,
      type,
      status,
      weight,
      scheduledDate,
      endDate,
      startTime,
      endTime,
      assignmentType,
      taskType,
      handlerId,
      handlerName,
      kpiIds,
      notes,
      extraMaterials,
      timezone,
    ],
  });
}

/** System-generated Attendance requirement attached to every new session. */
export async function createAttendanceRequirement(
  programId,
  title,
  description,
  sessionId,
  allowedFormat,
  weight,
  kpiIds,
  dueDate,
  assigneeType,
) {
  return db.execute({
    sql: "INSERT INTO v2_document_requirements (program_id, title, description, session_id, allowed_format, weight, kpi_ids, due_date, assignee_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [
      programId,
      title,
      description,
      sessionId,
      allowedFormat,
      weight,
      kpiIds,
      dueDate,
      assigneeType,
    ],
  });
}

/** Deliverable requirement defined inline during session creation. */
export async function addSessionRequirement(
  programId,
  title,
  description,
  sessionId,
  allowedFormat,
  weight,
  kpiIds,
  dueDate,
  assigneeType,
  assigneeId,
  resourceUrl,
  resourceLabel,
) {
  return db.execute({
    sql: "INSERT INTO v2_document_requirements (program_id, title, description, session_id, allowed_format, weight, kpi_ids, due_date, assignee_type, assignee_id, resource_url, resource_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [
      programId,
      title,
      description,
      sessionId,
      allowedFormat,
      weight,
      kpiIds,
      dueDate,
      assigneeType,
      assigneeId,
      resourceUrl,
      resourceLabel,
    ],
  });
}

/** Deliverable requirement added on its own (RETURNING id). */
export async function createRequirement(
  programId,
  title,
  description,
  sessionId,
  allowedFormat,
  weight,
  kpiIds,
  dueDate,
  assigneeType,
  assigneeId,
  resourceUrl,
  resourceLabel,
) {
  return db.execute({
    sql: "INSERT INTO v2_document_requirements (program_id, title, description, session_id, allowed_format, weight, kpi_ids, due_date, assignee_type, assignee_id, resource_url, resource_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    args: [
      programId,
      title,
      description,
      sessionId,
      allowedFormat,
      weight,
      kpiIds,
      dueDate,
      assigneeType,
      assigneeId,
      resourceUrl,
      resourceLabel,
    ],
  });
}

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

/** Upsert a weekly PM report keyed on (program_id, week_number, teacher_id). */
export async function upsertWeeklyReport(
  programId,
  weekNumber,
  teacherId,
  teacherName,
  progressNotes,
  receptionScore,
  weekStatus,
  weekRating,
  mainTopic,
  assignmentGiven,
  assignmentKpiIds,
  assignmentObjective,
  assignmentOutcome,
  attendanceLevel,
  participationLevel,
  participantsNeedAttention,
  participantsAttentionNotes,
  standoutParticipants,
  standoutNotes,
  deliveryQuality,
  participantUnderstanding,
  deliveryChallenges,
  deliveryChallengeNote,
  hadIssues,
  issueTypes,
  requiresAdminAttention,
  additionalIssueNote,
  programOnTrack,
  plannedAdjustments,
  attachmentType,
  attachmentUrl,
) {
  return db.execute({
    sql: `INSERT INTO v2_weekly_reports
                  (program_id, week_number, teacher_id, teacher_name, progress_notes, reception_score,
                   week_status, week_rating, main_topic,
                   assignment_given, assignment_kpi_ids, assignment_objective, assignment_outcome,
                   attendance_level, participation_level,
                   participants_need_attention, participants_attention_notes,
                   standout_participants, standout_notes,
                   delivery_quality, participant_understanding,
                   delivery_challenges, delivery_challenge_note,
                   had_issues, issue_types, requires_admin_attention, additional_issue_note,
                   program_on_track, planned_adjustments,
                   attachment_type, attachment_url)
                  VALUES (?, ?, ?, ?, ?, ?,
                   ?, ?, ?,
                   ?, ?, ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?, ?, ?,
                   ?, ?,
                   ?, ?)
                  ON CONFLICT (program_id, week_number, teacher_id)
                  DO UPDATE SET
                    teacher_name = EXCLUDED.teacher_name,
                    progress_notes = EXCLUDED.progress_notes,
                    reception_score = EXCLUDED.reception_score,
                    week_status = EXCLUDED.week_status,
                    week_rating = EXCLUDED.week_rating,
                    main_topic = EXCLUDED.main_topic,
                    assignment_given = EXCLUDED.assignment_given,
                    assignment_kpi_ids = EXCLUDED.assignment_kpi_ids,
                    assignment_objective = EXCLUDED.assignment_objective,
                    assignment_outcome = EXCLUDED.assignment_outcome,
                    attendance_level = EXCLUDED.attendance_level,
                    participation_level = EXCLUDED.participation_level,
                    participants_need_attention = EXCLUDED.participants_need_attention,
                    participants_attention_notes = EXCLUDED.participants_attention_notes,
                    standout_participants = EXCLUDED.standout_participants,
                    standout_notes = EXCLUDED.standout_notes,
                    delivery_quality = EXCLUDED.delivery_quality,
                    participant_understanding = EXCLUDED.participant_understanding,
                    delivery_challenges = EXCLUDED.delivery_challenges,
                    delivery_challenge_note = EXCLUDED.delivery_challenge_note,
                    had_issues = EXCLUDED.had_issues,
                    issue_types = EXCLUDED.issue_types,
                    requires_admin_attention = EXCLUDED.requires_admin_attention,
                    additional_issue_note = EXCLUDED.additional_issue_note,
                    program_on_track = EXCLUDED.program_on_track,
                    planned_adjustments = EXCLUDED.planned_adjustments,
                    attachment_type = EXCLUDED.attachment_type,
                    attachment_url = EXCLUDED.attachment_url`,
    args: [
      programId,
      weekNumber,
      teacherId,
      teacherName,
      progressNotes,
      receptionScore,
      weekStatus,
      weekRating,
      mainTopic,
      assignmentGiven,
      assignmentKpiIds,
      assignmentObjective,
      assignmentOutcome,
      attendanceLevel,
      participationLevel,
      participantsNeedAttention,
      participantsAttentionNotes,
      standoutParticipants,
      standoutNotes,
      deliveryQuality,
      participantUnderstanding,
      deliveryChallenges,
      deliveryChallengeNote,
      hadIssues,
      issueTypes,
      requiresAdminAttention,
      additionalIssueNote,
      programOnTrack,
      plannedAdjustments,
      attachmentType,
      attachmentUrl,
    ],
  });
}

// ── PUT ──────────────────────────────────────────────────────────────────────

/** Current schedule of a session — conflict baseline for schedule changes. */
export async function getSessionSchedule(sessionId) {
  return db.execute({
    sql: "SELECT scheduled_date, start_time, end_time FROM v2_sessions WHERE id = ?",
    args: [sessionId],
  });
}

/** Overlapping-session guard for schedule changes (excludes the session itself). */
export async function findSessionScheduleConflictExcludingId(
  programId,
  targetId,
  scheduledDate,
  endTime,
  startTime,
) {
  return db.execute({
    sql: `SELECT id, title FROM v2_sessions
                    WHERE program_id = ?
                      AND type = 'session'
                      AND id != ?
                      AND scheduled_date = ?
                      AND start_time < ?
                      AND end_time > ?
                    LIMIT 1`,
    args: [programId, targetId, scheduledDate, endTime, startTime],
  });
}

/**
 * Resolve the field-level session/requirement UPDATE statement from a PUT
 * payload. Pure statement builder — no db access. The controller interleaves
 * conflict detection and version snapshotting between this and
 * runSessionFieldUpdate, mirroring the updateTaskFields convention in
 * src/models/tasks.js.
 */
export function buildSessionFieldUpdate(field, value, handlerName, targetId) {
  let sql = "";
  let args = [];
  if (field === "scheduled_date") {
    sql = "UPDATE v2_sessions SET scheduled_date = ? WHERE id = ?";
    args = [value || null, targetId];
  } else if (field === "end_date") {
    sql = "UPDATE v2_sessions SET end_date = ? WHERE id = ?";
    args = [value || null, targetId];
  } else if (field === "handler_id") {
    sql =
      "UPDATE v2_sessions SET handler_id = ?, handler_name = ? WHERE id = ?";
    args = [value || null, handlerName || null, targetId];
  } else if (field === "due_date") {
    sql = "UPDATE v2_document_requirements SET due_date = ? WHERE id = ?";
    args = [value || null, targetId];
  } else if (field === "kpi_ids") {
    sql = "UPDATE v2_sessions SET kpi_ids = ? WHERE id = ?";
    args = [JSON.stringify(value || []), targetId];
  } else if (field === "kpi_ids_doc") {
    sql = "UPDATE v2_document_requirements SET kpi_ids = ? WHERE id = ?";
    args = [JSON.stringify(value || []), targetId];
  } else if (field === "notes") {
    sql = "UPDATE v2_sessions SET notes = ? WHERE id = ?";
    args = [value || null, targetId];
  } else if (field === "extra_materials") {
    sql = "UPDATE v2_sessions SET extra_materials = ? WHERE id = ?";
    args = [JSON.stringify(value || []), targetId];
  } else if (field === "title") {
    sql = "UPDATE v2_sessions SET title = ? WHERE id = ?";
    args = [value, targetId];
  } else if (field === "description") {
    sql = "UPDATE v2_sessions SET description = ? WHERE id = ?";
    args = [value || null, targetId];
  } else if (field === "week_number") {
    sql = "UPDATE v2_sessions SET week_number = ? WHERE id = ?";
    args = [parseInt(value) || 1, targetId];
  } else if (field === "start_time") {
    sql = "UPDATE v2_sessions SET start_time = ? WHERE id = ?";
    args = [value || null, targetId];
  } else if (field === "end_time") {
    sql = "UPDATE v2_sessions SET end_time = ? WHERE id = ?";
    args = [value || null, targetId];
  } else if (field === "assignment_type") {
    sql = "UPDATE v2_sessions SET assignment_type = ? WHERE id = ?";
    args = [value || null, targetId];
  } else if (field === "task_type") {
    sql = "UPDATE v2_sessions SET task_type = ? WHERE id = ?";
    args = [value || null, targetId];
  } else if (field === "timezone") {
    sql = "UPDATE v2_sessions SET timezone = ? WHERE id = ?";
    args = [value || 'UTC', targetId];
  }
  return { sql, args };
}

/** Execute a field-level statement resolved by buildSessionFieldUpdate. */
export async function runSessionFieldUpdate(sql, args) {
  return db.execute({ sql, args });
}

/** Legacy full-session update (weight pinned to 1 in the statement). */
export async function updateSession(
  title,
  description,
  status,
  weekNumber,
  scheduledDate,
  endDate,
  startTime,
  endTime,
  assignmentType,
  taskType,
  handlerId,
  handlerName,
  kpiIds,
  id,
) {
  return db.execute({
    sql: "UPDATE v2_sessions SET title = ?, description = ?, status = ?, week_number = ?, weight = 1, scheduled_date = ?, end_date = ?, start_time = ?, end_time = ?, assignment_type = ?, task_type = ?, handler_id = ?, handler_name = ?, kpi_ids = ? WHERE id = ?",
    args: [
      title,
      description,
      status,
      weekNumber,
      scheduledDate,
      endDate,
      startTime,
      endTime,
      assignmentType,
      taskType,
      handlerId,
      handlerName,
      kpiIds,
      id,
    ],
  });
}

/** Legacy full requirement update (weight pinned to 1 in the statement). */
export async function updateRequirement(
  title,
  description,
  allowedFormat,
  kpiIds,
  dueDate,
  resourceUrl,
  resourceLabel,
  id,
) {
  return db.execute({
    sql: "UPDATE v2_document_requirements SET title = ?, description = ?, allowed_format = ?, weight = 1, kpi_ids = ?, due_date = ?, resource_url = ?, resource_label = ? WHERE id = ?",
    args: [
      title,
      description,
      allowedFormat,
      kpiIds,
      dueDate,
      resourceUrl,
      resourceLabel,
      id,
    ],
  });
}

// ── DELETE ───────────────────────────────────────────────────────────────────

/** Program owning a session (used to re-scope KPI recalc on delete). */
export async function getSessionProgramId(sessionId) {
  return db.execute({
    sql: "SELECT program_id FROM v2_sessions WHERE id = ?",
    args: [sessionId],
  });
}

/** Delete a session row. */
export async function deleteSession(sessionId) {
  return db.execute({
    sql: "DELETE FROM v2_sessions WHERE id = ?",
    args: [sessionId],
  });
}

/** Delete attendance rows recorded for a session. */
export async function deleteAttendanceForSession(sessionId) {
  return db.execute({
    sql: "DELETE FROM v2_attendance WHERE session_id = ?",
    args: [sessionId],
  });
}

/** Delete requirement rows linked to a session. */
export async function deleteRequirementsForSession(sessionId) {
  return db.execute({
    sql: "DELETE FROM v2_document_requirements WHERE session_id = ?",
    args: [sessionId],
  });
}

/** Program owning a requirement (used to re-scope KPI recalc on delete). */
export async function getRequirementProgramId(id) {
  return db.execute({
    sql: "SELECT program_id FROM v2_document_requirements WHERE id = ?",
    args: [id],
  });
}

/** Delete a single requirement row. */
export async function deleteRequirement(id) {
  return db.execute({
    sql: "DELETE FROM v2_document_requirements WHERE id = ?",
    args: [id],
  });
}
