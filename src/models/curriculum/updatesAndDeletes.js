import db from "@/lib/db";

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

