/**
 * Programs — the PUT curriculum write (SERVICE layer).
 *
 * The domain work behind `PUT /api/pm/curriculum`: the single-field update with
 * its schedule-conflict guard and version snapshot, or the legacy full update of
 * a session/requirement. The CONTROLLER keeps authentication, the `programs.edit`
 * capability, the `wave: "content"` record scope and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  buildSessionFieldUpdate,
  findSessionScheduleConflictExcludingId,
  getSessionSchedule,
  runSessionFieldUpdate,
  updateRequirement,
  updateSession,
} from "@/models/curriculum";
import {
  ensureDeliverableResourceSchema,
  ensureRequirementAssigneeSchema,
  ensureVersioningSchema,
} from "./curriculumSchema";
import { recalculateKpiForProgram, saveSessionVersion } from "./curriculumShared";

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
