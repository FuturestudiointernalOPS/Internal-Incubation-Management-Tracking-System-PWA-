/**
 * VENTURE MONTHLY METRICS — the fifteen figures of spec §8.2.
 *
 * PURE: no database, no HTTP, no clock. Everything here is a function of
 *
 *   report    — the validated month being calculated (normalised shape)
 *   history   — Map<period, normalised report> of every validated month
 *   bands     — the studio's band ladder (`groupBands()`)
 *
 * Three rules from the spec are enforced structurally rather than by comments:
 *
 *   1. **Not reported is not zero.** A denominator that is missing, zero or
 *      negative yields `not_applicable` — never 0, never Infinity.
 *   2. **A range stays a range.** Any figure derived from a band carries
 *      `valueLow`/`valueHigh` and `approximate: true`. `value` is the
 *      CONSERVATIVE end for that metric's direction (see `bandMetric`).
 *   3. **Stage decisions never read money.** Customer counts are exact
 *      integers here, so the stage engine that follows can rely on them.
 */

import { computeFte, shiftPeriod } from "./rules";
import { findBand } from "./monthlyRules";

/** Stable order — the dashboard and the tests both rely on it. */
export const METRIC_KEYS = [
  "total_revenue",
  "lost_customers",
  "churn_rate",
  "retention",
  "customer_growth_3m",
  "mrr_growth_mom",
  "mrr_growth_3m",
  "user_to_paid",
  "arpu",
  "customer_lifetime_months",
  "ltv",
  "net_burn",
  "average_burn",
  "runway_months",
  "fte",
];

// ── Result constructors ────────────────────────────────────────────────────

const notApplicable = () => ({
  status: "not_applicable",
  value: null,
  valueLow: null,
  valueHigh: null,
  approximate: false,
});

const selfSustaining = () => ({
  status: "self_sustaining",
  value: null,
  valueLow: null,
  valueHigh: null,
  approximate: false,
});

const exact = (value) => ({
  status: "computed",
  value,
  valueLow: null,
  valueHigh: null,
  approximate: false,
});

/**
 * Collapse a `{ low, high }` range into a stored metric.
 *
 * `direction` decides which end is the headline, because "conservative" is not
 * the same thing for every metric:
 *   - "higher" (revenue, runway, retention, LTV, growth) → the LOW end
 *   - "lower"  (burn, churn)                            → the HIGH end
 * The dashboard always shows the range, so the headline never hides the bound.
 */
function bandMetric(bounds, direction = "higher") {
  if (!bounds) return notApplicable();
  const low = Number(bounds.low);
  const high = Number(bounds.high);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return notApplicable();

  const approximate = Boolean(bounds.approximate) || low !== high;
  const value = direction === "lower" ? high : low;
  return {
    status: "computed",
    value,
    valueLow: approximate ? low : null,
    valueHigh: approximate ? high : null,
    approximate,
  };
}

// ── Money: exact or band ───────────────────────────────────────────────────

/**
 * The `{ low, high }` an exact-or-band money field actually means.
 * Returns null when the field was never answered, or when the stored band code
 * no longer exists (the studio removed it) — another case of "not reported".
 */
/**
 * The `{ low, high }` an exact-or-band money field actually means.
 *
 * LEGACY READ PATH. Ranges are no longer accepted from any form (see
 * docs/VENTURE_FINANCIAL_REPORTING.md §4): this function exists so the months,
 * quarters, baselines and events that were REPORTED as ranges before the change
 * still produce a figure — flagged `approximate`, never silently treated as an
 * exact amount. New filings can only reach it through `mode: "exact"`.
 */
export function moneyBounds(money, kind, bands) {
  if (!money || !money.mode) return null;
  if (money.mode === "exact") {
    if (money.value === null || money.value === undefined) return null;
    return { low: Number(money.value), high: Number(money.value), approximate: false };
  }
  const band = findBand(bands, kind, money.band);
  if (!band || band.low === null || band.high === null) return null;
  return { low: Number(band.low), high: Number(band.high), approximate: true };
}

/**
 * The SAME money unit on both sides?
 *
 * Growth, average burn and runway compare money from different months. The
 * engine had no way to notice a venture that switched reporting currency, so it
 * divided CFA by dollars and published the result. A month filed before the
 * stamp existed is UNKNOWN, not different: it is treated as compatible, because
 * refusing every legacy comparison would wipe history that is probably fine.
 */
