import {
  getCrmDashboardCounts,
  getCrmOverdueNextActions,
  getCrmStaleOpportunities,
  getCrmStuckOpportunities,
  getCrmPipelineValueByCurrency,
  getCrmPerformance,
} from "@/models/crm/dashboard";

/**
 * CRM — the action dashboard (DECISION / composition layer).
 *
 * The product asks the CRM to say what needs attention now, not to decorate a
 * screen with charts. This module turns the reads into one payload:
 *  - four counts (overdue, next 7 days, awaiting qualification, dormant);
 *  - the most overdue next actions, soonest first;
 *  - the most dormant opportunities;
 *  - opportunities stuck in a stage past that stage's own target;
 *  - active pipeline value, one line per pipeline AND currency;
 *  - performance: won, lost, and the average completed dwell time per stage.
 *
 * `STALE_AFTER_DAYS` is the single place the dormant window is defined. It is
 * 14 days, the figure the product specification uses in its own examples.
 */

export const STALE_AFTER_DAYS = 14;

/**
 * The conversion window. Decided default: the last 90 days, on the moment each
 * opportunity entered its terminal stage. The rate is won ÷ (won + lost) — a
 * denied opportunity is a decision too, so it belongs in the denominator.
 */
export const CONVERSION_WINDOW_DAYS = 90;

const toCount = (value) => Number(value ?? 0) || 0;

/** Group the flat pipeline × currency rows into one entry per pipeline. */
function groupPipelineValues(rows = []) {
  const byPipeline = new Map();

  for (const row of rows) {
    if (!byPipeline.has(row.id)) {
      byPipeline.set(row.id, { id: row.id, name: row.name, values: [], opportunityCount: 0 });
    }
    const pipeline = byPipeline.get(row.id);
    const value = Number(row.value ?? 0) || 0;

    // A pipeline with no valued opportunity comes back as one row with a NULL
    // currency and a zero value: keep the pipeline, drop the empty line.
    if (row.currency || value > 0) {
      pipeline.values.push({ currency: row.currency ?? null, value });
      pipeline.opportunityCount += toCount(row.opportunity_count);
    }
  }

  return [...byPipeline.values()].filter((pipeline) => pipeline.values.length > 0);
}

export async function getCrmDashboard() {
  const [countsResult, overdueResult, staleResult, stuckResult, pipelineResult, performanceResult] =
    await Promise.all([
      getCrmDashboardCounts(),
      getCrmOverdueNextActions(5),
      getCrmStaleOpportunities(5),
      getCrmStuckOpportunities(5),
      getCrmPipelineValueByCurrency(),
      getCrmPerformance(),
    ]);

  const counts = countsResult.rows?.[0] ?? {};
  const performance = performanceResult.rows?.[0] ?? {};
  const averageStageDays =
    performance.avg_stage_days == null ? null : Number(performance.avg_stage_days);

  const wonRecently = toCount(performance.won_90);
  const lostRecently = toCount(performance.lost_90);
  const decided = wonRecently + lostRecently;

  return {
    staleAfterDays: STALE_AFTER_DAYS,
    counts: {
      overdue: toCount(counts.overdue_leads) + toCount(counts.overdue_opportunities),
      dueSoon: toCount(counts.soon_leads) + toCount(counts.soon_opportunities),
      awaitingQualification: toCount(counts.awaiting_qualification),
      stale: toCount(counts.stale_opportunities),
      stuck: toCount(counts.stuck_opportunities),
    },
    overdue: overdueResult.rows ?? [],
    stale: staleResult.rows ?? [],
    // Numeric columns arrive as text from the driver; the screen formats numbers.
    stuck: (stuckResult.rows ?? []).map((row) => ({
      ...row,
      days_in_stage: toCount(row.days_in_stage),
      target_days: toCount(row.target_days),
    })),
    pipelines: groupPipelineValues(pipelineResult.rows ?? []),
    performance: {
      won: toCount(performance.won),
      lost: toCount(performance.lost),
      // One decimal is enough to read a trend; null means "no completed visit yet".
      averageStageDays:
        averageStageDays == null || Number.isNaN(averageStageDays)
          ? null
          : Math.round(averageStageDays * 10) / 10,
      completedTransitions: toCount(performance.completed_transitions),
      conversion: {
        windowDays: CONVERSION_WINDOW_DAYS,
        won: wonRecently,
        lost: lostRecently,
        // 0..1, or null when nothing was decided inside the window.
        rate: decided === 0 ? null : Math.round((wonRecently / decided) * 1000) / 1000,
      },
    },
  };
}
