/**
 * REPORTING DISCIPLINE — spec §13, rule 9.
 *
 * "Submissions received ÷ due, on-time rate, and share rejected."
 *
 * This is the only place the system judges its own reporting process rather
 * than the Ventures. Three rules keep the judgement fair:
 *
 *   • a period is only DUE once its deadline has passed — an October report is
 *     not late on 3 November if the studio set the deadline to the 5th;
 *   • a Venture is never expected to report for a month before it existed;
 *   • a missing report is a missing REPORT, not a rejected one: only a row that
 *     was actually submitted can be on time, and only a refusal can be rejected.
 *
 * The window is the trailing N months, because a rate over all time stops
 * moving and therefore stops telling the studio anything.
 */

import {
  selectPortfolioVentures,
  selectPortfolioMonthlyRows,
  selectPortfolioQuarterlyRows,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema, getReportingSettings } from "./settings";
import { dueInstantFor } from "./schedule";
import { currentPeriod, shiftPeriod } from "./rules";
import { currentQuarter } from "./quarterlyRules";

/** Ratio, or `null` when the denominator is zero. */
const ratio = (part, whole) => (whole > 0 ? part / whole : null);

/**
 * The reporting periods that have already CLOSED, oldest first.
 *
 * The last month is deliberately excluded: it is the one currently being
 * reported, so it is neither due nor late.
 */
export function monthlyPeriods(now = new Date(), count = 12) {
  const current = currentPeriod(now);
  return Array.from({ length: count }, (_, index) => shiftPeriod(current, -(index + 1)))
    .filter(Boolean)
    .reverse();
}

/** The quarters that have already closed, oldest first. */
export function quarterlyPeriods(now = new Date(), count = 4) {
  const current = currentQuarter(now);
  return Array.from({ length: count }, (_, index) => shiftPeriod(current, -3 * (index + 1)))
    .filter(Boolean)
    .reverse();
}

/** `venture|period` → every version of that period. */
function indexRows(rows = []) {
  const indexed = new Map();
  for (const row of rows) {
    const key = `${row.venture_uuid}|${row.reporting_period}`;
    if (!indexed.has(key)) indexed.set(key, []);
    indexed.get(key).push(row);
  }
  return indexed;
}

/**
 * What one period's rows say.
 *
 * The FIRST submission decides lateness — correcting a rejection in a second
 * version does not make a late report on time — while the LIVE version decides
 * whether the period ended up validated.
 */
function assessPeriod(rows, dueAt) {
  if (!rows || !rows.length) return null;

  const byVersion = [...rows].sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  const live = byVersion.find((row) => !row.superseded_at) || byVersion[0];

  const submitted = rows
    .map((row) => Date.parse(row.submitted_at))
    .filter((value) => Number.isFinite(value));
  const firstSubmitted = submitted.length ? Math.min(...submitted) : null;
  const dueTime = dueAt ? Date.parse(dueAt) : NaN;

  return {
    received: firstSubmitted !== null,
    onTime:
      firstSubmitted !== null && Number.isFinite(dueTime) ? firstSubmitted <= dueTime : false,
    rejected: rows.some((row) => row.status === "rejected" || Boolean(row.rejected_at)),
    validated: live?.status === "validated",
  };
}

/** Sum of a tally; `null`-safe. */
function emptyTally() {
  return { due: 0, received: 0, onTime: 0, rejected: 0, validated: 0 };
}

function addTo(tally, assessment) {
  tally.due += 1;
  if (!assessment) return;
  if (assessment.received) tally.received += 1;
  if (assessment.onTime) tally.onTime += 1;
  if (assessment.rejected) tally.rejected += 1;
  if (assessment.validated) tally.validated += 1;
}

/** Shape a tally into the three rates §13.9 asks for. */
function ratesOf(tally) {
  return {
    ...tally,
    rate: ratio(tally.received, tally.due),
    // Of what ARRIVED, how much arrived by the deadline. Missing reports are
    // already counted by `rate`, so counting them twice would double-punish.
    onTimeRate: ratio(tally.onTime, tally.received),
    rejectedShare: ratio(tally.rejected, tally.received),
  };
}

