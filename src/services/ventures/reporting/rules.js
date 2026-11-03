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
  "sector",
  "problemStatement",
  "idealCustomerProfile",
  "northStarName",
  "northStarDefinition",
  "northStarUnit",
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

/** Group bands by kind, each list ordered. */
export function groupBands(rows = []) {
  const grouped = { flow: [], cash: [] };
  for (const row of rows) {
    if (!grouped[row.band_kind]) grouped[row.band_kind] = [];
    grouped[row.band_kind].push({
      code: row.band_code,
      low: row.low === null ? null : Number(row.low),
      high: row.high === null ? null : Number(row.high),
      midpoint: row.midpoint === null ? null : Number(row.midpoint),
    });
  }
  return grouped;
}

/**
 * Team shares. A zero denominator is NOT zero: it returns null so the caller
 * can show “not applicable”.
 */
export function computeTeamShares(team = {}) {
  const women = Number(team.women_employees ?? team.womenEmployees ?? 0) || 0;
  const men = Number(team.men_employees ?? team.menEmployees ?? 0) || 0;
  const under35Women = Number(team.under35_women ?? team.under35Women ?? 0) || 0;
  const under35Men = Number(team.under35_men ?? team.under35Men ?? 0) || 0;
  const total = women + men;
  const youth = under35Women + under35Men;
  return {
    womenShare: total > 0 ? Math.round((women / total) * 100) : null,
    youthShare: total > 0 ? Math.round((youth / total) * 100) : null,
    womenLed: women >= 1,
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
