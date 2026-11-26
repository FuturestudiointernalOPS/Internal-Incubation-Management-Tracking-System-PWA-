/**
 * VENTURE REPORTING — pure rules (no database, no HTTP).
 *
 * Everything here is deterministic and unit-testable: field validation,
 * threshold resolution, band maths and share calculations.
 */

export const REQUIRED_PROFILE_FIELDS = [
  "legalName",
  "foundingDate",
  "businessModel",
  // The rest of the business description is NOT required at registration:
  // `sector`, `northStarDefinition`, `problemStatement`, `idealCustomerProfile`,
  // `northStarName` and `northStarUnit` are deliberately optional. A founder
  // who does not yet have a north-star metric should not be blocked from
  // saving — a field forced to "anything" is worse than an empty one.
];

const text = (v) => (v === null || v === undefined ? "" : String(v).trim());

/** Returns the i18n keys of the missing required fields, in a stable order. */
export function validateStaticProfile(input = {}) {
  const errors = [];
  for (const field of REQUIRED_PROFILE_FIELDS) {
    if (!text(input[field])) errors.push(`venture.reporting.validation.${field}`);
  }
  if (text(input.foundingDate)) {
    const date = new Date(input.foundingDate);
    if (Number.isNaN(date.getTime())) errors.push("venture.reporting.validation.invalidDate");
    else if (date.getTime() > Date.now()) errors.push("venture.reporting.validation.futureDate");
  }
  if (input.accountingBasis && !["cash", "accrual"].includes(input.accountingBasis)) {
    errors.push("venture.reporting.validation.accountingBasis");
  }
  return errors;
}

/** A founder needs a name; the rest is optional at capture time. */
export function validateFounder(founder = {}) {
  const errors = [];
  if (!text(founder.name)) errors.push("venture.reporting.validation.founderName");
  if (founder.gender && !["female", "male", "other", "undisclosed"].includes(founder.gender)) {
    errors.push("venture.reporting.validation.gender");
  }
  if (founder.employmentType && !["full_time", "part_time"].includes(founder.employmentType)) {
    errors.push("venture.reporting.validation.employmentType");
  }
  if (text(founder.dateOfBirth)) {
    const date = new Date(founder.dateOfBirth);
    if (Number.isNaN(date.getTime())) errors.push("venture.reporting.validation.invalidDate");
  }
  return errors;
}

/**
 * Resolve one threshold: an exact business-model override wins over `default`.
 * Rows are the DISTINCT-ON output of `selectStageSettings()`.
 */
export function resolveSetting(rows = [], key, businessModel = "default") {
  const candidates = rows.filter((row) => row.setting_key === key);
  const override = candidates.find((row) => row.business_model === businessModel);
  const fallback = candidates.find((row) => row.business_model === "default");
  const row = override || fallback;
  return row ? Number(row.setting_value) : null;
}

/** A plain object of every threshold, override applied. */
export function buildSettingsMap(rows = [], businessModel = "default") {
  const keys = [...new Set(rows.map((row) => row.setting_key))];
  return Object.fromEntries(keys.map((key) => [key, resolveSetting(rows, key, businessModel)]));
}

/** Midpoint of a band; null when either bound is unknown. */
export function bandMidpoint(low, high) {
  if (low === null || low === undefined || high === null || high === undefined) return null;
  return (Number(low) + Number(high)) / 2;
}

/** The open top band has no upper bound: high = low × 1.25 (per the spec). */
export function topBandHigh(low) {
  if (low === null || low === undefined) return null;
  return Number(low) * 1.25;
}

/**
 * Group bands by kind, each list ordered.
 *
 * When a currency is given, only that currency's ladder is returned. The ladder
 * is a set of absolute amounts, so a CFA ladder can never grade a USD report:
 * filtering is what keeps a band answer honest. No currency (the admin settings
 * screen, portfolio aggregates) returns every ladder, as before.
 *
 * FALLBACK — the studio seeds ONE ladder (the CFA one). A Venture reporting in a
 * currency that has no ladder of its own would otherwise be offered an empty
 * picker: a mode with nothing to choose. Rather than hide the feature, the base
 * ladder is returned and the result SAYS SO (`fallback: true`, `currency`), so
 * the form can label the ranges with the unit they are really written in.
 */
export function groupBands(rows = [], currency = null) {
  const wanted = currency ? String(currency).trim().toUpperCase() : null;
  const matches = (row) => String(row.currency || "XOF").toUpperCase() === wanted;

  let selected = wanted ? rows.filter(matches) : rows;
  let fallback = false;
  if (wanted && selected.length === 0 && rows.length > 0) {
    selected = rows;
    fallback = true;
  }

  const grouped = { flow: [], cash: [], fallback, currency: wanted };
  for (const row of selected) {
    if (!grouped[row.band_kind]) grouped[row.band_kind] = [];
    grouped[row.band_kind].push({
      code: row.band_code,
      low: row.low === null ? null : Number(row.low),
      high: row.high === null ? null : Number(row.high),
      midpoint: row.midpoint === null ? null : Number(row.midpoint),
    });
  }

  // The unit the ranges are actually written in: the requested one when its own
  // ladder exists, otherwise the ladder's own stamp.
  if (fallback) {
    grouped.currency = String(selected[0]?.currency || "XOF").toUpperCase();
  }

  return grouped;
}