const sameCurrency = (a, b) => {
  const left = a ? String(a).trim().toUpperCase() : null;
  const right = b ? String(b).trim().toUpperCase() : null;
  return !left || !right || left === right;
};

const addBounds = (a, b) => ({
  low: a.low + b.low,
  high: a.high + b.high,
  approximate: a.approximate || b.approximate,
});

/** Total revenue bounds: MRR + other revenue (an absent optional amount is 0). */
export function revenueBounds(input, bands) {
  const mrr = moneyBounds(input.mrr, "flow", bands);
  if (!mrr) return null;
  const other = moneyBounds(input.otherRevenue, "flow", bands);
  return other ? addBounds(mrr, other) : { ...mrr };
}

/** Net burn bounds: expenses − total revenue. Negative means profitable. */
export function netBurnBounds(input, bands) {
  const expenses = moneyBounds(input.expenses, "flow", bands);
  const revenue = revenueBounds(input, bands);
  if (!expenses || !revenue) return null;
  return {
    low: expenses.low - revenue.high,
    high: expenses.high - revenue.low,
    approximate: expenses.approximate || revenue.approximate,
  };
}

/**
 * Growth over `periods` months, as a range.
 *
 * The LOW end compares our low against the base's HIGH and the HIGH end the
 * other way round, so a band-derived growth can never flatter the venture.
 */
export function growthBounds(current, base, periods) {
  if (!current || !base) return null;
  if (!(base.low > 0) || !(base.high > 0)) return null;
  const low = Math.pow(current.low / base.high, 1 / periods) - 1;
  const high = Math.pow(current.high / base.low, 1 / periods) - 1;
  return { low, high, approximate: current.approximate || base.approximate || low !== high };
}

// ── The engine ─────────────────────────────────────────────────────────────

/**
 * Compute every metric for one month.
 *
 * @param {object} params
 * @param {object} params.report        normalised input for the month
 * @param {Map}    params.history       period → normalised input (all validated)
 * @param {object} params.bands         `groupBands()` output
 * @returns {Record<string, {status,value,valueLow,valueHigh,approximate}>}
 */
