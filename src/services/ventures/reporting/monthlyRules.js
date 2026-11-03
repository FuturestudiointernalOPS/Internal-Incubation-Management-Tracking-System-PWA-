/**
 * VENTURE MONTHLY REPORTING — pure rules (no database, no HTTP).
 *
 * Two jobs, both deterministic and unit-testable:
 *
 *   1. REFUSE an incomplete or impossible submission, with i18n keys.
 *   2. Normalise what was stored into the shape the metric engine reads, so
 *      `metrics.js` never has to know about column names, Date objects or the
 *      exact-or-band triple.
 *
 * The central rule of this module (spec §8, §13.4): **not reported is not
 * zero**. A count that was never answered stays `null` all the way to the
 * metric layer, where it becomes `not_applicable` — never `0`.
 */

import { toAmount } from "./rules";

// ── The eleven inputs ──────────────────────────────────────────────────────

/** Money fields, and which band ladder each one draws from. */
export const MONEY_FIELDS = {
  mrr: "flow",
  otherRevenue: "flow",
  expenses: "flow",
  cash: "cash",
};

/**
 * Required at capture: a monthly report without these cannot produce the
 * customer, revenue or runway figures the dashboard exists for. `otherRevenue`
 * is deliberately absent — the spec calls it optional, and an absent optional
 * amount genuinely means zero (unlike an unanswered required count).
 */
export const REQUIRED_MONEY = ["mrr", "expenses", "cash"];

/** Counts that must be ANSWERED — 0 is a valid answer, `null` is not. */
export const REQUIRED_COUNTS = [
  "activeUsers",
  "payingCustomers",
  "newPayingCustomers",
  "fullTime",
  "fullTimeFounders",
];

/** Counts that may be omitted entirely. */
export const OPTIONAL_COUNTS = ["partTime", "partTimeDays", "northStarValue"];

const COUNT_LABEL = {
  activeUsers: "activeUsers",
  payingCustomers: "payingCustomers",
  newPayingCustomers: "newPayingCustomers",
  fullTime: "fullTime",
  fullTimeFounders: "fullTimeFounders",
  partTime: "partTime",
  partTimeDays: "partTimeDays",
  northStarValue: "northStarValue",
};

// ── Small coercions ────────────────────────────────────────────────────────

