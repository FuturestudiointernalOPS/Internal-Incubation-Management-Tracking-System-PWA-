/**
 * Admin project updates — the weekly narrative read and upsert (SERVICE
 * layer).
 *
 * The work behind `GET`/`POST /api/admin/projects/[id]/updates`: the week/year
 * framing, the upsert on project + week + year, and the partial-field update.
 *
 * HTTP-free: it reads and writes through `@/models/projects`; answers
 * `{ status, body }`. The controller keeps `initDb`, the project-scope guard and
 * the envelope.
 */

import {
  createProjectUpdate,
  findProjectUpdateId,
  getProjectUpdates,
  updateProjectUpdate,
} from "@/models/projects";
import { getWeekNumber } from "@/services/dashboard/weeks";

/** Every weekly update for a project, newest first. */
export async function listProjectUpdates(projectId) {
  const result = await getProjectUpdates(projectId);
  return { status: 200, body: { success: true, updates: result.rows } };
}

/** Create or update this week's narrative (upsert on project + week + year). */
export async function saveProjectUpdate({ projectId, payload }) {
  const { user_id } = payload;

  if (!user_id) {
    return {
      status: 400,
      body: { success: false, error: "user_id is required" },
    };
  }

  const currentWeek = payload.week_number || getWeekNumber(new Date());
  const currentYear = payload.year || new Date().getFullYear();

  const existing = await findProjectUpdateId(projectId, currentWeek, currentYear);

  if (existing.rows.length > 0) {
    const updateFields = [];
    const updateArgs = [];

    const fields = {
      accomplishments: payload.accomplishments,
      current_focus: payload.current_focus,
      blockers: payload.blockers,
      next_steps: payload.next_steps,
      overall_status: payload.overall_status,
      notes: payload.notes,
      status: payload.status,
      user_name: payload.user_name,
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateArgs.push(value);
      }
    }

    if (updateFields.length > 0) {
      updateFields.push("updated_at = CURRENT_TIMESTAMP");
      updateArgs.push(existing.rows[0].id);
      await updateProjectUpdate(updateFields, updateArgs);
    }

    return {
      status: 200,
      body: {
        success: true,
        id: existing.rows[0].id,
        action: "updated",
        week_number: currentWeek,
        year: currentYear,
      },
    };
  }

  const result = await createProjectUpdate(
    projectId,
    user_id,
    payload.user_name,
    currentWeek,
    currentYear,
    payload.status,
    payload.accomplishments,
    payload.current_focus,
    payload.blockers,
    payload.next_steps,
    payload.overall_status,
    payload.notes,
  );

  return {
    status: 200,
    body: {
      success: true,
      id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
      action: "created",
      week_number: currentWeek,
      year: currentYear,
    },
  };
}
