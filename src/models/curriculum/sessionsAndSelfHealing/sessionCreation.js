import db from "@/lib/db";

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