export function textOrEmpty(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** A finite, non-negative number, or null. Empty string is "not answered". */
export function numericOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** A finite, non-negative integer, or null. */
export function integerOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

/** A finite integer, or null. Allows negatives (net burn can be negative). */
export function signedNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * One stored metric row → the shape every reader uses.
 *
 * Lives here (pure) rather than in the monthly service so the stage engine can
 * read metrics without importing that service — which would be a cycle.
 */
export function shapeMetric(row) {
  return {
    key: row.metric_key,
    value: signedNumberOrNull(row.value),
    valueLow: signedNumberOrNull(row.value_low),
    valueHigh: signedNumberOrNull(row.value_high),
    approximate: row.is_approximate === true,
    status: row.status,
  };
}

/** pg returns DATE columns as Date and timestamps as Date or string. */
export function dateStringOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// ── Money: the exact-or-band triple ────────────────────────────────────────

/**
 * Read one money field from an INPUT payload (flat keys, matching the Phase 1
 * baseline/team routes): `mrrMode`, `mrrValue`, `mrrBand`.
 *
 * Returns `{ mode, value, band }` where `mode` may be null when the field was
 * not answered at all (only legal for the optional `otherRevenue`).
 */
export function normaliseMoney(input = {}, field) {
  const mode = textOrEmpty(input[`${field}Mode`]);
  if (mode === "exact") {
    return { mode, value: numericOrNull(input[`${field}Value`]), band: null };
  }
  if (mode === "band") {
    return { mode, value: null, band: textOrEmpty(input[`${field}Band`]) || null };
  }
  return { mode: null, value: null, band: null };
}

/** The band row for a code, or null. `bands` is the `groupBands()` output. */
export function findBand(bands, kind, code) {
  if (!code) return null;
  const list = (bands && bands[kind]) || [];
  return list.find((band) => band.code === code) || null;
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Every reason a submission must be refused, as i18n keys (stable order).
 *
 * `bands` is the `groupBands()` output, so a band code the studio has since
 * removed is refused rather than silently stored and never resolvable.
 */
export function validateMonthlyReport(input = {}, { bands = {} } = {}) {
  const errors = [];

  // Money — required fields must carry a usable exact amount or a known band.
  for (const field of REQUIRED_MONEY) {
    const money = normaliseMoney(input, field);
    if (!money.mode) {
      errors.push(`venture.reporting.monthly.validation.${field}`);
      continue;
    }
    if (money.mode === "exact" && money.value === null) {
      errors.push(`venture.reporting.monthly.validation.${field}`);
    }
    if (money.mode === "band" && !findBand(bands, MONEY_FIELDS[field], money.band)) {
      errors.push(`venture.reporting.monthly.validation.${field}Band`);
    }
  }

  // Money — optional fields are validated only when the founder used them.
  for (const field of Object.keys(MONEY_FIELDS)) {
    if (REQUIRED_MONEY.includes(field)) continue;
    const money = normaliseMoney(input, field);
    if (!money.mode) continue;
    if (money.mode === "exact" && money.value === null) {
      errors.push(`venture.reporting.monthly.validation.${field}`);
    }
    if (money.mode === "band" && !findBand(bands, MONEY_FIELDS[field], money.band)) {
      errors.push(`venture.reporting.monthly.validation.${field}Band`);
    }
  }

  // Counts that must be ANSWERED. Zero is an answer; absence is not.
  for (const field of REQUIRED_COUNTS) {
    if (integerOrNull(input[field]) === null) {
      errors.push(`venture.reporting.monthly.validation.${COUNT_LABEL[field]}`);
    }
  }

  // Counts that may be omitted, but must be sane when present.
  for (const field of OPTIONAL_COUNTS) {
    const raw = input[field];
    if (raw === "" || raw === null || raw === undefined) continue;
    const parsed = field === "partTimeDays" ? numericOrNull(raw) : integerOrNull(raw);
    if (parsed === null) errors.push(`venture.reporting.monthly.validation.${COUNT_LABEL[field]}`);
  }

  return errors;
}

// ── Stored row → the shape the metric engine reads ─────────────────────────

const moneyFromRow = (row, prefix) => ({
  mode: row[`${prefix}_mode`] || null,
  value: numericOrNull(row[`${prefix}_value`]),
  band: row[`${prefix}_band`] || null,
});

/**
 * One validated report row, normalised. Unknown/absent columns become null —
 * never 0 — because that distinction drives `not_applicable` downstream.
 */
export function rowToMonthlyInput(row) {
  if (!row) return null;
  return {
    period: dateStringOrNull(row.reporting_period),
    version: row.version ?? null,
    status: row.status ?? null,
    mrr: moneyFromRow(row, "mrr"),
    otherRevenue: moneyFromRow(row, "other_revenue"),
    expenses: moneyFromRow(row, "expenses"),
    cash: moneyFromRow(row, "cash"),
    financingReceived: row.financing_received === true,
    activeUsers: integerOrNull(row.active_users),
    payingCustomers: integerOrNull(row.paying_customers),
    newPayingCustomers: integerOrNull(row.new_paying_customers),
    fullTime: integerOrNull(row.full_time),
    partTime: integerOrNull(row.part_time),
    partTimeDays: numericOrNull(row.part_time_days),
    fullTimeFounders: integerOrNull(row.full_time_founders),
    northStarValue: numericOrNull(row.north_star_value),
    narrative: row.narrative ?? null,
    // Per-month acquisition channels (Growth's repeatable-channel rule).
    channels: row.channels || [],
  };
}

/** The column payload for one submission (pure: ids and dates are passed in). */
export function monthlyRowValues({ input = {}, actorCid = null }) {
  const money = {};
  for (const field of Object.keys(MONEY_FIELDS)) {
    const value = normaliseMoney(input, field);
    money[`${field}_mode`] = value.mode;
    money[`${field}_value`] = value.value;
    money[`${field}_band`] = value.band;
  }
  return {
    ...money,
    financing_received: input.financingReceived === true || input.financingReceived === "yes",
    active_users: integerOrNull(input.activeUsers),
    paying_customers: integerOrNull(input.payingCustomers),
    new_paying_customers: integerOrNull(input.newPayingCustomers),
    full_time: integerOrNull(input.fullTime),
    part_time: integerOrNull(input.partTime),
    part_time_days: toAmount(input.partTimeDays),
    full_time_founders: integerOrNull(input.fullTimeFounders),
    north_star_value: toAmount(input.northStarValue),
    narrative: textOrEmpty(input.narrative) || null,
    channels: Array.isArray(input.channels)
      ? input.channels.map((channel) => String(channel).trim()).filter(Boolean)
      : null,
    created_by: actorCid,
  };
}

/** A count that was answered at all (0 is answered). */
export const isAnswered = (value) => value !== null && value !== undefined;
