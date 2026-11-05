/**
 * YEARLY FIGURES — spec §10. PURE where it matters.
 *
 * These are ROLLING figures computed from the validated months, not a form:
 * nobody types them.
 *
 * Two rules carried over from the rest of the engine:
 *   • a denominator of zero or a missing window yields `null` (not 0);
 *   • money answered as a band is used at its midpoint and flagged approximate.
 */

import { shiftPeriod } from "./rules";

/** Sum of the values, or null when none of them exists. */
function sum(values) {
  const known = values.filter((value) => value !== null && value !== undefined);
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

/** Growth between two totals, or null when the base is not positive. */
export function growthBetween(current, previous) {
  if (current === null || previous === null) return null;
  if (!(previous > 0)) return null;
  return (current - previous) / previous;
}

/**
 * @param {object} input
 * @param {Array<{period, currency, mrrValue, payingCustomers, netBurn}>} input.months
 *        oldest → newest, e.g. from `shiftPeriod`-friendly `YYYY-MM-01` strings
 * @param {string|null} input.latestPeriod
 * @param {number|null} input.latestFte
 * @param {number|null} input.baselineFte
 */
export function computeYearlyFigures({ months = [], latestPeriod = null, latestFte = null, baselineFte = null }) {
  if (!latestPeriod) {
    return {
      monthsCovered: months.length,
      yoyMrrGrowth: null,
      annualCustomerGrowth: null,
      annualBurn: null,
      jobsSupported: latestFte,
      jobsCreated: null,
      jobsLost: null,
      jobsNet: null,
    };
  }

  const byPeriod = new Map(months.map((month) => [month.period, month]));
  const window = [];
  const prior = [];
  for (let offset = 0; offset < 12; offset += 1) {
    window.push(byPeriod.get(shiftPeriod(latestPeriod, -offset)) || null);
    prior.push(byPeriod.get(shiftPeriod(latestPeriod, -offset - 12)) || null);
  }

  const windowMrr = sum(window.map((month) => month?.mrrValue ?? null));
  const priorMrr = sum(prior.map((month) => month?.mrrValue ?? null));

  // A rolling money figure is only meaningful in ONE currency. If the venture
  // switched reporting currency inside the two-year window, the 12-month totals
  // and their growth are withheld rather than computed across units. Customer
  // counts are currency-free and stay available.
  const reference = byPeriod.get(latestPeriod)?.currency || null;
  const mixedCurrency =
    Boolean(reference) &&
    [...window, ...prior].some(
      (month) =>
        month?.currency && String(month.currency).toUpperCase() !== String(reference).toUpperCase(),
    );

  const latest = byPeriod.get(latestPeriod) || null;
  const twelveAgo = byPeriod.get(shiftPeriod(latestPeriod, -12)) || null;

  // Jobs are reported in THREE pieces, never one signed number called
  // "created": a Venture that shrank from 6 FTE to 4 has created 0 jobs and
  // lost 2 — printing "−2 jobs created" is not a smaller truth, it is a wrong
  // label. `jobsNet` is the signed change, for whoever wants the arithmetic.
  const jobsNet = jobsDelta(latestFte, baselineFte);

  return {
    monthsCovered: months.length,
    yoyMrrGrowth: mixedCurrency ? null : growthBetween(windowMrr, priorMrr),
    annualCustomerGrowth: growthBetween(
      latest?.payingCustomers ?? null,
      twelveAgo?.payingCustomers ?? null,
    ),
    annualBurn: mixedCurrency ? null : sum(window.map((month) => month?.netBurn ?? null)),
    jobsSupported: latestFte,
    jobsCreated: jobsNet === null ? null : Math.max(0, jobsNet),
    jobsLost: jobsNet === null ? null : Math.max(0, -jobsNet),
    jobsNet,
  };
}

/** FTE change against the locked baseline, or null when either side is unknown. */
export function jobsDelta(latestFte, baselineFte) {
  const latest = Number(latestFte);
  const baseline = Number(baselineFte);
  if (latestFte === null || latestFte === undefined) return null;
  if (baselineFte === null || baselineFte === undefined) return null;
  if (!Number.isFinite(latest) || !Number.isFinite(baseline)) return null;
  return latest - baseline;
}

/** Whole months between two dates, floored at 0. */
export function monthsBetween(from, to = new Date()) {
  if (!from) return null;
  const start = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  const end = to instanceof Date ? to : new Date(to);
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  return Math.max(0, months);
}

/** Survival milestones: is the Venture still active after N months? */
export function survivalAt(monthsAlive, statuses = []) {
  if (monthsAlive === null) return { m12: null, m24: null, m36: null };
  const ended = statuses.find((entry) => ["terminated", "sold"].includes(entry.status));
  // `monthsAlive` is measured from creation; `monthsSinceEnd` from the status
  // change. The age at which the venture ended is the difference — not the
  // time elapsed since it ended.
  const monthsSinceEnd = ended ? monthsBetween(ended.date) : null;
  const ageAtEnd = monthsSinceEnd === null ? null : Math.max(0, monthsAlive - monthsSinceEnd);
  const survived = (threshold) =>
    monthsAlive >= threshold && (ageAtEnd === null || ageAtEnd >= threshold);
  return {
    m12: monthsAlive >= 12 ? survived(12) : null,
    m24: monthsAlive >= 24 ? survived(24) : null,
    m36: monthsAlive >= 36 ? survived(36) : null,
  };
}

/** Days spent in each stage, from the approved history. */
export function timeInStages(history = [], now = new Date()) {
  const entries = (history || []).filter((entry) => entry.toStage);
  if (!entries.length) return [];
  const rows = [];
  entries.forEach((entry, index) => {
    const from = entry.decidedAt ? new Date(entry.decidedAt) : null;
    const to = entries[index + 1]?.decidedAt ? new Date(entries[index + 1].decidedAt) : now;
    if (!from) return;
    const days = Math.max(0, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
    rows.push({ stage: entry.toStage, days });
  });
  return rows;
}
