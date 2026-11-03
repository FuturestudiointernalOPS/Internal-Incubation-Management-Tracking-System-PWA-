/**
 * VENTURE QUARTERLY REPORTING — pure rules (spec §9).
 *
 * The quarterly form asks ONLY what the monthly form cannot answer. Everything
 * else (customers, MRR, retention, runway) is carried over from the validated
 * monthly reports, so nothing is typed twice.
 */

import { normalizePeriod, shiftPeriod } from "./rules";
import { numericOrNull, integerOrNull, dateStringOrNull } from "./monthlyRules";

export const TOP3_SHARE_BANDS = ["under_30", "30_60", "over_60"];

/** The sales channels the spec lists; the studio can extend the list later. */
export const CHANNELS = ["referral", "outbound", "partnership", "content", "paid_ads", "other"];

/** `2026-Q4`, `2026-Q4-anything` or a date → the quarter's first day. */
export function normalizeQuarter(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-Q([1-4])(?:-.+)?$/i);
  if (match) {
    const quarter = Number(match[2]);
    return `${match[1]}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`;
  }
  // A plain month is accepted and snapped to its quarter.
  const month = normalizePeriod(raw);
  if (!month) return null;
  const calendarMonth = Number(month.slice(5, 7));
  const quarterStart = Math.floor((calendarMonth - 1) / 3) * 3 + 1;
  return `${month.slice(0, 4)}-${String(quarterStart).padStart(2, "0")}-01`;
}

/** The three month-starts of a quarter, in order. */
export function quarterMonths(period) {
  return [0, 1, 2].map((offset) => shiftPeriod(period, offset));
}

/** The month before the quarter — its closing count is the quarter's opening. */
export function monthBeforeQuarter(period) {
  return shiftPeriod(period, -1);
}

/** The quarter a date falls in, as a normalised period. */
export function currentQuarter(now = new Date()) {
  const year = now.getUTCFullYear();
  const quarterStart = Math.floor(now.getUTCMonth() / 3) * 3 + 1;
  return `${year}-${String(quarterStart).padStart(2, "0")}-01`;
}

const text = (value) => (value === null || value === undefined ? "" : String(value).trim());

const moneyOf = (input, field) => {
  const mode = text(input[`${field}Mode`]);
  return {
    mode: ["exact", "band"].includes(mode) ? mode : null,
    value: mode === "exact" ? numericOrNull(input[`${field}Value`]) : null,
    band: mode === "band" ? text(input[`${field}Band`]) || null : null,
  };
};

const bandKnown = (bands, code) => (bands.flow || []).some((band) => band.code === code);

/**
 * Only the impossible is refused. A blank field is NOT an error — the spec
 * treats an unanswered question as missing, and the stage engine says so.
 */
export function validateQuarterlyReport(input = {}, { bands = {} } = {}) {
  const errors = [];

  for (const field of ["salesMarketing", "expansion", "churned"]) {
    const money = moneyOf(input, field);
    if (!money.mode) continue;
    if (money.mode === "exact" && money.value === null) {
      errors.push(`venture.reporting.quarterly.validation.${field}`);
    }
    if (money.mode === "band" && !bandKnown(bands, money.band)) {
      errors.push(`venture.reporting.quarterly.validation.${field}Band`);
    }
  }

  for (const field of [
    "mvpMilestonesPlanned",
    "mvpMilestonesHit",
    "pilotsSigned",
    "pilotsConverted",
    "openDeals",
    "salesCycleDays",
  ]) {
    const raw = input[field];
    if (raw === "" || raw === null || raw === undefined) continue;
    if (integerOrNull(raw) === null) {
      errors.push(`venture.reporting.quarterly.validation.${field}`);
    }
  }

  const planned = integerOrNull(input.mvpMilestonesPlanned);
  const hit = integerOrNull(input.mvpMilestonesHit);
  if (planned !== null && hit !== null && hit > planned) {
    errors.push("venture.reporting.quarterly.validation.milestonesOverPlanned");
  }

  const signed = integerOrNull(input.pilotsSigned);
  const converted = integerOrNull(input.pilotsConverted);
  if (signed !== null && converted !== null && converted > signed) {
    errors.push("venture.reporting.quarterly.validation.pilotsOverSigned");
  }

  if (input.top3ShareBand && !TOP3_SHARE_BANDS.includes(text(input.top3ShareBand))) {
    errors.push("venture.reporting.quarterly.validation.top3Share");
  }

  if (input.channels !== undefined && input.channels !== null && !Array.isArray(input.channels)) {
    errors.push("venture.reporting.quarterly.validation.channels");
  }

  return errors;
}

/** Column payload for one submission. */
export function quarterlyRowValues({ input = {}, actorCid = null }) {
  const salesMarketing = moneyOf(input, "salesMarketing");
  const expansion = moneyOf(input, "expansion");
  const churned = moneyOf(input, "churned");
  const channels = Array.isArray(input.channels)
    ? input.channels.map((channel) => String(channel).trim()).filter(Boolean)
    : [];

  return {
    team_confirmed: input.teamConfirmed === true || input.teamConfirmed === "yes",
    mvp_milestones_planned: integerOrNull(input.mvpMilestonesPlanned),
    mvp_milestones_hit: integerOrNull(input.mvpMilestonesHit),
    pilots_signed: integerOrNull(input.pilotsSigned),
    pilots_converted: integerOrNull(input.pilotsConverted),
    channels: channels.length ? channels : null,
    sales_marketing_mode: salesMarketing.mode,
    sales_marketing_value: salesMarketing.value,
    sales_marketing_band: salesMarketing.band,
    open_deals: integerOrNull(input.openDeals),
    sales_cycle_days: integerOrNull(input.salesCycleDays),
    top3_share_band: TOP3_SHARE_BANDS.includes(text(input.top3ShareBand))
      ? text(input.top3ShareBand)
      : null,
    expansion_mode: expansion.mode,
    expansion_value: expansion.value,
    expansion_band: expansion.band,
    churned_mode: churned.mode,
    churned_value: churned.value,
    churned_band: churned.band,
    narrative: text(input.narrative) || null,
    created_by: actorCid,
  };
}

/** Stored row → the normalised shape the metric layer reads. */
export function rowToQuarterlyInput(row) {
  if (!row) return null;
  const money = (prefix) => ({
    mode: row[`${prefix}_mode`] || null,
    value: numericOrNull(row[`${prefix}_value`]),
    band: row[`${prefix}_band`] || null,
  });
  return {
    period: dateStringOrNull(row.reporting_period),
    version: row.version ?? null,
    status: row.status ?? null,
    teamConfirmed: row.team_confirmed === true,
    mvpMilestonesPlanned: integerOrNull(row.mvp_milestones_planned),
    mvpMilestonesHit: integerOrNull(row.mvp_milestones_hit),
    pilotsSigned: integerOrNull(row.pilots_signed),
    pilotsConverted: integerOrNull(row.pilots_converted),
    channels: row.channels || [],
    salesMarketing: money("sales_marketing"),
    openDeals: integerOrNull(row.open_deals),
    salesCycleDays: integerOrNull(row.sales_cycle_days),
    top3ShareBand: row.top3_share_band || null,
    expansion: money("expansion"),
    churned: money("churned"),
    narrative: row.narrative ?? null,
  };
}