export function computeMonthlyMetrics({ report, history, bands = {} }) {
  const out = {};
  if (!report || !report.period) {
    for (const key of METRIC_KEYS) out[key] = notApplicable();
    return out;
  }

  // The month being computed is always part of the history it reads.
  const byPeriod = new Map(history || []);
  byPeriod.set(report.period, report);

  const monthsAgo = (n) => byPeriod.get(shiftPeriod(report.period, -n)) || null;

  const mrr = moneyBounds(report.mrr, "flow", bands);
  const revenue = revenueBounds(report, bands);
  const cash = moneyBounds(report.cash, "cash", bands);

  const payingEnd = report.payingCustomers;
  const newPaying = report.newPayingCustomers;
  const previous = monthsAgo(1);
  const payingStart = previous ? previous.payingCustomers : null;

  // 1. Total revenue — MRR + other revenue.
  out.total_revenue = bandMetric(revenue, "higher");

  // 2. Lost customers — start + new − end. Needs last month's closing count.
  let lostCustomers = null;
  if (payingStart !== null && payingEnd !== null && newPaying !== null) {
    lostCustomers = payingStart + newPaying - payingEnd;
  }
  out.lost_customers = lostCustomers === null ? notApplicable() : exact(lostCustomers);

  // 3. Churn rate — lost ÷ paying at start.
  const churn =
    lostCustomers !== null && payingStart !== null && payingStart > 0
      ? lostCustomers / payingStart
      : null;
  out.churn_rate = churn === null ? notApplicable() : exact(churn);

  // 4. Retention — 1 − churn.
  out.retention = churn === null ? notApplicable() : exact(1 - churn);

  // 5. Customer growth, 3-month — needs the count three months back.
  const threeBack = monthsAgo(3);
  const basePaying = threeBack ? threeBack.payingCustomers : null;
  out.customer_growth_3m =
    basePaying !== null && basePaying > 0 && payingEnd !== null
      ? exact(Math.pow(payingEnd / basePaying, 1 / 3) - 1)
      : notApplicable();

  // 6. MRR growth, month on month.
  const previousMrr = previous ? moneyBounds(previous.mrr, "flow", bands) : null;
  out.mrr_growth_mom = sameCurrency(report.currency, previous?.currency)
    ? bandMetric(growthBounds(mrr, previousMrr, 1), "higher")
    : notApplicable();

  // 7. MRR growth, 3-month.
  const mrThreeBack = threeBack ? moneyBounds(threeBack.mrr, "flow", bands) : null;
  out.mrr_growth_3m = sameCurrency(report.currency, threeBack?.currency)
    ? bandMetric(growthBounds(mrr, mrThreeBack, 3), "higher")
    : notApplicable();

  // 8. User-to-paid ratio — paying ÷ active users.
  out.user_to_paid =
    report.activeUsers !== null && report.activeUsers > 0 && payingEnd !== null
      ? exact(payingEnd / report.activeUsers)
      : notApplicable();

  // 9. ARPU — MRR ÷ paying customers.
  out.arpu =
    mrr && payingEnd !== null && payingEnd > 0
      ? bandMetric(
          {
            low: mrr.low / payingEnd,
            high: mrr.high / payingEnd,
            approximate: mrr.approximate,
          },
          "higher",
        )
      : notApplicable();

  // 10. Customer lifetime in months — 1 ÷ churn. Zero churn is "not
  // applicable", not Infinity (spec §8.2, §13.4).
  out.customer_lifetime_months = churn !== null && churn > 0 ? exact(1 / churn) : notApplicable();

  // 11. LTV — ARPU × lifetime.
  if (out.arpu.status === "computed" && out.customer_lifetime_months.status === "computed") {
    const lifetime = out.customer_lifetime_months.value;
    const arpuLow = out.arpu.value;
    const arpuHigh = out.arpu.valueHigh ?? out.arpu.value;
    out.ltv = bandMetric(
      { low: arpuLow * lifetime, high: arpuHigh * lifetime, approximate: out.arpu.approximate },
      "higher",
    );
  } else {
    out.ltv = notApplicable();
  }

  // 12. Net burn — expenses − total revenue.
  const currentBurn = netBurnBounds(report, bands);
  out.net_burn = bandMetric(currentBurn, "lower");

  // 13. Average burn — the mean of the last three net burns (this month
  // included). Fewer than three months of data means not applicable, and so
  // does a window that spans a currency change: averaging CFA into dollars is
  // arithmetic without a meaning.
  const burns = [0, 1, 2].map((offset) => {
    const month = monthsAgo(offset);
    if (!month || !sameCurrency(report.currency, month.currency)) return null;
    return netBurnBounds(month, bands);
  });
  const averageBurn = burns.every(Boolean)
    ? {
        low: burns.reduce((total, burn) => total + burn.low, 0) / 3,
        high: burns.reduce((total, burn) => total + burn.high, 0) / 3,
        approximate: burns.some((burn) => burn.approximate),
      }
    : null;
  out.average_burn = bandMetric(averageBurn, "lower");

  // 14. Runway — cash ÷ average burn, as a range. A venture that is not
  // burning is `self_sustaining`, never an infinite number.
  const burnHigh = out.average_burn.status === "computed" ? out.average_burn.value : null;
  if (!cash || burnHigh === null) {
    out.runway_months = notApplicable();
  } else if (burnHigh <= 0) {
    out.runway_months = selfSustaining();
  } else {
    const burnLow = out.average_burn.valueLow ?? burnHigh;
    const low = cash.low / burnHigh;
    // If even the optimistic burn is not positive there is no upper bound.
    const high = burnLow > 0 ? cash.high / burnLow : null;
    const approximate = cash.approximate || out.average_burn.approximate || high === null;
    out.runway_months = {
      status: "computed",
      value: low,
      valueLow: approximate ? low : null,
      valueHigh: approximate ? high : null,
      approximate,
    };
  }

  // 15. FTE — full-time employees + (part-time days ÷ 20) + full-time founders.
  // The formula lives in `computeFte`, shared with the stage rules so the two
  // can never drift apart.
  const fteValue = computeFte({
    fullTime: report.fullTime,
    partTimeDays: report.partTimeDays,
    fullTimeFounders: report.fullTimeFounders,
  });
  out.fte = fteValue === null ? notApplicable() : exact(fteValue);

  // Guarantee every key exists, even if a branch above forgot one.
  for (const key of METRIC_KEYS) {
    if (!out[key]) out[key] = notApplicable();
  }
  return out;
}
