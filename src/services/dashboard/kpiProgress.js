/**
 * KPI progress — the persisted-objective read and the recalculation summary
 * (SERVICE layer).
 *
 * The work behind `GET /api/kpi-progress` and
 * `POST /api/kpi-progress/recalculate`: the schema-drift fallback, the
 * on-the-fly recalculation when nothing is persisted, the measurable-only
 * average that is the programme figure, and the `source` label the read answers
 * with.
 *
 * HTTP-free: the persisted rows come from `@/models/platformConfig` and the
 * recalculation itself from `@/services/programs/kpiProgress`. Answers
 * `{ status, body }`; the controller keeps the roles gate and the envelope.
 */

import { getKpiProgressByProgramId } from "@/models/platformConfig";
import { recalculateKpiProgress } from "@/services/programs/kpiProgress";

/** The plain average of the entries' completion rates, 0 when there are none. */
function averageCompletion(entries) {
  return entries.length > 0
    ? Math.round(
        entries.reduce(
          (sum, entry) => sum + (parseFloat(entry.completion_rate) || 0),
          0,
        ) / entries.length,
      )
    : 0;
}

/**
 * The program's persisted objective progress, recalculated on the fly when the
 * cache is empty.
 */
export async function getKpiProgress(programId) {
  if (!programId) {
    return {
      status: 400,
      body: { success: false, error: "program_id is required" },
    };
  }

  let entries;
  try {
    const result = await getKpiProgressByProgramId(programId);
    entries = result.rows || [];
  } catch {
    // kpi_progress schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 11
    return {
      status: 200,
      body: {
        success: true,
        kpiProgress: [],
        overallProgress: 0,
        source: "unavailable",
      },
    };
  }

  // If no persisted data exists, calculate on the fly and persist it.
  if (entries.length === 0) {
    try {
      entries = await recalculateKpiProgress(programId);
    } catch (error) {
      console.warn("KPI auto-recalculate failed, returning empty:", error);
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      kpiProgress: entries,
      overallProgress: averageCompletion(entries),
      source: entries.length > 0 ? "persisted" : "empty",
    },
  };
}

/**
 * Recalculate and summarise: objectives weigh the same, so the programme figure
 * is their plain average. Non-measurable objectives (no linked deliverable) are
 * left out of the average rather than reading as 0 %.
 */
export async function recalculateAndSummarize(programId) {
  if (!programId) {
    return {
      status: 400,
      body: { success: false, error: "program_id is required" },
    };
  }

  const entries = await recalculateKpiProgress(programId);
  const measurableEntries = entries.filter((entry) => entry.measurable !== false);

  return {
    status: 200,
    body: {
      success: true,
      kpiProgress: entries,
      overallProgress: averageCompletion(measurableEntries),
    },
  };
}
