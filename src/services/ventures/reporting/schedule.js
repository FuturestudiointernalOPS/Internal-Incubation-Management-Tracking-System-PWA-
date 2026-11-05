/**
 * VENTURE REPORTING — the reporting schedule (pure).
 *
 * A month or quarter becomes DUE at a moment the studio defines: a day of the
 * month and a time, recurring every period. That single rule is what turns
 * "submissions received" into a rate — without a due date there is no
 * denominator, and "on time" means nothing.
 *
 * The convention is the one every reporting process uses: the report for a
 * period is due in the FOLLOWING month. October is reported during November.
 */

import { shiftPeriod } from "./rules";
import { quarterMonths } from "./quarterlyRules";
import { settingValue } from "./settingDefinitions";

/**
 * Everything below is the schedule itself. `settingValue` is imported from
 * `./settingDefinitions`, where every editable number is declared once.
 */

/** Days in a `YYYY-MM` month. */
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The day a period's report is due, as `YYYY-MM-DD`.
 *
 * @param {string} period  the period being reported (`2026-10-01` for a month
 *                         or a quarter — the caller says which)
 * @param {"monthly"|"quarterly"} kind
 * @param {object} settings the settings map
 */
export function dueDateFor(period, kind, settings = {}) {
  const day = kind === "quarterly"
    ? settingValue(settings, "reporting_quarterly_due_day")
    : settingValue(settings, "reporting_monthly_due_day");

  const monthAfterPeriod = kind === "quarterly"
    ? shiftPeriod(quarterMonths(period)[2], 1)
    : shiftPeriod(period, 1);
  if (!monthAfterPeriod) return null;

  const year = Number(monthAfterPeriod.slice(0, 4));
  const month = Number(monthAfterPeriod.slice(5, 7));
  // A due day of 31 must not invent February 31 — clamp to the real month.
  const safeDay = Math.min(Math.max(Math.trunc(day), 1), daysInMonth(year, month));
  return `${monthAfterPeriod.slice(0, 7)}-${String(safeDay).padStart(2, "0")}`;
}

/** The due moment as an ISO instant, using the studio's UTC offset. */
export function dueInstantFor(period, kind, settings = {}) {
  const date = dueDateFor(period, kind, settings);
  if (!date) return null;
  const minutes = kind === "quarterly"
    ? settingValue(settings, "reporting_quarterly_due_minute")
    : settingValue(settings, "reporting_monthly_due_minute");
  const offset = settingValue(settings, "reporting_utc_offset_minutes");
  const utcMinutes = Math.trunc(minutes) - Math.trunc(offset);
  const base = Date.parse(`${date}T00:00:00Z`);
  return new Date(base + utcMinutes * 60 * 1000).toISOString();
}

/**
 * Everything the UI and the "reporting discipline" rate need.
 *
 * `overdue` is only meaningful while the period is still unvalidated: the
 * caller decides whether to show it.
 */
export function dueStateFor({ period, kind, settings = {}, now = new Date(), validated = false }) {
  const dueDate = dueDateFor(period, kind, settings);
  const dueAt = dueInstantFor(period, kind, settings);
  if (!dueAt) return null;
  return {
    dueDate,
    dueAt,
    overdue: !validated && now.getTime() > Date.parse(dueAt),
    daysUntilDue: Math.ceil((Date.parse(dueAt) - now.getTime()) / (24 * 60 * 60 * 1000)),
  };
}


