/**
 * PORTFOLIO ROLL-UPS — spec §14.
 *
 * "These come from the same data, with no new forms."
 *
 * Every figure below is a fold over rows that already exist. Nothing here is
 * stored, so nothing here can drift from the records it is derived from: the
 * portfolio is recomputed on read, from the same validated months, stage
 * history and event log the Venture's own dashboard reads.
 *
 * Three rules carried over from the rest of the engine:
 *   • a denominator of zero yields `null`, never 0 and never Infinity;
 *   • a band-derived amount stays flagged approximate all the way to the total;
 *   • a Venture with no data is counted as `unknown`, never as a failure.
 */

import {
  selectPortfolioVentures,
  selectPortfolioFirstPayingMonth,
  selectPortfolioLatestMonths,
  selectPortfolioLatestMetrics,
  selectPortfolioLatestTeams,
  selectPortfolioBaselines,
  selectPortfolioFinancingEvents,
  selectPortfolioStageHistory,
  selectPortfolioStatusEvents,
  selectPortfolioMilestoneStats,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema, getReportingSettings } from "./settings";
import { moneyBounds } from "./metrics";
import { numericOrNull } from "./monthlyRules";
import { survivalAt, timeInStages, monthsBetween } from "./yearly";
import { evaluateTrafficLight, GREEN, AMBER, RED, UNKNOWN } from "./trafficLight";
import { STAGES } from "./stageCriteria";

const dayMs = 24 * 60 * 60 * 1000;

/** Ratio, or `null` when the denominator is zero. */
const ratio = (part, whole) => (whole > 0 ? part / whole : null);

/** Days between two dates, floored at 0, or `null` when either is unusable. */
function daysBetween(from, to) {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) / dayMs));
}

function average(values) {
  const known = values.filter((value) => value !== null && value !== undefined);
  return known.length ? known.reduce((total, value) => total + value, 0) / known.length : null;
}

function median(values) {
  const known = values
    .filter((value) => value !== null && value !== undefined)
    .sort((a, b) => a - b);
  if (!known.length) return null;
  const middle = Math.floor(known.length / 2);
  return known.length % 2 ? known[middle] : (known[middle - 1] + known[middle]) / 2;
}

/** Group `rows` by a key, without ever returning undefined. */
function groupBy(rows, keyOf) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

/** A stage a Venture actually carries, or `unset` — never an invented default. */
const stageOrUnset = (stage) => (STAGES.includes(stage) ? stage : "unset");

/**
 * @param {{ now?: Date }} options
 */
