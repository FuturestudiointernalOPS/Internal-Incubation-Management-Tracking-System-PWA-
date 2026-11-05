/**
 * THE VENTURE DASHBOARD — spec §12.
 *
 * Reads the CALCULATED layer only (`venture_metrics_monthly`) plus the validated
 * monthly reports for the raw counts and the north-star value. It never reads a
 * draft, and it never computes a metric itself: if a figure is not in the
 * metrics table, it shows as "not applicable" rather than inventing one.
 *
 * Series are ordered oldest → newest, ready to chart.
 */

import {
  selectCurrentProfile,
  selectValidatedReports,
  selectMetricsSeries,
  selectLatestTeamSnapshot,
  selectActiveBaseline,
  selectStageHistory,
  selectEvents,
  selectVentureCreatedAt,
  selectValidatedQuarters,
  selectCurrentFounders,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema, getReportingSettings } from "./settings";
import { rowToMonthlyInput, dateStringOrNull, shapeMetric, numericOrNull } from "./monthlyRules";
import { computeHeadcount, computeTeamShares } from "./rules";
import { settingValue } from "./settingDefinitions";
import { moneyBounds } from "./metrics";
import { computeYearlyFigures, survivalAt, timeInStages, monthsBetween } from "./yearly";
import { getStageStatus } from "./stage";

/** A stored metric as a chart point: value, or its range when it was a band. */
const pointOf = (metricsByPeriod, period, key, currency) => {
  const metric = metricsByPeriod.get(period)?.[key] || null;
  if (!metric || metric.status !== "computed") {
    return {
      currency,
      value: null,
      low: null,
      high: null,
      approximate: false,
      status: metric?.status || "not_applicable",
    };
  }
  return {
    currency,
    value: metric.value,
    low: metric.valueLow,
    high: metric.valueHigh,
    approximate: metric.approximate,
    status: "computed",
  };
};

