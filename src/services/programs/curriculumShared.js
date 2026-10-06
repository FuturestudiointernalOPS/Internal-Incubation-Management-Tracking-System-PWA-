/**
 * Programs — the side-effect helpers the curriculum write paths share
 * (SERVICE layer).
 *
 * `saveSessionVersion` snapshots a session before it is updated (a versioning
 * failure is non-critical and only warned). `recalculateKpiForProgram` is the
 * fire-and-forget KPI-progress refresh the session/requirement writes trigger to
 * keep `kpi_progress` in sync — also non-critical when it fails.
 *
 * Layer (see docs/LAYER_SPLIT.md): orchestration, no SQL, no HTTP. It reads and
 * writes through `@/models/**`.
 */

import {
  recalculateKpiProgress,
} from "@/services/programs/kpiProgress";
import {
  getSessionRowById,
  insertSessionVersion,
  setSessionVersion,
} from "@/models/curriculum";

/** Save a version snapshot before updating a session. */
export async function saveSessionVersion(sessionId, userId) {
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
export async function recalculateKpiForProgram(programId) {
  try {
    await recalculateKpiProgress(programId);
  } catch (error) {
    console.warn("KPI recalculate trigger failed (non-critical):", error.message);
  }
}