export async function getPortfolioRollup({ now = new Date() } = {}) {
  await ensureReportingSchema();

  // The roll-up evaluates every Venture's traffic light, which is a per-model
  // rule. `default` is the studio baseline; the per-model overrides only ever
  // refine a single Venture, and the aggregate shows the baseline.
  const settingsBundle = await getReportingSettings({ businessModel: "default" });
  const { settings, bands } = settingsBundle;

  const [
    venturesResult,
    firstPayingResult,
    latestMonthResult,
    latestMetricResult,
    teamsResult,
    baselineResult,
    financingResult,
    historyResult,
    statusResult,
    milestoneResult,
  ] = await Promise.all([
    selectPortfolioVentures(),
    selectPortfolioFirstPayingMonth(),
    selectPortfolioLatestMonths(),
    selectPortfolioLatestMetrics(),
    selectPortfolioLatestTeams(),
    selectPortfolioBaselines(),
    selectPortfolioFinancingEvents(),
    selectPortfolioStageHistory(),
    selectPortfolioStatusEvents(),
    selectPortfolioMilestoneStats(),
  ]);

  const ventures = venturesResult.rows || [];
  const ventureIds = new Set(ventures.map((venture) => venture.id));

  // ── Stage distribution ────────────────────────────────────────────────────
  const byStage = new Map(STAGES.map((stage) => [stage, 0]));
  byStage.set("unset", 0);
  for (const venture of ventures) {
    const stage = stageOrUnset(venture.business_stage);
    byStage.set(stage, (byStage.get(stage) || 0) + 1);
  }
  const stages = [...STAGES, "unset"].map((stage) => ({ stage, total: byStage.get(stage) || 0 }));

  // ── Inputs, indexed by Venture ────────────────────────────────────────────
  const firstPaying = new Map(
    (firstPayingResult.rows || []).map((row) => [row.venture_uuid, row.first_period]),
  );
  const latestMonth = new Map(
    (latestMonthResult.rows || []).map((row) => [row.venture_uuid, row]),
  );
  const metricOf = new Map();
  for (const row of latestMetricResult.rows || []) {
    if (!metricOf.has(row.venture_uuid)) metricOf.set(row.venture_uuid, {});
    metricOf.get(row.venture_uuid)[row.metric_key] = numericOrNull(row.value);
  }
  const teams = new Map((teamsResult.rows || []).map((row) => [row.venture_uuid, row]));
  const baselines = new Map(
    (baselineResult.rows || []).map((row) => [row.venture_uuid, numericOrNull(row.fte)]),
  );
  const milestones = new Map(
    (milestoneResult.rows || []).map((row) => [
      row.venture_uuid,
      { dueTotal: Number(row.due_total || 0), onTime: Number(row.on_time || 0) },
    ]),
  );
  const statusesByVenture = groupBy(
    (statusResult.rows || []).filter((row) => ventureIds.has(row.venture_uuid)),
    (row) => row.venture_uuid,
  );

  // ── Health: the traffic-light mix (§11, §14) ──────────────────────────────
  const lightMix = { [GREEN]: 0, [AMBER]: 0, [RED]: 0, [UNKNOWN]: 0 };
  for (const venture of ventures) {
    const metrics = metricOf.get(venture.id) || {};
    const light = evaluateTrafficLight({
      runwayMonths: metrics.runway_months ?? null,
      customerGrowth:
        metrics.customer_growth_3m === null || metrics.customer_growth_3m === undefined
          ? null
          : metrics.customer_growth_3m * 100,
      milestones: milestones.get(venture.id) || null,
      settings,
    });
    lightMix[light.overall] = (lightMix[light.overall] || 0) + 1;
  }

  // ── Time in stage ─────────────────────────────────────────────────────────
  const historyByVenture = groupBy(
    (historyResult.rows || []).filter((row) => ventureIds.has(row.venture_uuid)),
    (row) => row.venture_uuid,
  );
  const stageDays = new Map();
  for (const [ventureUuid, rows] of historyByVenture) {
    if (!ventureIds.has(ventureUuid)) continue;
    for (const entry of timeInStages(
      rows.map((row) => ({ toStage: row.to_stage, decidedAt: row.decided_at })),
      now,
    )) {
      if (!stageDays.has(entry.stage)) stageDays.set(entry.stage, []);
      stageDays.get(entry.stage).push(entry.days);
    }
  }
  const timeInStage = STAGES.map((stage) => {
    const values = stageDays.get(stage) || [];
    return {
      stage,
      ventures: values.length,
      averageDays: average(values),
      medianDays: median(values),
    };
  });

  // ── Time to first paying customer ─────────────────────────────────────────
  const toFirstPaying = [];
  for (const venture of ventures) {
    const firstPeriod = firstPaying.get(venture.id);
    if (!firstPeriod || !venture.created_at) continue;
    const days = daysBetween(venture.created_at, firstPeriod);
    if (days !== null) toFirstPaying.push(days);
  }

  // ── Survival ──────────────────────────────────────────────────────────────
  const survival = {};
  for (const threshold of [12, 24, 36]) {
    const eligible = [];
    for (const venture of ventures) {
      const monthsAlive = monthsBetween(venture.created_at, now);
      const statuses = (statusesByVenture.get(venture.id) || []).map((row) => ({
        status: row.status_to,
        date: row.event_date,
      }));
      const verdict = survivalAt(monthsAlive, statuses)[`m${threshold}`];
      // `null` means the Venture is too young to judge — it is not a failure.
      if (verdict !== null) eligible.push(verdict);
    }
    const survived = eligible.filter(Boolean).length;
    survival[`m${threshold}`] = {
      eligible: eligible.length,
      survived,
      rate: ratio(survived, eligible.length),
    };
  }

  // ── Follow-on capital (financing recorded in the event log) ───────────────
  const financingByVenture = groupBy(
    (financingResult.rows || []).filter((row) => ventureIds.has(row.venture_uuid)),
    (row) => row.venture_uuid,
  );
  const financingByType = new Map();
  let financingTotal = 0;
  let financingKnown = false;
  let financingApproximate = false;

  for (const rows of financingByVenture.values()) {
    for (const row of rows) {
      const bounds = moneyBounds(
        { mode: row.amount_mode, value: numericOrNull(row.amount_value), band: row.amount_band },
        "flow",
        bands,
      );
      if (!bounds) {
        // An unfilled amount is not a zero: it is a financing event we cannot count.
        financingApproximate = true;
        continue;
      }
      const amount = (bounds.low + bounds.high) / 2;
      financingTotal += amount;
      financingKnown = true;
      financingApproximate = financingApproximate || bounds.approximate;

      const type = row.financing_type || "other";
      if (!financingByType.has(type)) {
        financingByType.set(type, { type, total: 0, count: 0, approximate: false });
      }
      const bucket = financingByType.get(type);
      bucket.total += amount;
      bucket.count += 1;
      bucket.approximate = bucket.approximate || bounds.approximate;
    }
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────
  let fteTotal = 0;
  let fteKnown = 0;
  let jobsCreated = 0;
  let jobsCreatedKnown = 0;
  for (const venture of ventures) {
    const fte = metricOf.get(venture.id)?.fte ?? null;
    if (fte === null) continue;
    fteTotal += fte;
    fteKnown += 1;
    const baselineFte = baselines.get(venture.id);
    if (baselineFte !== null && baselineFte !== undefined) {
      jobsCreated += fte - baselineFte;
      jobsCreatedKnown += 1;
    }
  }

  // ── Team composition (raw counts, so the share is portfolio-wide) ─────────
  let women = 0;
  let men = 0;
  let youth = 0;
  for (const row of teams.values()) {
    if (!ventureIds.has(row.venture_uuid)) continue;
    women += Number(row.women_employees || 0);
    men += Number(row.men_employees || 0);
    youth += Number(row.under35_women || 0) + Number(row.under35_men || 0);
  }
  const members = women + men;

  // ── Funnel: Ventures → Ventures with a paying customer ────────────────────
  const withPayingCustomer = ventures.filter((venture) => {
    const row = latestMonth.get(venture.id);
    return row && Number(row.paying_customers || 0) > 0;
  }).length;

  return {
    generatedAt: now.toISOString(),
    totalVentures: ventures.length,
    stages,
    trafficLight: {
      green: lightMix[GREEN] || 0,
      amber: lightMix[AMBER] || 0,
      red: lightMix[RED] || 0,
      unknown: lightMix[UNKNOWN] || 0,
    },
    timeInStage,
    timeToFirstPaying: {
      ventures: toFirstPaying.length,
      averageDays: average(toFirstPaying),
      medianDays: median(toFirstPaying),
    },
    survival,
    financing: {
      total: financingKnown ? financingTotal : null,
      approximate: financingApproximate,
      ventures: financingByVenture.size,
      byType: [...financingByType.values()].sort((a, b) => b.total - a.total),
    },
    jobs: {
      fte: fteKnown ? fteTotal : null,
      venturesReportingFte: fteKnown,
      created: jobsCreatedKnown ? jobsCreated : null,
      venturesWithBaseline: jobsCreatedKnown,
    },
    team: {
      members,
      womenShare: members > 0 ? Math.round((women / members) * 100) : null,
      youthShare: members > 0 ? Math.round((youth / members) * 100) : null,
    },
    funnel: {
      ventures: ventures.length,
      withPayingCustomer,
      // Participant → Venture conversion is the participant module's record, not
      // this one's. Left explicitly null rather than guessed.
      participants: null,
    },
  };
}
