/**
 * Formatting for the calculated monthly metrics.
 *
 * The stored shape is `{ key, value, valueLow, valueHigh, approximate, status }`
 * where `status` may be `not_applicable` or `self_sustaining`. Both of those
 * are ANSWERED states and must read as words, never as 0 or Infinity.
 */

/** How each metric should be rendered. */
const KIND = {
  total_revenue: "money",
  arpu: "money",
  ltv: "money",
  net_burn: "money",
  average_burn: "money",
  churn_rate: "percent",
  retention: "percent",
  customer_growth_3m: "percent",
  mrr_growth_mom: "percent",
  mrr_growth_3m: "percent",
  user_to_paid: "percent",
  lost_customers: "integer",
  fte: "number",
  customer_lifetime_months: "number",
  runway_months: "number",
  // Quarterly (spec §9.3). Kept in the same table so one formatter serves both.
  net_new_customers: "integer",
  net_new_mrr: "money",
  average_retention: "percent",
  quarter_end_runway: "number",
  burn_multiple: "number",
  arpu_trend: "money",
  cac: "money",
  cac_payback_months: "number",
  ltv_cac: "number",
  pilot_to_paid: "percent",
  mvp_on_time: "percent",
  nrr: "percent",
};

const localeFor = (lang) => (lang === "fr" ? "fr-FR" : "en-GB");

function formatValue(kind, value, lang) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  if (kind === "percent") return `${(number * 100).toFixed(1)}%`;
  if (kind === "integer") {
    return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 0 }).format(number);
  }
  if (kind === "money") {
    return `${new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 0 }).format(number)} CFA`;
  }
  return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 1 }).format(number);
}

/**
 * One metric as display text.
 *
 * A band-derived metric is a RANGE and is shown as one: `low – high`. When the
 * upper bound is genuinely unknown (a non-burning venture at the optimistic
 * end) it is shown as `≥ low` rather than inventing a ceiling.
 */
export function formatMetric(t, lang, key, metric) {
  if (!metric) return "—";
  if (metric.status === "not_applicable") return t("venture.reporting.notApplicable");
  if (metric.status === "self_sustaining") return t("venture.reporting.monthly.selfSustaining");

  const kind = KIND[key] || "number";
  if (metric.approximate) {
    // A midpoint with no published bounds (a band-derived quarterly ratio) is
    // shown as approximate, never as an exact figure.
    if (metric.valueLow === null || metric.valueLow === undefined) {
      return `≈ ${formatValue(kind, metric.value, lang)}`;
    }
    const low = formatValue(kind, metric.valueLow ?? metric.value, lang);
    const high =
      metric.valueHigh === null || metric.valueHigh === undefined
        ? null
        : formatValue(kind, metric.valueHigh, lang);
    return high === null ? `≥ ${low}` : `${low} – ${high}`;
  }
  return formatValue(kind, metric.value, lang);
}

/** `{ low, high }` caption for a band option: `1 – 50 000`. */
export function formatBand(lang, band) {
  if (!band) return "";
  const formatter = new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 0 });
  if (band.high === null || band.high === undefined) return `${band.code} · ≥ ${formatter.format(band.low)}`;
  if (band.low === band.high) return `${band.code} · ${formatter.format(band.low)}`;
  return `${band.code} · ${formatter.format(band.low)} – ${formatter.format(band.high)}`;
}
