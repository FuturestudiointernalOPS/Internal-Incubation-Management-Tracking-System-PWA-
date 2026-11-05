/**
 * VENTURE QUARTERLY METRICS — pure functions (spec §9.1 and §9.3).
 *
 * Reads two things the monthly engine already produced:
 *   reportsByPeriod — Map<month, normalised monthly report>   (counts, MRR)
 *   metricsByPeriod — Map<month, Record<metricKey, metric>>   (retention, runway…)
 *
 * Nothing here re-derives a monthly figure; that would be a second opinion.
 *
 * Money answered as a band is used at its MIDPOINT and flagged approximate —
 * the convention of spec §5.4 — so a band never masquerades as an exact amount.
 */

import { monthBeforeQuarter, quarterMonths } from "./quarterlyRules";
import { moneyBounds } from "./metrics";

export const QUARTERLY_METRIC_KEYS = [
  "net_new_customers",
  "net_new_mrr",
  "average_retention",
  "quarter_end_runway",
  "burn_multiple",
  "arpu_trend",
  "cac",
  "cac_payback_months",
  "ltv_cac",
  "pilot_to_paid",
  "mvp_on_time",
  "nrr",
];

const notApplicable = () => ({
  status: "not_applicable",
  value: null,
  valueLow: null,
  valueHigh: null,
  approximate: false,
});

const computed = (value, approximate = false) =>
  Number.isFinite(Number(value))
    ? { status: "computed", value: Number(value), valueLow: null, valueHigh: null, approximate }
    : notApplicable();

/** A band's midpoint, or the exact value. `{ value, approximate }` or null. */
function moneyMidpoint(money, kind, bands) {
  const bounds = moneyBounds(money, kind, bands);
  if (!bounds) return null;
  return { value: (bounds.low + bounds.high) / 2, approximate: bounds.approximate };
}

const metricAt = (metricsByPeriod, period, key) => {
  const bag = metricsByPeriod?.get?.(period);
  const metric = bag ? bag[key] : null;
  return metric && metric.status === "computed" ? Number(metric.value) : null;
};

export function computeQuarterlyMetrics({
  report,
  reportsByPeriod = new Map(),
  metricsByPeriod = new Map(),
  bands = {},
}) {
  const out = {};
  if (!report || !report.period) {
    for (const key of QUARTERLY_METRIC_KEYS) out[key] = notApplicable();
    return out;
  }

  const months = quarterMonths(report.period);
  const lastMonth = months[2];
  const openingMonth = monthBeforeQuarter(report.period);

  const end = reportsByPeriod.get(lastMonth) || null;
  const opening = reportsByPeriod.get(openingMonth) || null;

  // ── Customers and revenue across the quarter ────────────────────────────
  out.net_new_customers =
    end?.payingCustomers !== null &&
    end?.payingCustomers !== undefined &&
    opening?.payingCustomers !== null &&
    opening?.payingCustomers !== undefined
      ? computed(end.payingCustomers - opening.payingCustomers)
      : notApplicable();

  const mrrEnd = end ? moneyMidpoint(end.mrr, "flow", bands) : null;
  const mrrOpening = opening ? moneyMidpoint(opening.mrr, "flow", bands) : null;
  out.net_new_mrr =
    mrrEnd && mrrOpening
      ? computed(mrrEnd.value - mrrOpening.value, mrrEnd.approximate || mrrOpening.approximate)
      : notApplicable();

  // Average retention = mean of the months that actually computed one.
  const retentions = months
    .map((month) => metricAt(metricsByPeriod, month, "retention"))
    .filter((value) => value !== null && Number.isFinite(value));
  out.average_retention = retentions.length
    ? computed(retentions.reduce((total, value) => total + value, 0) / retentions.length)
    : notApplicable();

  out.quarter_end_runway = computed(metricAt(metricsByPeriod, lastMonth, "runway_months") ?? NaN);

  // Burn multiple = quarter net burn ÷ net new MRR. A venture that did not add
  // MRR has no multiple to speak of — not a zero.
  const burns = months
    .map((month) => metricAt(metricsByPeriod, month, "net_burn"))
    .filter((value) => value !== null && Number.isFinite(value));
  const netNewMrr = out.net_new_mrr.status === "computed" ? out.net_new_mrr.value : null;
  out.burn_multiple =
    burns.length === 3 && netNewMrr !== null && netNewMrr > 0
      ? computed(burns.reduce((total, value) => total + value, 0) / netNewMrr)
      : notApplicable();

  // ARPU trend = the change across the quarter.
  const arpuEnd = metricAt(metricsByPeriod, lastMonth, "arpu");
  const arpuOpening = metricAt(metricsByPeriod, openingMonth, "arpu");
  out.arpu_trend =
    arpuEnd !== null && arpuOpening !== null ? computed(arpuEnd - arpuOpening) : notApplicable();

  // ── Acquisition economics (spec §9.3) ───────────────────────────────────
  const spend = report.salesMarketing ? moneyMidpoint(report.salesMarketing, "flow", bands) : null;
  const newCustomers = months
    .map((month) => reportsByPeriod.get(month)?.newPayingCustomers)
    .filter((value) => value !== null && value !== undefined);
  const newCustomerTotal = newCustomers.length === 3
    ? newCustomers.reduce((total, value) => total + value, 0)
    : null;

  const cac = spend && newCustomerTotal > 0 ? spend.value / newCustomerTotal : null;
  out.cac = cac !== null ? computed(cac, Boolean(spend.approximate)) : notApplicable();

  out.cac_payback_months =
    cac !== null && arpuEnd !== null && arpuEnd > 0
      ? computed(cac / arpuEnd, Boolean(spend?.approximate))
      : notApplicable();

  const ltv = metricAt(metricsByPeriod, lastMonth, "ltv");
  out.ltv_cac =
    ltv !== null && cac !== null && cac > 0
      ? computed(ltv / cac, Boolean(spend?.approximate))
      : notApplicable();

  // ── Funnel conversion ───────────────────────────────────────────────────
  out.pilot_to_paid =
    report.pilotsSigned !== null &&
    report.pilotsSigned !== undefined &&
    report.pilotsSigned > 0 &&
    report.pilotsConverted !== null &&
    report.pilotsConverted !== undefined
      ? computed(report.pilotsConverted / report.pilotsSigned)
      : notApplicable();

  out.mvp_on_time =
    report.mvpMilestonesPlanned !== null &&
    report.mvpMilestonesPlanned !== undefined &&
    report.mvpMilestonesPlanned > 0 &&
    report.mvpMilestonesHit !== null &&
    report.mvpMilestonesHit !== undefined
      ? computed(report.mvpMilestonesHit / report.mvpMilestonesPlanned)
      : notApplicable();

  // NRR = (starting MRR + expansion − churned) ÷ starting MRR.
  // Contraction is not asked for today, so it is absent from the formula.
  const expansion = report.expansion ? moneyMidpoint(report.expansion, "flow", bands) : null;
  const churned = report.churned ? moneyMidpoint(report.churned, "flow", bands) : null;
  out.nrr =
    mrrOpening && mrrOpening.value > 0 && expansion && churned
      ? computed(
          (mrrOpening.value + expansion.value - churned.value) / mrrOpening.value,
          mrrOpening.approximate || expansion.approximate || churned.approximate,
        )
      : notApplicable();

  for (const key of QUARTERLY_METRIC_KEYS) {
    if (!out[key]) out[key] = notApplicable();
  }
  return out;
}
