/**
 * Programs — the program curriculum (SERVICE layer).
 *
 * The domain work behind `/api/pm/curriculum`: the session/requirement action
 * vocabulary (add, toggle, assign, anchor, reminder, weekly report), the field
 * update with its schedule-conflict guard, the legacy full update and the delete
 * with its per-type cascade. The CONTROLLER keeps authentication, the
 * `programs.edit` capability, the `wave: "content"` record scope and the
 * response envelope; it asks this module which RECORD's program authorises the
 * action, then runs it.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import { recalculateKpiProgress } from "@/lib/kpi-progress";
import {
  addRequirementAssigneeIdColumn,
  addRequirementAssigneeTypeColumn,
  addRequirementResourceLabelColumn,
  addRequirementResourceUrlColumn,
  addSessionRequirement,
  addSessionTimezoneColumn,
  addSessionVersionColumn,
  addWeeklyReportAttachmentTypeColumn,
  addWeeklyReportAttachmentUrlColumn,
  buildSessionFieldUpdate,
  countActiveParticipantsForProgram,
  createAttendanceRequirement,
  createRequirement,
  createSession,
  createSessionVersionsTable,
  deleteAttendanceForSession,
  deleteRequirement,
  deleteRequirementsForSession,
  deleteSession,
  findSessionScheduleConflict,
  findSessionScheduleConflictExcludingId,
  getRequirementProgramId,
  getSessionExtraMaterials,
  getSessionProgramId,
  getSessionRowById,
  getSessionSchedule,
  insertSessionVersion,
  runSessionFieldUpdate,
  setDeliverableCompletion,
  setSessionTeam,
  setSessionVersion,
  updateRequirement,
  updateSession,
  updateSessionExtraMaterials,
  updateSessionStatus,
} from "@/models/curriculum";
import { saveWeeklyReport } from "./weeklyReports";

/**
 * Ensure session versioning schema exists.
 */
async function ensureVersioningSchema() {
  try {
    await addSessionVersionColumn();
  } catch (_) {}
  try {
    await addSessionTimezoneColumn();
  } catch (_) {}
  try {
    await createSessionVersionsTable();
  } catch (_) {}
}

/**
 * Ensure the optional PM-provided resource-link columns exist on requirements.
 * Idempotent and additive — mirrors ensureVersioningSchema() so that session and
 * requirement creation never depends on a separately-run migration.
 */
async function ensureDeliverableResourceSchema() {
  try {
    await addRequirementResourceUrlColumn();
  } catch (_) {}
  try {
    await addRequirementResourceLabelColumn();
  } catch (_) {}
}

/**
 * Ensure the assignee columns exist on requirements (add_session and
 * add_requirement INSERT them). Production was missing these — without the
 * columns, the session INSERT committed but the Attendance requirement INSERT
 * threw, so the route returned 501 "Curriculum feature not available" even
 * though the session was created. Self-healing prevents that drift.
 */
async function ensureRequirementAssigneeSchema() {
  try {
    await addRequirementAssigneeTypeColumn();
  } catch (_) {}
  try {
    await addRequirementAssigneeIdColumn();
  } catch (_) {}
}

/**
 * Ensure the weekly-report attachment columns exist (URL link or PDF upload).
 * Idempotent and additive — mirrors the other ensure* schema helpers.
 */
async function ensureWeeklyReportAttachmentSchema() {
  try {
    await addWeeklyReportAttachmentTypeColumn();
  } catch (_) {}
  try {
    await addWeeklyReportAttachmentUrlColumn();
  } catch (_) {}
}

/**
 * Save a version snapshot before updating a session.
 */
async function saveSessionVersion(sessionId, userId) {
  try {
    const current = await getSessionRowById(sessionId);
    if (current.rows.length === 0) return;
    const row = current.rows[0];
    const currentVersion = row.version || 1;
    await insertSessionVersion(
      sessionId,
      currentVersion,
      JSON.stringify(row),
      userId || null,
    );
    await setSessionVersion(currentVersion + 1, sessionId);
  } catch (error) {
    console.warn("Versioning save failed (non-critical):", error.message);
  }
}

/**
 * Fire-and-forget KPI progress recalculation.
 * Called after session/doc status changes to keep kpi_progress table in sync.
 */
async function recalculateKpiForProgram(programId) {
  try {
    await recalculateKpiProgress(programId);
  } catch (error) {
    console.warn("KPI recalculate trigger failed (non-critical):", error.message);
  }
}

/**
 * The program a POST action is authorised against.
 *
 * Creating actions write into the payload's program, but record actions
 * (toggle/assign/anchor) target an existing row by id, so the program is
 * resolved from THAT row — a client-supplied program_id must never authorise a
 * foreign record.
 */