export async function getVentureDashboard({ ventureUuid }) {
  await ensureReportingSchema();

  const [profileResult, reportsResult, seriesResult, teamResult, stage, baselineResult, historyResult, eventsResult, createdResult, quartersResult, foundersResult] =
    await Promise.all([
      selectCurrentProfile(ventureUuid),
      selectValidatedReports(ventureUuid),
      selectMetricsSeries(ventureUuid),
      selectLatestTeamSnapshot(ventureUuid),
      getStageStatus({ ventureUuid }),
      selectActiveBaseline(ventureUuid),
      selectStageHistory(ventureUuid),
      selectEvents(ventureUuid),
      selectVentureCreatedAt(ventureUuid),
      selectValidatedQuarters(ventureUuid).catch(() => ({ rows: [] })),
      selectCurrentFounders(ventureUuid).catch(() => ({ rows: [] })),
    ]);

  const profileRow = (profileResult.rows || [])[0] || null;
  // The Venture's CURRENT setting — the fallback for months filed before the
  // currency was recorded on the row.
  const activeCurrency = String(profileRow?.reporting_currency || "XOF").toUpperCase();
  // Bands are already grouped by `getReportingSettings` — and they are grouped
  // FOR THIS VENTURE'S CURRENCY. A ladder defined in CFA can never measure a
  // report filed in USD; when the currency has no ladder, the list is empty and
  // a band answer evaluates to `not_applicable` instead of a wrong number.
  const settings = await getReportingSettings({
    businessModel: profileRow?.business_model || "default",
    currency: activeCurrency,
  });
  const groupedBands = settings.bands || { flow: [], cash: [] };

  const metricsByPeriod = new Map();
  for (const row of seriesResult.rows || []) {
    const period = dateStringOrNull(row.reporting_period);
    if (!period) continue;
    if (!metricsByPeriod.has(period)) metricsByPeriod.set(period, {});
    metricsByPeriod.get(period)[row.metric_key] = shapeMetric(row);
  }

  const reports = (reportsResult.rows || [])
    .map(rowToMonthlyInput)
    .filter(Boolean)
    .sort((a, b) => (a.period < b.period ? -1 : 1));

  const months = reports.map((month) => {
    // The currency THIS month was filed in — not the Venture's current setting.
    // Rows written before the stamp existed fall back to the current one.
    const monthCurrency = month.currency || activeCurrency;
    return {
      period: month.period,
      currency: monthCurrency,
      payingCustomers: month.payingCustomers,
      newPayingCustomers: month.newPayingCustomers,
      northStarValue: month.northStarValue,
      lostCustomers: pointOf(metricsByPeriod, month.period, "lost_customers", monthCurrency).value,
      retention: pointOf(metricsByPeriod, month.period, "retention", monthCurrency),
      totalRevenue: pointOf(metricsByPeriod, month.period, "total_revenue", monthCurrency),
      netBurn: pointOf(metricsByPeriod, month.period, "net_burn", monthCurrency),
      runway: pointOf(metricsByPeriod, month.period, "runway_months", monthCurrency),
      fte: pointOf(metricsByPeriod, month.period, "fte", monthCurrency),
      // The rest of the calculated layer: read by the studio's business snapshot.
      // Still "nothing recomputed here" — these are stored metrics, not sums.
      arpu: pointOf(metricsByPeriod, month.period, "arpu", monthCurrency),
      ltvCac: pointOf(metricsByPeriod, month.period, "ltv_cac", monthCurrency),
      cacPayback: pointOf(metricsByPeriod, month.period, "cac_payback_months", monthCurrency),
      magicNumber: pointOf(metricsByPeriod, month.period, "magic_number", monthCurrency),
      burnMultiple: pointOf(metricsByPeriod, month.period, "burn_multiple", monthCurrency),
      grossMargin: pointOf(metricsByPeriod, month.period, "gross_margin", monthCurrency),
      churnRate: pointOf(metricsByPeriod, month.period, "churn_rate", monthCurrency),
      mrrGrowth3m: pointOf(metricsByPeriod, month.period, "mrr_growth_3m", monthCurrency),
      // Customer growth is the traffic light's own input; the studio's reading
      // shows it beside revenue growth so the two can never be confused.
      customerGrowth3m: pointOf(metricsByPeriod, month.period, "customer_growth_3m", monthCurrency),
    };
  });

  const latest = months[months.length - 1] || null;
  const latestReport = reports[reports.length - 1] || null;

  const teamRow = (teamResult.rows || [])[0] || null;
  // "Women-led" is a FOUNDING fact, not a headcount fact: a Venture with one
  // woman among forty employees is not women-led. It needs the founder records.
  const founders = (foundersResult.rows || []).map((row) => ({ gender: row.gender }));
  const shares = teamRow ? computeTeamShares(teamRow, founders) : null;
  // People on the books, beside the FTE. They answer different questions: ten
  // part-timers are ten people and possibly two full-time equivalents.
  const headcount = teamRow
    ? computeHeadcount({
        fullTime: teamRow.full_time_employees,
        partTime: teamRow.part_time_employees,
        fullTimeFounders: teamRow.full_time_founders,
      })
    : null;

  // ── Yearly roll-ups (§10) ──────────────────────────────────────────────
  const yearlyMonths = reports.map((month) => {
    const mrr = moneyBounds(month.mrr, "flow", groupedBands);
    const netBurn = metricsByPeriod.get(month.period)?.net_burn;
    return {
      period: month.period,
      // The rolling totals are withheld when the window spans currencies, so the
      // engine needs the unit each month was filed in.
      currency: month.currency || activeCurrency,
      mrrValue: mrr ? (mrr.low + mrr.high) / 2 : null,
      payingCustomers: month.payingCustomers,
      netBurn: netBurn && netBurn.status === "computed" ? Number(netBurn.value) : null,
    };
  });

  const yearlyFigures = computeYearlyFigures({
    months: yearlyMonths,
    latestPeriod: latest?.period || null,
    latestFte: latest?.fte?.value ?? null,
    baselineFte: baselineResult.rows?.[0]?.fte ? Number(baselineResult.rows[0].fte) : null,
  });

  const events = eventsResult.rows || [];
  const financing = events.filter((event) => event.event_type === "financing_received");
  let financingTotal = null;
  let financingApproximate = false;
  for (const event of financing) {
    const bounds = moneyBounds(
      { mode: event.amount_mode, value: numericOrNull(event.amount_value), band: event.amount_band },
      "flow",
      groupedBands,
    );
    if (!bounds) continue;
    financingApproximate = financingApproximate || bounds.approximate;
    financingTotal = (financingTotal || 0) + (bounds.low + bounds.high) / 2;
  }

  const createdAt = createdResult.rows?.[0]?.created_at || null;
  const monthsAlive = monthsBetween(createdAt);
  const statusEvents = events
    .filter((event) => event.event_type === "status_change" && event.status_to)
    .map((event) => ({ status: event.status_to, date: dateStringOrNull(event.event_date) }));

  const yearly = {
    ...yearlyFigures,
    outsideFinancing: financing.length ? { total: financingTotal, approximate: financingApproximate } : null,
    survival: survivalAt(monthsAlive, statusEvents),
    monthsAlive,
    timeInStages: timeInStages(
      (historyResult.rows || []).map((row) => ({
        toStage: row.to_stage,
        decidedAt: row.decided_at,
      })),
    ),
    womenShare: shares?.womenShare ?? null,
    youthShare: shares?.youthShare ?? null,
    womenLed: shares?.womenLed ?? null,
    womenFounders: shares?.womenFounders ?? null,
    founderCount: shares?.founderCount ?? null,
    headcount,
  };

  // ── Customer concentration ──────────────────────────────────────────────
  // The share of revenue the top three customers hold is asked QUARTERLY, so
  // the most recent validated quarter that answered it is the one that counts.
  // A quarter that left it blank does not erase the answer before it.
  let concentration = null;
  const quarters = quartersResult.rows || [];
  for (let index = quarters.length - 1; index >= 0; index -= 1) {
    const band = quarters[index]?.top3_share_band;
    if (!band) continue;
    concentration = { band, period: dateStringOrNull(quarters[index].reporting_period) || null };
    break;
  }

  return {
    // The studio's own thresholds, so a screen can state "below the 9-month
    // line" instead of hard-coding a number the settings already own. Every one
    // goes through `settingValue`, which applies the definition's fallback — so
    // a studio that has never opened the settings screen still gets the spec's
    // numbers, and one that has gets its own.
    thresholds: {
      runwayGreenMonths: settingValue(settings.settings, "traffic_runway_green_months"),
      runwayAmberMonths: settingValue(settings.settings, "traffic_runway_amber_months"),
      growthGreenPct: settingValue(settings.settings, "traffic_growth_green_pct"),
      // The business reading's four (verdict + risk panel).
      readingGrowthGreenPct: settingValue(settings.settings, "reading_growth_green_pct"),
      readingGrowthRedPct: settingValue(settings.settings, "reading_growth_red_pct"),
      retentionFloorPct: settingValue(settings.settings, "reading_retention_floor_pct"),
      minLtvCac: settingValue(settings.settings, "reading_min_ltv_cac"),
    },
    // `{ band, period }` from the latest validated quarter that answered it,
    // or null when the Venture has never been asked / never answered.
    concentration,
    northStar: {
      name: profileRow?.north_star_name || null,
      unit: profileRow?.north_star_unit || null,
      series: months.map((month) => ({ period: month.period, value: month.northStarValue })),
      latest: latest?.northStarValue ?? null,
    },
    stage: {
      currentStage: stage.currentStage,
      nextStage: stage.nextStage,
      progress: stage.progress,
      met: stage.met,
      total: stage.total,
      missing: stage.missing,
      criteria: stage.criteria,
    },
    trafficLight: stage.trafficLight,
    reviewFlag: stage.reviewFlag,
    months,
    latest: {
      retention: latest?.retention?.value ?? null,
      runway: latest?.runway ?? null,
      fte: latest?.fte?.value ?? null,
      payingCustomers: latest?.payingCustomers ?? null,
      narrative: latestReport?.narrative || null,
      period: latest?.period || null,
      // The unit of the most recent filing — what the charts are labelled in.
      currency: latest?.currency || activeCurrency,
    },
    team: shares
      ? { womenShare: shares.womenShare, youthShare: shares.youthShare, total: shares.total }
      : null,
    yearly,
    hasData: months.length > 0,
  };
}
