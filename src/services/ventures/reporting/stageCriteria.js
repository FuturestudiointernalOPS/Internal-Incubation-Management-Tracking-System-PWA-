/**
 * VENTURE STAGE CRITERIA — spec §4.1, §4.2, §4.3. PURE.
 *
 * Three outcomes per criterion, never two:
 *
 *   met      the evidence exists and satisfies the threshold
 *   not_met  the evidence exists and does not satisfy it
 *   missing  the data needed to judge does not exist yet
 *
 * That third outcome is the whole point. A Growth rule about LTV:CAC cannot be
 * "failed" by a venture that has never filed a quarter — it is UNKNOWN, and the
 * proposal says so instead of guessing (spec §4.3).
 *
 * Money is never an input here: stage is decided on customers, retention,
 * channels and evidence. The monetary test lives only in LTV:CAC, which is a
 * profitability ratio, not a revenue bar.
 */

import { settingValue } from "./settingDefinitions";
import { computeFte } from "./rules";

export const STAGES = ["idea", "validation", "early_traction", "growth", "scaling"];

export const NEXT_STAGE = {
  idea: "validation",
  validation: "early_traction",
  early_traction: "growth",
  growth: "scaling",
  scaling: null,
};

export const MET = "met";
export const NOT_MET = "not_met";
export const MISSING = "missing";

// ── Small helpers ──────────────────────────────────────────────────────────

const last = (list, count) => (list || []).slice(-count);
const empty = (value) => value === null || value === undefined || String(value).trim() === "";

/** A monthly metric that was actually computed, or null. */
function metricOf(metrics, period, key) {
  const bag = metrics?.get?.(period);
  const metric = bag ? bag[key] : null;
  return metric && metric.status === "computed" ? Number(metric.value) : null;
}

const hasEvent = (events, type) => (events || []).some((event) => event.type === type);

const asPercent = (fraction) => (fraction === null ? null : fraction * 100);

const result = (key, status, extra = {}) => ({ key, status, ...extra });

/** The last N months, or a `missing` verdict when the history is short. */
function monthsWindow(months, required) {
  const rows = last(months, required);
  return rows.length === required ? rows : null;
}

// ── Criteria, per target stage ─────────────────────────────────────────────

const validationCriteria = ({ profile, interviews, events, settings }) => [
  result(
    "icp_defined",
    !profile ? MISSING : empty(profile.idealCustomerProfile) ? NOT_MET : MET,
    { expected: "defined" },
  ),
  result(
    "interviews",
    interviews.withEvidence >= settingValue(settings, "validation_min_interviews") ? MET : NOT_MET,
    {
      actual: interviews.withEvidence,
      expected: settingValue(settings, "validation_min_interviews"),
      unit: "count",
    },
  ),
  result(
    "pilot_or_mvp",
    hasEvent(events, "pilot_signed") || hasEvent(events, "mvp_launched") ? MET : NOT_MET,
    { expected: 1, unit: "event" },
  ),
];

/** Paying customers in EACH month of the window. */
function payingInEachMonth(months, threshold, required) {
  const rows = monthsWindow(months, required);
  if (!rows) {
    return result("paying_customers_3m", MISSING, { expected: threshold, months: required, unit: "count" });
  }
  if (rows.some((row) => row.payingCustomers === null || row.payingCustomers === undefined)) {
    return result("paying_customers_3m", MISSING, { expected: threshold, months: required, unit: "count" });
  }
  const values = rows.map((row) => row.payingCustomers);
  const met = values.every((value) => value >= threshold);
  return result("paying_customers_3m", met ? MET : NOT_MET, {
    actual: values,
    expected: threshold,
    months: required,
    unit: "count",
  });
}

/**
 * Retention in EACH month of the window.
 *
 * Returns `missing` when any of those months never computed a retention — the
 * first month of a venture's history has no churn to measure, and calling that
 * a failure would block every young venture forever.
 */
function retentionInEachMonth(months, metrics, thresholdPercent, required) {
  const rows = monthsWindow(months, required);
  if (!rows) {
    return result("retention_3m", MISSING, {
      expected: thresholdPercent,
      months: required,
      unit: "percent",
    });
  }
  const values = rows.map((row) => asPercent(metricOf(metrics, row.period, "retention")));
  if (values.some((value) => value === null)) {
    return result("retention_3m", MISSING, {
      expected: thresholdPercent,
      months: required,
      unit: "percent",
    });
  }
  const met = values.every((value) => value >= thresholdPercent);
  return result("retention_3m", met ? MET : NOT_MET, {
    actual: values,
    expected: thresholdPercent,
    months: required,
    unit: "percent",
  });
}

/** A validated quarter, or null. */
const quarterOf = (quarter) => (quarter && quarter.period ? quarter : null);

