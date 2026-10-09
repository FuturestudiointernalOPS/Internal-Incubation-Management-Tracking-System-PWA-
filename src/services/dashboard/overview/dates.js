/**
 * Dashboard service — the calendar date helpers.
 *
 * The only date maths the overview needs: normalise anything date-shaped to
 * `YYYY-MM-DD`, and expand a span into every day it covers. No SQL, no HTTP.
 */

/** Convert any date format (Date object, ISO string, …) to YYYY-MM-DD. */
export function toDateStr(value) {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * A timestamp as the calendar needs it to place a block on the hour grid: an
 * ISO string for a Date, the raw text otherwise (it is parsed by the browser, so
 * a value written with an offset keeps its instant and a naive one keeps its
 * wall-clock). Empty / unreadable → null, so the item is simply all-day.
 */
export function toInstant(value) {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return value instanceof Date ? date.toISOString() : String(value);
}

/** All dates from start to end (inclusive). */
export function dateRange(start, end) {
  const dates = [];
  const startDate = new Date(start + "T00:00:00Z");
  const endDate = new Date(end + "T00:00:00Z");
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return dates;
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  return dates;
}