/**
 * FULL-TIME EQUIVALENT — the single definition, shared by the metric and the
 * stage rules (they used to hold two copies of the same formula).
 *
 *   FTE = full-time people + (part-time days ÷ 20) + full-time founders
 *
 * The 20 is the studio's convention for a full month of part-time work. A
 * missing full-time count is NOT zero — it returns null so the caller can say
 * "not reported". Part-time DAYS are what convert; part-time headcount alone
 * cannot, because two people working two days are not two full-timers.
 */
export function computeFte({ fullTime, partTimeDays, fullTimeFounders, includeFounders = true } = {}) {
  const full = Number(fullTime);
  if (fullTime === null || fullTime === undefined || !Number.isFinite(full)) return null;

  let founders = 0;
  if (includeFounders) {
    if (fullTimeFounders === null || fullTimeFounders === undefined) return null;
    founders = Number(fullTimeFounders);
    if (!Number.isFinite(founders)) return null;
  }

  const days = Number(partTimeDays ?? 0);
  const partTime = Number.isFinite(days) ? days / 20 : 0;

  return full + partTime + founders;
}

/**
 * FTE of a workforce SNAPSHOT — the shape both the baseline capture and the
 * workforce card need. An all-zero snapshot is "not reported", never a measured
 * zero: `toCount` coerces an untouched field to 0, so a cleared form must not
 * become a 0-FTE baseline that every later job is measured against.
 */
export function snapshotFte({ fullTime, partTimeDays, fullTimeFounders } = {}) {
  const fte = computeFte({ fullTime, partTimeDays, fullTimeFounders });
  return fte === 0 ? null : fte;
}

/** People on the books, regardless of hours: full-time + part-time + founders. */
export function computeHeadcount({ fullTime, partTime, fullTimeFounders } = {}) {
  const parts = [fullTime, partTime, fullTimeFounders].map((value) => {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  });
  if (parts.every((value) => value === null)) return null;
  return parts.reduce((total, value) => total + (value ?? 0), 0);
}

/**
 * Team shares. A zero denominator is NOT zero: it returns null so the caller
 * can show “not applicable”.
 *
 * `womenLed` is a FOUNDING fact and needs the founder records. The old rule —
 * "at least one woman among the employees" — is not what the term means: a
 * Venture with one woman in a team of forty was marked women-led. The rule now
 * is "at least one woman founder, and women are at least half of the current
 * founding team", and `null` (unknown) when no founder records exist, rather
 * than a false negative.
 */
export function computeTeamShares(team = {}, founders = []) {
  const women = Number(team.women_employees ?? team.womenEmployees ?? 0) || 0;
  const men = Number(team.men_employees ?? team.menEmployees ?? 0) || 0;
  const under35Women = Number(team.under35_women ?? team.under35Women ?? 0) || 0;
  const under35Men = Number(team.under35_men ?? team.under35Men ?? 0) || 0;
  const total = women + men;
  const youth = under35Women + under35Men;

  const founderRows = Array.isArray(founders) ? founders.filter(Boolean) : [];
  const founderCount = founderRows.length;
  const womenFounders = founderRows.filter(
    (founder) => String(founder.gender || "").toLowerCase() === "female",
  ).length;

  return {
    womenShare: total > 0 ? Math.round((women / total) * 100) : null,
    youthShare: total > 0 ? Math.round((youth / total) * 100) : null,
    womenLed:
      founderCount > 0 ? womenFounders >= 1 && womenFounders * 2 >= founderCount : null,
    womenFounders: founderCount > 0 ? womenFounders : null,
    founderCount: founderCount > 0 ? founderCount : null,
    total,
  };
}

/** A baseline can be captured only while none is active. */
export function canCaptureBaseline(activeBaseline) {
  return !activeBaseline;
}

/** Superseding a baseline always requires a reason. */
export function validateSupersedeReason(reason) {
  return text(reason) ? [] : ["venture.reporting.validation.supersedeReason"];
}

/** Non-negative integer, or 0 for absent input. */
export function toCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

/** Non-negative number, or null for absent input. */
export function toAmount(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function textOrNull(value) {
  const value2 = text(value);
  return value2 ? value2 : null;
}

export function dateOrNull(value) {
  const value2 = text(value);
  return value2 ? value2 : null;
}

// ── Reporting periods ──────────────────────────────────────────────────────

/**
 * Accepts `YYYY-MM` or `YYYY-MM-DD` and normalises to the first of the month.
 * Returns null for anything else, so a caller can refuse rather than guess.
 */
export function normalizePeriod(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

/**
 * Shift a normalised period by whole months, in UTC.
 * `shiftPeriod("2026-01-01", -1)` → `"2025-12-01"`.
 */
export function shiftPeriod(period, months) {
  const [year, month] = String(period || "").split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const shifted = new Date(Date.UTC(year, month - 1 + Number(months), 1));
  return shifted.toISOString().slice(0, 10);
}

/** The current month as a normalised period, in UTC. */
export function currentPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
