/**
 * Programs — the DELETE curriculum write (SERVICE layer).
 *
 * The domain work behind `DELETE /api/pm/curriculum`: the per-type cascade
 * (a session takes its attendance and requirements with it) and the KPI-progress
 * refresh. The CONTROLLER keeps authentication, the `programs.edit` capability,
 * the `wave: "content"` record scope and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It writes through `@/models/**`.
 */

import {
  deleteAttendanceForSession,
  deleteRequirement,
  deleteRequirementsForSession,
  deleteSession,
} from "@/models/curriculum";
import { recalculateKpiForProgram } from "./curriculumShared";

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
