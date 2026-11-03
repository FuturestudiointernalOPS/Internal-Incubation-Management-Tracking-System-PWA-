/**
 * THE BUSINESS READING — pure helpers behind the studio's business snapshot.
 *
 * No React, no fetching, no SQL. Everything here turns the CALCULATED layer
 * (`/reporting/dashboard`) and the studio's own settings into the sentences and
 * figures the panels render. A figure that was not calculated stays `null` and
 * prints as « — »: this module never fills a gap with a zero.
 */

import { formatCurrencyAmount } from "@/lib/currencies";

export const localeFor = (lang) => (lang === "fr" ? "fr-FR" : "en-GB");

export const monthLabel = (period) => String(period || "").slice(0, 7);

/** A stored metric point → its number, or null when it was not computed. */
export const pointValue = (point) =>
  point && point.status === "computed" && Number.isFinite(Number(point.value))
    ? Number(point.value)
    : null;

export const money = (value, currency, lang) =>
  value === null || value === undefined ? "—" : formatCurrencyAmount(value, currency, localeFor(lang));

export const num = (value, lang, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: digits }).format(Number(value));

/** A ratio (0.42) as a percentage, or « — » when there is no figure. */
export const percent = (value, lang, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : `${new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: digits }).format(Number(value) * 100)}%`;

export const latestMonth = (months = []) => (months.length ? months[months.length - 1] : null);

/**
 * Revenue growth across the last `span` months, as a ratio.
 * Uses the validated monthly revenue only; a missing month yields null rather
 * than a number computed against a hole.
 */
export function revenueGrowth(months = [], span = 3) {
  if (months.length < span + 1) return null;
  const last = pointValue(months[months.length - 1]?.totalRevenue);
  const earlier = pointValue(months[months.length - 1 - span]?.totalRevenue);
  if (last === null || earlier === null || earlier === 0) return null;
  return (last - earlier) / earlier;
}

/** The latest computed value of a point across the months, newest first. */
export function latestPoint(months = [], key) {
  for (let index = months.length - 1; index >= 0; index -= 1) {
    const value = pointValue(months[index]?.[key]);
    if (value !== null) return value;
  }
  return null;
}

export const TONE = { good: "g", warn: "w", bad: "r", muted: "" };

/** The tone of a traffic-light dimension, by the studio's own thresholds. */
export function toneOf(status) {
  if (status === "green") return TONE.good;
  if (status === "amber") return TONE.warn;
  if (status === "red") return TONE.bad;
  return TONE.muted;
}

export function dimensionStatus(dashboard, key) {
  return (dashboard?.trafficLight?.dimensions || []).find((dimension) => dimension.key === key)?.status || "unknown";
}

/**
 * The cash needed to climb back to the studio's green runway, at the current
 * burn. Null when the figure cannot be stated honestly (no burn, no runway,
 * already green).
 */
export function bridgeToTargetRunway(dashboard) {
  const month = latestMonth(dashboard?.months || []);
  const runway = pointValue(month?.runway);
  const burn = Math.abs(pointValue(month?.netBurn) ?? 0);
  const target = Number(dashboard?.thresholds?.runwayGreenMonths);
  if (runway === null || !burn || !Number.isFinite(target)) return null;
  const gapMonths = target - runway;
  return gapMonths > 0 ? { months: gapMonths, amount: gapMonths * burn } : null;
}

// ── Scorecard ──────────────────────────────────────────────────────────────

/**
 * The twelve figures management reads first. Each row knows its own unit, so a
 * missing value prints as « — » and never as 0.
 */
export function buildScorecard({ dashboard, lang }) {
  const months = dashboard?.months || [];
  const month = latestMonth(months);
  const currency = month?.currency || dashboard?.latest?.currency || "XOF";
  const growth = revenueGrowth(months, 3);

  return [
    {
      key: "revenue",
      labelKey: "venture.reporting.metric.total_revenue",
      value: money(pointValue(month?.totalRevenue), currency, lang),
      hint: growth === null ? null : `${growth >= 0 ? "+" : ""}${percent(growth, lang)} / 3m`,
      tone: growth === null ? TONE.muted : growth >= 0 ? TONE.good : TONE.bad,
    },
    {
      key: "customers",
      labelKey: "venture.reporting.metric.paying_customers",
      value: num(month?.payingCustomers, lang),
      hint: month?.newPayingCustomers != null ? `+${num(month.newPayingCustomers, lang)}` : null,
      tone: TONE.muted,
    },
    {
      key: "retention",
      labelKey: "venture.reporting.metric.retention",
      value: percent(pointValue(month?.retention), lang),
      hint: null,
      tone: TONE.muted,
    },
    {
      key: "churn",
      labelKey: "venture.reporting.metric.churn_rate",
      value: percent(pointValue(month?.churnRate), lang),
      hint: null,
      tone: TONE.muted,
    },
    {
      key: "arpu",
      labelKey: "venture.reporting.metric.arpu",
      value: money(pointValue(month?.arpu), currency, lang),
      hint: null,
      tone: TONE.muted,
    },
    {
      key: "ltvCac",
      labelKey: "venture.reporting.metric.ltv_cac",
      value: num(pointValue(month?.ltvCac), lang, 1),
      hint: null,
      tone: TONE.muted,
    },
    {
      key: "cacPayback",
      labelKey: "venture.reporting.metric.cac_payback_months",
      value: num(pointValue(month?.cacPayback), lang, 1),
      hint: null,
      tone: TONE.muted,
    },
    {
      key: "magicNumber",
      labelKey: "venture.reporting.metric.magic_number",
      value: num(pointValue(month?.magicNumber), lang, 2),
      hint: null,
      tone: TONE.muted,
    },
    {
      key: "burnMultiple",
      labelKey: "venture.reporting.metric.burn_multiple",
      value: num(pointValue(month?.burnMultiple), lang, 2),
      hint: null,
      tone: TONE.muted,
    },
    {
      key: "grossMargin",
      labelKey: "venture.reporting.metric.gross_margin",
      value: percent(pointValue(month?.grossMargin), lang),
      hint: null,
      tone: TONE.muted,
    },
    {
      key: "netBurn",
      labelKey: "venture.reporting.metric.net_burn",
      value: money(pointValue(month?.netBurn), currency, lang),
      hint: null,
      tone: TONE.muted,
    },
    {
      key: "runway",
      labelKey: "venture.reporting.metric.runway_months",
      value: num(pointValue(month?.runway), lang, 1),
      hint: null,
      tone: toneOf(dimensionStatus(dashboard, "runway")),
    },
  ];
}

// ── Risks ──────────────────────────────────────────────────────────────────

/**
 * The risks worth acting on, each traced to the studio's own setting (through
 * the traffic light), the reporting cadence, or the Data Room's requirements.
 */
export function buildRisks({ dashboard, compliance, dataRoom, lang, t }) {
  const risks = [];
  const months = dashboard?.months || [];
  const month = latestMonth(months);

  if (dimensionStatus(dashboard, "runway") === "red") {
    risks.push({
      key: "runway",
      tone: TONE.bad,
      detailKey: "vadmin.reportsRisks.runwayDetail",
      detail: { months: num(pointValue(month?.runway), lang, 1) },
    });
  }

  const growth = revenueGrowth(months, 3);
  if (dimensionStatus(dashboard, "growth") === "red" || (growth !== null && growth < 0)) {
    risks.push({
      key: "growth",
      tone: TONE.bad,
      detailKey: "vadmin.reportsRisks.growthDetail",
      detail: { percent: percent(growth, lang) },
    });
  }

  const retention = pointValue(month?.retention);
  if (retention !== null && retention < 0.5) {
    risks.push({
      key: "retention",
      tone: TONE.warn,
      detailKey: "vadmin.reportsRisks.retentionDetail",
      detail: { percent: percent(retention, lang) },
    });
  }

  if (compliance?.isSilent) {
    risks.push({
      key: "reporting",
      tone: TONE.bad,
      detailKey: "vadmin.reportsRisks.reportingDetail",
      detail: { date: compliance.lastFiledLabel || "—" },
    });
  }

  if (dataRoom && Number(dataRoom.missing_count) > 0) {
    risks.push({
      key: "dataRoom",
      tone: TONE.warn,
      detailKey: "vadmin.reportsRisks.dataRoomDetail",
      detail: { missing: num(dataRoom.missing_count, lang) },
    });
  }

  // Concentration is asked QUARTERLY and answered in a band. Under 30% is not a
  // risk, so it is not printed as one; only the two bands above it are.
  const concentrationBand = dashboard?.concentration?.band;
  if (concentrationBand === "30_60" || concentrationBand === "over_60") {
    risks.push({
      key: "concentration",
      tone: concentrationBand === "over_60" ? TONE.bad : TONE.warn,
      detailKey: "vadmin.reportsRisks.concentrationDetail",
      detail: { band: t(`venture.reporting.quarterly.top3.${concentrationBand}`) },
    });
  }

  return risks;
}

// ── Verdict ────────────────────────────────────────────────────────────────

/**
 * What the numbers MEAN, in sentences. Each sentence is a translated template,
 * so a reader gets the conclusion rather than a wall of charts.
 */
export function buildVerdict({ dashboard, t, lang }) {
  const months = dashboard?.months || [];
  if (!months.length) return { sentences: [t("vadmin.reportsVerdict.empty")], tone: TONE.muted };

  const month = latestMonth(months);
  const growth = revenueGrowth(months, 3);
  const retention = pointValue(month?.retention);
  const runway = pointValue(month?.runway);
  const ltvCac = pointValue(month?.ltvCac);
  const sentences = [];
  let tone = TONE.muted;

  if (growth === null) sentences.push(t("vadmin.reportsVerdict.flat"));
  else if (growth >= 0.05) {
    sentences.push(
      t("vadmin.reportsVerdict.growing", {
        percent: percent(growth, lang),
        retention: percent(retention, lang),
      }),
    );
    tone = TONE.good;
  } else if (growth <= -0.02) {
    sentences.push(t("vadmin.reportsVerdict.declining", { percent: percent(Math.abs(growth), lang) }));
    tone = TONE.bad;
  } else sentences.push(t("vadmin.reportsVerdict.flat"));

  if (runway !== null) {
    const runwayStatus = dimensionStatus(dashboard, "runway");
    sentences.push(
      runwayStatus === "red"
        ? t("vadmin.reportsVerdict.runwayLow", {
            months: num(runway, lang, 1),
            threshold: num(dashboard?.thresholds?.runwayGreenMonths, lang, 0),
          })
        : t("vadmin.reportsVerdict.runwayOk", { months: num(runway, lang, 1) }),
    );
    if (runwayStatus === "red" && tone !== TONE.bad) tone = TONE.warn;
  }

  if (ltvCac !== null) {
    sentences.push(
      ltvCac >= 3
        ? t("vadmin.reportsVerdict.unitsGood", { ratio: num(ltvCac, lang, 1) })
        : t("vadmin.reportsVerdict.unitsWeak", { ratio: num(ltvCac, lang, 1) }),
    );
  }

  return { sentences, tone };
}

/**
 * Reporting cadence, from the founder's own report list: how many months were
 * validated, when the last one landed, and whether the Venture has gone quiet.
 * "Silent" means no validated report for two calendar months — the studio's
 * monthly cadence, not a guess.
 */
export function complianceFrom(reports = []) {
  const dated = (reports || [])
    .filter((report) => report?.period)
    .sort((a, b) => (String(a.period) < String(b.period) ? 1 : -1));

  const validated = (reports || []).filter((report) => report.status === "validated");
  const latest = dated[0] || null;
  const earliest = dated[dated.length - 1] || null;

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthGap = (from, to) => {
    const a = String(from || "").slice(0, 7);
    const b = String(to || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(a) || !/^\d{4}-\d{2}$/.test(b)) return null;
    const [ay, am] = a.split("-").map(Number);
    const [by, bm] = b.split("-").map(Number);
    return (by - ay) * 12 + (bm - am);
  };

  const sinceLast = latest ? monthGap(latest.period, currentKey) : null;
  const span = latest && earliest ? monthGap(earliest.period, latest.period) : null;

  return {
    filed: validated.length,
    expected: span === null ? null : span + 1,
    lastPeriod: latest ? String(latest.period).slice(0, 7) : null,
    lastFiledLabel: latest ? String(latest.period).slice(0, 7) : null,
    lastStatus: latest?.status || null,
    isSilent: !latest || (sinceLast !== null && sinceLast >= 2),
  };
}

// ── Correlation ────────────────────────────────────────────────────────────

/**
 * Work vs outcome: the month's revenue beside what the studio approved in it.
 * Months come from the REPORTED series (the outcome); execution fills the work.
 */
export function buildCorrelation({ months = [], timeline = [] }) {
  const byPeriod = new Map();
  for (const entry of timeline || []) {
    byPeriod.set(String(entry.period), entry);
  }

  return months.map((month) => {
    const period = monthLabel(month.period);
    const work = byPeriod.get(period) || { approved: 0, stages: 0 };
    return {
      period,
      revenue: pointValue(month.totalRevenue),
      approved: Number(work.approved) || 0,
      stages: Number(work.stages) || 0,
      currency: month.currency || "XOF",
    };
  });
}
