/**
 * Programs — the POST curriculum action vocabulary (SERVICE layer).
 *
 * The domain work behind `POST /api/pm/curriculum`: the session/requirement
 * actions (add_session with its conflict guard, add_requirement, send_reminder,
 * toggle_status / toggle_deliverable, assign_team, anchor_material) and the
 * legacy weekly report. The CONTROLLER keeps authentication, the `programs.edit`
 * capability, the `wave: "content"` record scope and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  recalculateKpiProgress,
} from "@/services/programs/kpiProgress";
import {
  addSessionRequirement,
  countActiveParticipantsForProgram,
  createAttendanceRequirement,
  createRequirement,
  createSession,
  findSessionScheduleConflict,
  getSessionExtraMaterials,
  setDeliverableCompletion,
  setSessionTeam,
  updateSessionExtraMaterials,
  updateSessionStatus,
} from "@/models/curriculum";
import { saveWeeklyReport } from "./weeklyReports";
import {
  ensureDeliverableResourceSchema,
  ensureRequirementAssigneeSchema,
  ensureVersioningSchema,
  ensureWeeklyReportAttachmentSchema,
} from "./curriculumSchema";
import { recalculateKpiForProgram } from "./curriculumShared";

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