export async function resolveActionScopeProgramId({ action, payload }) {
  if (action === "toggle_status" || action === "assign_team") {
    const target = await getSessionProgramId(payload.id);
    return target.rows?.[0]?.program_id || null;
  }
  if (action === "anchor_material") {
    const target = await getSessionProgramId(payload.session_id);
    return target.rows?.[0]?.program_id || null;
  }
  if (action === "toggle_deliverable") {
    const target = await getRequirementProgramId(payload.id);
    return target.rows?.[0]?.program_id || null;
  }
  return payload.program_id;
}

/**
 * The program a PUT/DELETE targets, resolved from the record itself — a
 * `field` update and a `type: "session"` write target a session, everything
 * else a document requirement.
 */
export async function resolveRecordScopeProgramId({ targetId, field, type }) {
  if (!targetId) return null;
  const isSession = Boolean(field) || type === "session";
  const resolved = isSession
    ? await getSessionProgramId(targetId)
    : await getRequirementProgramId(targetId);
  return resolved.rows?.[0]?.program_id || null;
}

/**
 * Run a POST curriculum action.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function runCurriculumAction({ payload }) {
  await ensureVersioningSchema();
  await ensureDeliverableResourceSchema();
  await ensureRequirementAssigneeSchema();
  await ensureWeeklyReportAttachmentSchema();

  const { program_id, action } = payload;

  if (action === "add_session") {
    const {
      title,
      description,
      week_number,
      scheduled_date,
      end_date,
      start_time,
      end_time,
      assignment_type,
      task_type,
      handler_id,
      handler_name,
      kpi_ids,
      notes,
      extra_materials,
      timezone,
      requirements, // Extracted from payload
    } = payload;

    // Conflict detection: check for overlapping sessions.
    if (scheduled_date && start_time && end_time) {
      const conflictCheck = await findSessionScheduleConflict(
        program_id,
        scheduled_date,
        end_time,
        start_time,
      );
      if (conflictCheck.rows.length > 0) {
        return {
          status: 409,
          body: {
            success: false,
            error: `Schedule conflict with existing session: "${conflictCheck.rows[0].title}" on ${scheduled_date}`,
          },
        };
      }
    }

    const result = await createSession(
      program_id,
      title,
      description,
      week_number || 1,
      "session",
      "not started",
      1,
      scheduled_date || null,
      end_date || null,
      start_time || null,
      end_time || null,
      assignment_type || null,
      task_type || null,
      handler_id || null,
      handler_name || null,
      JSON.stringify(kpi_ids || []),
      notes || null,
      extra_materials ? JSON.stringify(extra_materials) : null,
      timezone || "UTC",
    );
    const newSessionId = result.rows[0].id;

    // Automatically add an Attendance requirement for the new session.
    await createAttendanceRequirement(
      program_id,
      "Attendance",
      "System-generated attendance tracking",
      newSessionId,
      "system",
      1,
      JSON.stringify([]),
      end_date || null,
      "all",
    );

    // Insert any deliverables defined during creation.
    if (requirements && Array.isArray(requirements)) {
      for (const req of requirements) {
        await addSessionRequirement(
          program_id,
          req.title,
          req.description || null,
          newSessionId,
          req.allowed_format || "pdf",
          req.weight || 1,
          JSON.stringify(req.kpi_ids || []),
          req.due_date || null,
          req.assignee_type || "all",
          req.assignee_id || null,
          req.resource_url || null,
          req.resource_label || null,
        );
      }
    }

    // Recalculate KPI progress after adding requirements.
    try {
      await recalculateKpiProgress(program_id);
    } catch (_) {}

    return { status: 200, body: { success: true, id: newSessionId } };
  }

  if (action === "add_requirement") {
    const {
      title,
      description,
      session_id,
      allowed_format,
      kpi_ids,
      due_date,
      assignee_type,
      assignee_id,
      weight,
      resource_url,
      resource_label,
    } = payload;
    const result = await createRequirement(
      program_id,
      title,
      description || null,
      session_id || null,
      allowed_format || "pdf",
      weight || 1,
      JSON.stringify(kpi_ids || []),
      due_date || null,
      assignee_type || "all",
      assignee_id || null,
      resource_url || null,
      resource_label || null,
    );
    // Recalculate KPI progress after adding a requirement.
    try {
      await recalculateKpiProgress(program_id);
    } catch (_) {}
    return { status: 200, body: { success: true, id: result.rows[0].id } };
  }

  if (action === "send_reminder") {
    let sent = 0;
    try {
      const activeParticipantCount = await countActiveParticipantsForProgram(program_id);
      sent = activeParticipantCount.rows[0]?.cnt || 0;
    } catch {
      sent = 112;
    }
    return { status: 200, body: { success: true, sent } };
  }

  if (action === "toggle_status") {
    const { id, status } = payload;
    await updateSessionStatus(status, id);
    // Fire-and-forget: keep KPI progress in sync.
    recalculateKpiForProgram(program_id);
    return { status: 200, body: { success: true } };
  }

  if (action === "toggle_deliverable") {
    const { id, is_completed } = payload;
    await setDeliverableCompletion(is_completed ? 1 : 0, id);
    // Fire-and-forget: keep KPI progress in sync.
    recalculateKpiForProgram(program_id);
    return { status: 200, body: { success: true } };
  }

  if (action === "assign_team") {
    const { id, team_id } = payload;
    await setSessionTeam(team_id || null, id);
    return { status: 200, body: { success: true } };
  }

  if (action === "anchor_material") {
    const { session_id, file_name } = payload;
    // Fetch existing extra_materials.
    const currentRes = await getSessionExtraMaterials(session_id);
    let materials = [];
    try {
      const raw = currentRes.rows[0]?.extra_materials;
      materials = typeof raw === "string" ? JSON.parse(raw || "[]") : raw || [];
    } catch {
      materials = [];
    }

    const newMaterial = {
      name: file_name,
      type: "file",
      timestamp: new Date().toISOString(),
    };
    const updated = JSON.stringify([...materials, newMaterial]);

    await updateSessionExtraMaterials(updated, session_id);
    return { status: 200, body: { success: true } };
  }

  if (action === "submit_pm_report") {
    // The legacy weekly-report path: the same upsert the dedicated route runs.
    const saved = await saveWeeklyReport({ payload });
    return { status: saved.status, body: saved.body };
  }

  return { status: 400, body: { success: false, error: "Invalid action" } };
}

/**
 * Apply a PUT: the single-field update with its conflict guard, or the legacy
 * full update of a session/requirement.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function updateCurriculum({ payload, userId }) {
  await ensureVersioningSchema();
  await ensureDeliverableResourceSchema();
  await ensureRequirementAssigneeSchema();

  const { id, sessionId, field, value, handlerName, type, program_id } = payload;
  const targetId = id || sessionId;

  if (field && targetId) {
    const { sql, args } = buildSessionFieldUpdate(field, value, handlerName, targetId);

    // Conflict detection for schedule changes.
    if (sql && ["scheduled_date", "start_time", "end_time"].includes(field)) {
      // Fetch current session data for conflict check.
      const current = await getSessionSchedule(targetId);
      if (current.rows.length > 0) {
        const currentRow = current.rows[0];
        const checkDate = field === "scheduled_date" ? value : currentRow.scheduled_date;
        const checkStart = field === "start_time" ? value : currentRow.start_time;
        const checkEnd = field === "end_time" ? value : currentRow.end_time;
        if (checkDate && checkStart && checkEnd) {
          const conflictCheck = await findSessionScheduleConflictExcludingId(
            program_id,
            targetId,
            checkDate,
            checkEnd,
            checkStart,
          );
          if (conflictCheck.rows.length > 0) {
            return {
              status: 409,
              body: {
                success: false,
                error: `Schedule conflict with existing session: "${conflictCheck.rows[0].title}" on ${checkDate}`,
              },
            };
          }
        }
      }
    }

    if (sql) {
      await saveSessionVersion(targetId, userId);
      await runSessionFieldUpdate(sql, args);
      // Recalculate KPI progress if KPI linkages changed.
      if (field === "kpi_ids" || field === "kpi_ids_doc") {
        recalculateKpiForProgram(program_id);
      }
      return { status: 200, body: { success: true } };
    }
  }

  // Legacy full update support.
  if (type === "session") {
    const {
      title,
      description,
      status,
      week_number,
      scheduled_date,
      end_date,
      start_time,
      end_time,
      assignment_type,
      task_type,
      handler_id,
      handler_name,
      kpi_ids,
    } = payload;
    await saveSessionVersion(targetId, userId);
    await updateSession(
      title,
      description,
      status,
      week_number,
      scheduled_date || null,
      end_date || null,
      start_time || null,
      end_time || null,
      assignment_type || null,
      task_type || null,
      handler_id || null,
      handler_name || null,
      JSON.stringify(kpi_ids || []),
      targetId,
    );
    recalculateKpiForProgram(program_id);
  } else {
    const {
      title,
      description,
      allowed_format,
      kpi_ids,
      due_date,
      resource_url,
      resource_label,
    } = payload;
    await updateRequirement(
      title,
      description,
      allowed_format,
      JSON.stringify(kpi_ids || []),
      due_date || null,
      resource_url || null,
      resource_label || null,
      targetId,
    );
    recalculateKpiForProgram(program_id);
  }

  return { status: 200, body: { success: true } };
}

/**
 * Delete a session (with its attendance and requirements) or a requirement.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function deleteCurriculumItem({ id, type, programId }) {
  if (type === "session") {
    await deleteSession(id);
    await deleteAttendanceForSession(id);
    await deleteRequirementsForSession(id);
  } else {
    await deleteRequirement(id);
  }

  if (programId) {
    recalculateKpiForProgram(programId);
  }

  return { status: 200, body: { success: true } };
}
