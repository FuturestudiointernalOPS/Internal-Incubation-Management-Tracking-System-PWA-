/**
 * Tasks — date helpers (SERVICE layer).
 *
 * The small pure helpers the create/update use cases share: an ISO week number,
 * a strict `YYYY-MM-DD` check, today's date, and "is this the current week?".
 *
 * Extracted so the create service and the update handler use one copy (see
 * docs/LAYER_SPLIT.md).
 */

/** ISO week number for a date (copied verbatim from the original controller). */
export function getWeekNumber(date) {
  const targetDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = targetDate.getUTCDay() || 7;
  targetDate.setUTCDate(targetDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(targetDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((targetDate - yearStart) / 86400000 + 1) / 7);
}

/** Is this a well-formed `YYYY-MM-DD` date string? */
export function isValidDateStr(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(new Date(value + "T00:00:00Z").getTime())
  );
}

/** Today, as `YYYY-MM-DD`. */
export function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/** Is this (week, year) the current reporting week? */
export function isCurrentWeek(weekNumber, yearNumber) {
  const now = new Date();
  return (
    Number(weekNumber) === getWeekNumber(now) &&
    Number(yearNumber) === now.getFullYear()
  );
}
