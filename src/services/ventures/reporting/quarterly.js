/**
 * VENTURE QUARTERLY REPORTING — use cases (spec §9).
 *
 * Same lifecycle, same invariants and same vocabulary as the monthly module:
 *   draft → submitted → validated | rejected, with version N+1 on correction.
 * Reading one module teaches you the other on purpose.
 */

import {
  runInTransaction,
  selectBands,
  selectQuarterlyReports,
  selectQuarterlyVersions,
  selectOpenQuarterly,
  selectNextQuarterVersion,
  insertQuarterlyReport,
  updateOpenQuarterly,
  markQuarterSubmitted,
  supersedeValidatedQuarters,
  markQuarterValidated,
  markQuarterRejected,
  selectQuarterMetrics,
  upsertQuarterMetrics,
  selectValidatedReports,
  selectMetricsSeries,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema, getReportingSettings } from "./settings";
import { dueStateFor } from "./schedule";
import { groupBands } from "./rules";
import { rowToMonthlyInput, dateStringOrNull, shapeMetric } from "./monthlyRules";
import { normalizeQuarter, currentQuarter, validateQuarterlyReport, quarterlyRowValues, rowToQuarterlyInput } from "./quarterlyRules";
import { computeQuarterlyMetrics } from "./quarterlyMetrics";
import { currentReportingCurrency } from "./monthly";

// ── Shaping ────────────────────────────────────────────────────────────────

