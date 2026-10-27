import {
  getCrmDashboardCounts,
  getCrmOverdueNextActions,
  getCrmStaleOpportunities,
  getCrmPipelineValueByCurrency,
} from "@/models/crm/dashboard";

/**
 * CRM — the action dashboard (DECISION / composition layer).
 *
 * The product asks the CRM to say what needs attention now, not to decorate a
 * screen with charts. This module turns the reads into one payload:
 *  - four counts (overdue, next 7 days, awaiting qualification, dormant);
 *  - the most overdue next actions, soonest first;
 *  - the most dormant opportunities;
 *  - active pipeline value, one line per pipeline AND currency.
 *
 * `STALE_AFTER_DAYS` is the single place the dormant window is defined. It is
 * 14 days, the figure the product specification uses in its own examples.
 */

export const STALE_AFTER_DAYS = 14;

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
  const [countsResult, overdueResult, staleResult, pipelineResult] = await Promise.all([
    getCrmDashboardCounts(),
    getCrmOverdueNextActions(5),
    getCrmStaleOpportunities(5),
    getCrmPipelineValueByCurrency(),
  ]);

  const counts = countsResult.rows?.[0] ?? {};

  return {
    staleAfterDays: STALE_AFTER_DAYS,
    counts: {
      overdue: toCount(counts.overdue_leads) + toCount(counts.overdue_opportunities),
      dueSoon: toCount(counts.soon_leads) + toCount(counts.soon_opportunities),
      awaitingQualification: toCount(counts.awaiting_qualification),
      stale: toCount(counts.stale_opportunities),
    },
    overdue: overdueResult.rows ?? [],
    stale: staleResult.rows ?? [],
    pipelines: groupPipelineValues(pipelineResult.rows ?? []),
  };
}
