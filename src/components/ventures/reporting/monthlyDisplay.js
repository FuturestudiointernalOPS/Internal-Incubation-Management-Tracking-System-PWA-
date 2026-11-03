import { getCurrencySymbol, formatCurrencyAmount } from "@/lib/currencies";

/**
 * Metric kind determines how the value is shaped:
 *
 *   money   → formatted with the venture's active reporting currency symbol
 *   percent → xx.x%
 *   integer → whole count (e.g. customers, days)
 *   number  → decimal ratio (e.g. burn multiple, LTV:CAC)
 */
const KIND = {
  total_revenue: "money",
  mrr: "money",
  lost_customers: "integer",
  churn_rate: "percent",
  retention: "percent",
  customer_growth_3m: "percent",
  mrr_growth_mom: "percent",
  mrr_growth_3m: "percent",
  user_to_paid: "percent",
  arpu: "money",
  customer_lifetime_months: "number",
  ltv: "money",
  net_burn: "money",
  average_burn: "money",
  runway_months: "number",
  fte: "number",
  active_users: "integer",
  paying_customers: "integer",
  gross_margin: "percent",
  magic_number: "number",
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

function formatValue(kind, value, lang, currencyCode = "XOF") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  if (kind === "percent") return `${(number * 100).toFixed(1)}%`;
  if (kind === "integer") {
    return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 0 }).format(number);
  }
  if (kind === "money") {
    return formatCurrencyAmount(number, currencyCode, localeFor(lang));
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
export function formatMetric(t, lang, key, metric, currencyCode = "XOF") {
  if (!metric) return "—";
  if (metric.status === "not_applicable") return t("venture.reporting.notApplicable");
  if (metric.status === "self_sustaining") return t("venture.reporting.monthly.selfSustaining");

  const kind = KIND[key] || "number";
  if (metric.approximate) {
    if (metric.valueLow === null || metric.valueLow === undefined) {
      return `≈ ${formatValue(kind, metric.value, lang, currencyCode)}`;
    }
    const low = formatValue(kind, metric.valueLow ?? metric.value, lang, currencyCode);
    if (metric.valueHigh === null || metric.valueHigh === undefined) {
      return `≥ ${low}`;
    }
    const high = formatValue(kind, metric.valueHigh, lang, currencyCode);
    return `${low} – ${high}`;
  }

  return formatValue(kind, metric.value, lang, currencyCode);
}

/**
 * `{ low, high }` caption for a band option: `1 – 50 000`.
 *
 * Bands are the studio's threshold ladder, not a reported figure, so the label
 * stays unit-free — the currency of the amount beside it is what the report
 * carries.
 */
export function formatBand(lang, band) {
  if (!band) return "";
  const formatter = new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 0 });
  if (band.high === null || band.high === undefined) {
    return `${band.code} · ≥ ${formatter.format(band.low)}`;
  }
  if (band.low === band.high) return `${band.code} · ${formatter.format(band.low)}`;
  return `${band.code} · ${formatter.format(band.low)} – ${formatter.format(band.high)}`;
}