/**
 * @param {object} input
 * @param {Array<{id, venture_id, created_at}>} input.ventures
 * @param {Array<object>} input.monthlyRows
 * @param {Array<object>} input.quarterlyRows
 * @param {object} input.settings      the studio's schedule
 * @param {Date}  input.now
 * @param {number} input.monthsBack
 * @param {number} input.quartersBack
 */
export function evaluateReportingDiscipline({
  ventures = [],
  monthlyRows = [],
  quarterlyRows = [],
  settings = {},
  now = new Date(),
  monthsBack = 12,
  quartersBack = 4,
}) {
  const monthIndex = indexRows(monthlyRows);
  const quarterIndex = indexRows(quarterlyRows);

  const months = monthlyPeriods(now, monthsBack);
  const quarters = quarterlyPeriods(now, quartersBack);

  // Only periods whose deadline has actually passed can be missed.
  const dueMonths = months.filter((period) => {
    const dueAt = dueInstantFor(period, "monthly", settings);
    return dueAt ? Date.parse(dueAt) <= now.getTime() : false;
  });
  const dueQuarters = quarters.filter((period) => {
    const dueAt = dueInstantFor(period, "quarterly", settings);
    return dueAt ? Date.parse(dueAt) <= now.getTime() : false;
  });

  const monthly = emptyTally();
  const quarterly = emptyTally();
  const rows = [];

  for (const venture of ventures) {
    // A Venture cannot be late for a month before it existed.
    const createdPeriod = venture.created_at ? currentPeriod(new Date(venture.created_at)) : null;
    const expectedMonths = dueMonths.filter((period) => !createdPeriod || period >= createdPeriod);
    // A quarter counts if the Venture existed during ANY of it — the same rule
    // as a month, where the month of creation is already due.
    const expectedQuarters = dueQuarters.filter(
      (period) => !createdPeriod || createdPeriod <= shiftPeriod(period, 2),
    );

    const ownMonth = emptyTally();
    const ownQuarter = emptyTally();

    for (const period of expectedMonths) {
      addTo(ownMonth, assessPeriod(monthIndex.get(`${venture.id}|${period}`), dueInstantFor(period, "monthly", settings)));
    }
    for (const period of expectedQuarters) {
      addTo(ownQuarter, assessPeriod(quarterIndex.get(`${venture.id}|${period}`), dueInstantFor(period, "quarterly", settings)));
    }

    for (const key of Object.keys(ownMonth)) monthly[key] += ownMonth[key];
    for (const key of Object.keys(ownQuarter)) quarterly[key] += ownQuarter[key];

    if (ownMonth.due || ownQuarter.due) {
      rows.push({
        venture: venture.venture_id,
        ventureUuid: venture.id,
        months: { ...ownMonth, rate: ratio(ownMonth.received, ownMonth.due) },
        quarters: { ...ownQuarter, rate: ratio(ownQuarter.received, ownQuarter.due) },
      });
    }
  }

  // Worst first: the studio opens the screen to find who needs a nudge.
  rows.sort((a, b) => {
    const left = a.months.rate === null ? 2 : a.months.rate;
    const right = b.months.rate === null ? 2 : b.months.rate;
    return left - right;
  });

  return {
    window: { monthsBack, quartersBack },
    monthly: ratesOf(monthly),
    quarterly: ratesOf(quarterly),
    ventures: rows,
  };
}

/** Load the portfolio's rows and evaluate them. */
export async function getReportingDiscipline({
  now = new Date(),
  monthsBack = 12,
  quartersBack = 4,
} = {}) {
  await ensureReportingSchema();

  const settingsBundle = await getReportingSettings({ businessModel: "default" });
  const since = shiftPeriod(currentPeriod(now), -monthsBack);

  const [venturesResult, monthlyResult, quarterlyResult] = await Promise.all([
    selectPortfolioVentures(),
    selectPortfolioMonthlyRows(since),
    selectPortfolioQuarterlyRows(since),
  ]);

  return evaluateReportingDiscipline({
    ventures: venturesResult.rows || [],
    monthlyRows: monthlyResult.rows || [],
    quarterlyRows: quarterlyResult.rows || [],
    settings: settingsBundle.settings,
    now,
    monthsBack,
    quartersBack,
  });
}