function shapeQuarterly(row) {
  if (!row) return null;
  const input = rowToQuarterlyInput(row);
  return {
    id: row.id,
    period: input.period,
    version: row.version,
    status: row.status,
    teamConfirmed: input.teamConfirmed,
    mvpMilestonesPlanned: input.mvpMilestonesPlanned,
    mvpMilestonesHit: input.mvpMilestonesHit,
    pilotsSigned: input.pilotsSigned,
    pilotsConverted: input.pilotsConverted,
    channels: input.channels,
    salesMarketing: input.salesMarketing,
    openDeals: input.openDeals,
    salesCycleDays: input.salesCycleDays,
    top3ShareBand: input.top3ShareBand,
    expansion: input.expansion,
    churned: input.churned,
    narrative: input.narrative,
    // The currency this quarter was filed in, frozen at save time.
    currency: input.currency || null,
    submittedAt: row.submitted_at ?? null,
    validatedAt: row.validated_at ?? null,
    rejectedAt: row.rejected_at ?? null,
    rejectionReason: row.rejection_reason ?? null,
    supersededAt: row.superseded_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

const shapeQuarterMetric = (row) => shapeMetric(row);

/**
 * Everything the quarterly figures read, assembled once.
 *
 * The MONTHLY numbers stay the single source: a quarterly metric that needed a
 * monthly figure re-derives it here only to compare it, never to replace it.
 */
async function loadMonthlyContext(ventureUuid) {
  const [reportsResult, seriesResult] = await Promise.all([
    selectValidatedReports(ventureUuid),
    selectMetricsSeries(ventureUuid),
  ]);

  const reportsByPeriod = new Map();
  for (const row of reportsResult.rows || []) {
    const input = rowToMonthlyInput(row);
    if (input?.period) reportsByPeriod.set(input.period, input);
  }

  const metricsByPeriod = new Map();
  for (const row of seriesResult.rows || []) {
    const period = dateStringOrNull(row.reporting_period);
    if (!period) continue;
    if (!metricsByPeriod.has(period)) metricsByPeriod.set(period, {});
    metricsByPeriod.get(period)[row.metric_key] = shapeQuarterMetric(row);
  }

  return { reportsByPeriod, metricsByPeriod };
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listQuarterlyReports({ ventureUuid }) {
  await ensureReportingSchema();
  const result = await selectQuarterlyReports(ventureUuid);
  return { reports: (result.rows || []).map(shapeQuarterly) };
}

export async function getQuarterlyReport({ ventureUuid, period }) {
  await ensureReportingSchema();

  const normalised = normalizeQuarter(period);
  if (!normalised) return { errors: ["venture.reporting.quarterly.validation.period"] };

  const [versionsResult, metricsResult, bandsResult, monthlyContext, reporting] = await Promise.all([
    selectQuarterlyVersions(ventureUuid, normalised),
    selectQuarterMetrics(ventureUuid, normalised),
    selectBands(),
    loadMonthlyContext(ventureUuid),
    getReportingSettings({}),
  ]);

  const versions = versionsResult.rows || [];
  const open = versions.find((row) => row.status === "draft" || row.status === "submitted") || null;
  const validated = versions.find((row) => row.status === "validated" && !row.superseded_at) || null;
  const latest = open || validated || versions[0] || null;
  // The quarter's own currency when it has been filed, else the Venture's
  // current setting (the form has to be labelled in something).
  const currency = latest?.currency
    ? String(latest.currency).toUpperCase()
    : await currentReportingCurrency(ventureUuid);
  const bands = groupBands(bandsResult.rows || []);

  let preview = null;
  if (open) {
    preview = computeQuarterlyMetrics({
      report: rowToQuarterlyInput(open),
      reportsByPeriod: monthlyContext.reportsByPeriod,
      metricsByPeriod: monthlyContext.metricsByPeriod,
      bands,
    });
  }

  return {
    period: normalised,
    currency,
    report: shapeQuarterly(latest),
    open: shapeQuarterly(open),
    validated: shapeQuarterly(validated),
    history: versions.map(shapeQuarterly),
    metrics: (metricsResult.rows || []).map(shapeQuarterMetric),
    bands,
    schedule: dueStateFor({
      period: normalised,
      kind: "quarterly",
      settings: reporting.settings,
      validated: Boolean(validated) && !open,
    }),
    preview,
  };
}

// ── Writes ─────────────────────────────────────────────────────────────────

export async function saveQuarterlyReport({ ventureUuid, ventureCode, actorCid, input = {} }) {
  await ensureReportingSchema();

  const period = normalizeQuarter(input.period);
  if (!period) return { errors: ["venture.reporting.quarterly.validation.period"] };
  if (period > currentQuarter()) {
    return { errors: ["venture.reporting.quarterly.validation.futurePeriod"] };
  }

  const bandsResult = await selectBands();
  const bands = groupBands(bandsResult.rows || []);

  const errors = validateQuarterlyReport(input, { bands });
  if (errors.length) return { errors };

  const submit = input.submit === true || input.submit === "yes";
  // Stamped server-side from the Venture's setting, exactly like the month.
  const currency = await currentReportingCurrency(ventureUuid);
  const values = quarterlyRowValues({ input: { ...input, currency }, actorCid });

  const saved = await runInTransaction(async (query) => {
    const openResult = await selectOpenQuarterly(ventureUuid, period);
    const open = (openResult.rows || [])[0] || null;

    if (open && open.status === "submitted") {
      return { blocked: "venture.reporting.quarterly.validation.alreadySubmitted" };
    }

    if (open) {
      const updated = await updateOpenQuarterly(query, open.id, values);
      const row = (updated.rows || [])[0];
      if (!submit) return { row };
      const moved = await markQuarterSubmitted(query, row.id, actorCid);
      return { row: (moved.rows || [])[0] || row };
    }

    const nextResult = await selectNextQuarterVersion(query, ventureUuid, period);
    const version = Number(nextResult.rows?.[0]?.next_version || 1);
    const inserted = await insertQuarterlyReport(query, {
      ventureUuid,
      ventureCode,
      period,
      version,
      status: "draft",
      ...values,
    });
    const row = (inserted.rows || [])[0];
    if (!submit) return { row };
    const moved = await markQuarterSubmitted(query, row.id, actorCid);
    return { row: (moved.rows || [])[0] || row };
  });

  if (saved.blocked) return { errors: [saved.blocked] };
  return { report: shapeQuarterly(saved.row) };
}

export async function decideQuarterlyReport({ ventureUuid, ventureCode, actorCid, input = {} }) {
  await ensureReportingSchema();

  const period = normalizeQuarter(input.period);
  if (!period) return { errors: ["venture.reporting.quarterly.validation.period"] };

  const action = String(input.action || "").trim();
  if (!["validate", "reject"].includes(action)) {
    return { errors: ["venture.reporting.quarterly.validation.action"] };
  }
  const reason = String(input.reason || "").trim();
  if (action === "reject" && !reason) {
    return { errors: ["venture.reporting.quarterly.validation.reason"] };
  }

  const decided = await runInTransaction(async (query) => {
    const openResult = await selectOpenQuarterly(ventureUuid, period);
    const open = (openResult.rows || [])[0] || null;
    if (!open || open.status !== "submitted") {
      return { blocked: "venture.reporting.quarterly.validation.notSubmitted" };
    }

    if (action === "reject") {
      const rejected = await markQuarterRejected(query, open.id, { actorCid, reason });
      return { row: (rejected.rows || [])[0], recompute: false };
    }

    await supersedeValidatedQuarters(query, {
      ventureUuid,
      period,
      actorCid,
      reason: `Replaced by version ${open.version}`,
    });
    const validated = await markQuarterValidated(query, open.id, actorCid);
    return { row: (validated.rows || [])[0], recompute: true };
  });

  if (decided.blocked) return { errors: [decided.blocked] };

  let metrics = null;
  if (decided.recompute) {
    metrics = await recomputeQuarterlyMetrics({ ventureUuid, ventureCode, period });
  }

  // Same automatic re-evaluation as the monthly path — a validated quarter can
  // satisfy LTV:CAC, which is what unblocks Growth. Caught so it can never
  // undo the validation that triggered it.
  let stage = null;
  if (decided.recompute) {
    try {
      const { refreshStageProposal } = await import("./stage");
      stage = await refreshStageProposal({ ventureUuid, ventureCode, actorCid });
    } catch (error) {
      console.warn("[venture-stage] automatic proposal failed:", error?.message);
    }
  }

  return { report: shapeQuarterly(decided.row), metrics, stage };
}

/**
 * Recompute one quarter from the validated monthly data. Unlike the monthly
 * window there is no look-ahead: a quarter's figures depend only on its own
 * three months (and the month before), so a correction cannot ripple forward.
 */
export async function recomputeQuarterlyMetrics({ ventureUuid, ventureCode, period }) {
  await ensureReportingSchema();

  const [bandsResult, validatedResult, monthlyContext] = await Promise.all([
    selectBands(),
    selectQuarterlyReports(ventureUuid),
    loadMonthlyContext(ventureUuid),
  ]);

  const bands = groupBands(bandsResult.rows || []);
  const periods = new Set((validatedResult.rows || []).map((row) => dateStringOrNull(row.reporting_period)));
  if (!periods.has(period)) return [];

  const row = (validatedResult.rows || []).find(
    (candidate) =>
      dateStringOrNull(candidate.reporting_period) === period &&
      candidate.status === "validated" &&
      !candidate.superseded_at,
  );
  if (!row) return [];

  const metrics = computeQuarterlyMetrics({
    report: rowToQuarterlyInput(row),
    reportsByPeriod: monthlyContext.reportsByPeriod,
    metricsByPeriod: monthlyContext.metricsByPeriod,
    bands,
  });

  await runInTransaction(async (query) => {
    await upsertQuarterMetrics(query, {
      ventureUuid,
      ventureCode,
      period,
      reportId: row.id,
      metrics,
    });
  });

  return [{ period, metrics }];
}