const channelCriterion = (quarter) => {
  const q = quarterOf(quarter);
  if (!q) return result("channel", MISSING, { expected: 1, unit: "count" });
  const channels = Array.isArray(q.channels) ? q.channels : [];
  if (!channels.length) return result("channel", NOT_MET, { actual: 0, expected: 1, unit: "count" });
  // Recorded per quarter, not per month: the caveat travels with the verdict.
  return result("channel", MET, { actual: channels.length, expected: 1, unit: "count", note: "quarter_level" });
};

const ltvCacCriterion = (quarter, settings) => {
  const q = quarterOf(quarter);
  const threshold = settingValue(settings, "min_ltv_cac");
  if (!q) return result("ltv_cac", MISSING, { expected: threshold, unit: "ratio" });
  const metric = q.metrics?.ltv_cac;
  if (!metric || metric.status !== "computed") {
    return result("ltv_cac", MISSING, { expected: threshold, unit: "ratio" });
  }
  const value = Number(metric.value);
  return result("ltv_cac", value >= threshold ? MET : NOT_MET, {
    actual: value,
    expected: threshold,
    unit: "ratio",
    note: metric.approximate ? "approximate" : undefined,
  });
};

/**
 * Growth's REPEATABLE-CHANNEL rule: the SAME channel brought new customers in
 * each month of the window. Captured per month (spec §9.2 asked for the
 * quarter; the monthly form now answers the stronger version directly).
 *
 * A month with no channels recorded is MISSING — not a failure — because the
 * question was not answered for that month.
 */
function sameChannelAcrossMonths(months, required) {
  const rows = monthsWindow(months, required);
  if (!rows) return result("same_channel_3m", MISSING, { months: required, unit: "count" });

  const lists = rows.map((row) => (Array.isArray(row.channels) ? row.channels : []));
  if (lists.some((list) => list.length === 0)) {
    return result("same_channel_3m", MISSING, { months: required, unit: "count" });
  }

  const [first, ...rest] = lists;
  const shared = first.filter((channel) => rest.every((list) => list.includes(channel)));
  return result("same_channel_3m", shared.length ? MET : NOT_MET, {
    actual: shared,
    expected: 1,
    months: required,
    unit: "count",
  });
}

const earlyTractionCriteria = ({ months, metrics, events, quarter, settings }) => {
  // The window length is the studio's `consecutive_months_required` (3 by
  // default) — NOT a constant in this file.
  const required = settingValue(settings, "consecutive_months_required");
  return [
    payingInEachMonth(
      months,
      settingValue(settings, "early_traction_min_paying_customers"),
      required,
    ),
    retentionInEachMonth(
      months,
      metrics,
      settingValue(settings, "min_monthly_retention_early_traction"),
      required,
    ),
    channelCriterion(quarter),
    result("pilot_converted", hasEvent(events, "pilot_converted") ? MET : NOT_MET, {
      expected: 1,
      unit: "event",
    }),
  ];
};

const growthCriteria = ({ months, metrics, events, quarter, settings }) => {
  const growthThreshold = settingValue(settings, "min_customer_growth_monthly");
  const required = settingValue(settings, "consecutive_months_required");
  const latest = last(months, 1)[0] || null;
  const growth = latest ? asPercent(metricOf(metrics, latest.period, "customer_growth_3m")) : null;

  return [
    result(
      "paying_customers",
      !latest || latest.payingCustomers === null || latest.payingCustomers === undefined
        ? MISSING
        : latest.payingCustomers >= settingValue(settings, "growth_min_paying_customers")
          ? MET
          : NOT_MET,
      {
        actual: latest?.payingCustomers ?? null,
        expected: settingValue(settings, "growth_min_paying_customers"),
        unit: "count",
      },
    ),
    result(
      "growth_3m",
      growth === null ? MISSING : growth >= growthThreshold ? MET : NOT_MET,
      { actual: growth, expected: growthThreshold, unit: "percent" },
    ),
    retentionInEachMonth(months, metrics, settingValue(settings, "min_monthly_retention_growth"), required),
    ltvCacCriterion(quarter, settings),
    sameChannelAcrossMonths(months, required),
  ];
};

const scalingCriteria = ({ months, metrics, events, quarter, settings }) => {
  const growthThreshold = settingValue(settings, "min_customer_growth_monthly");
  const sustainedMonths = settingValue(settings, "scaling_sustained_growth_months");
  const window = last(months, sustainedMonths);
  const growthValues = window.map((row) => asPercent(metricOf(metrics, row.period, "customer_growth_3m")));
  const latest = last(months, 1)[0] || null;
  const nonFounderFte = latest
    ? computeFte({
        fullTime: latest.fullTime,
        partTimeDays: latest.partTimeDays,
        // Founders are excluded on purpose: they are not evidence of hiring.
        includeFounders: false,
      })
    : null;

  return [
    result("new_market", hasEvent(events, "new_market") ? MET : NOT_MET, { expected: 1, unit: "event" }),
    result(
      "sustained_growth",
      window.length < sustainedMonths || growthValues.some((value) => value === null)
        ? MISSING
        : growthValues.every((value) => value >= growthThreshold)
          ? MET
          : NOT_MET,
      { actual: growthValues, expected: growthThreshold, months: sustainedMonths, unit: "percent" },
    ),
    retentionInEachMonth(
      months,
      metrics,
      settingValue(settings, "scaling_min_monthly_retention"),
      settingValue(settings, "consecutive_months_required"),
    ),
    ltvCacCriterion(quarter, settings),
    result(
      "non_founder_fte",
      nonFounderFte === null
        ? MISSING
        : nonFounderFte >= settingValue(settings, "scaling_min_non_founder_fte")
          ? MET
          : NOT_MET,
      {
        actual: nonFounderFte,
        expected: settingValue(settings, "scaling_min_non_founder_fte"),
        unit: "fte",
        // Founders are excluded on purpose: they are not evidence of hiring.
        note: "excludes_founders",
      },
    ),
  ];
};

const CRITERIA = {
  validation: validationCriteria,
  early_traction: earlyTractionCriteria,
  growth: growthCriteria,
  scaling: scalingCriteria,
};

// ── Public surface ─────────────────────────────────────────────────────────

/**
 * Evaluate every criterion of the NEXT stage.
 *
 * @returns {{
 *   currentStage: string,
 *   nextStage: string|null,
 *   criteria: Array,
 *   met: number,
 *   total: number,
 *   missing: number,
 *   progress: number,        // 0..1
 *   eligible: boolean        // every criterion MET — nothing missing
 * }}
 */
export function evaluateNextStage(input) {
  const currentStage = STAGES.includes(input.currentStage) ? input.currentStage : "idea";
  const nextStage = NEXT_STAGE[currentStage];

  if (!nextStage) {
    return {
      currentStage,
      nextStage: null,
      criteria: [],
      met: 0,
      total: 0,
      missing: 0,
      progress: 1,
      eligible: false,
    };
  }

  const criteria = CRITERIA[nextStage](input);
  const met = criteria.filter((criterion) => criterion.status === MET).length;
  const missing = criteria.filter((criterion) => criterion.status === MISSING).length;

  return {
    currentStage,
    nextStage,
    criteria,
    met,
    total: criteria.length,
    missing,
    progress: criteria.length ? met / criteria.length : 0,
    // A stage is never proposed on partial information.
    eligible: missing === 0 && met === criteria.length,
  };
}

/**
 * The review flag (spec §4.3): the CURRENT stage's monthly evidence has failed
 * for N consecutive months. It is a FLAG, never a demotion.
 *
 * Only the stages whose criteria can be measured month by month can be
 * reviewed this way; Idea and Validation have no monthly bar.
 */
export function evaluateReviewFlag(input) {
  const { currentStage, months, metrics, settings } = input;
  const thresholdMonths = settingValue(settings, "review_flag_months");
  if (!["early_traction", "growth", "scaling"].includes(currentStage)) {
    return { flagged: false, monthsBelow: 0, threshold: thresholdMonths, applicable: false, months: [] };
  }

  const window = last(months, thresholdMonths);
  const checks = window.map((row) => {
    const failures = [];
    if (currentStage === "early_traction") {
      const minCustomers = settingValue(settings, "early_traction_min_paying_customers");
      if (row.payingCustomers === null || row.payingCustomers < minCustomers) {
        failures.push("paying_customers");
      }
    }
    if (currentStage === "growth") {
      const minCustomers = settingValue(settings, "growth_min_paying_customers");
      if (row.payingCustomers === null || row.payingCustomers < minCustomers) {
        failures.push("paying_customers");
      }
    }
    const retentionKey =
      currentStage === "scaling"
        ? "scaling_min_monthly_retention"
        : currentStage === "growth"
          ? "min_monthly_retention_growth"
          : "min_monthly_retention_early_traction";
    const retention = asPercent(metricOf(metrics, row.period, "retention"));
    if (retention === null || retention < settingValue(settings, retentionKey)) {
      failures.push("retention");
    }
    return { period: row.period, below: failures.length > 0, failures };
  });

  const complete = window.length === thresholdMonths;
  const below = checks.filter((check) => check.below).length;

  return {
    flagged: complete && below === thresholdMonths,
    monthsBelow: below,
    threshold: thresholdMonths,
    applicable: true,
    months: checks,
  };
}
