/**
 * Occurrence calculation — PURE. This is the whole of P1's "when would this
 * schedule meet?" question, and it creates nothing: no session row, no notice,
 * no calendar event. P2 is the phase that will persist what this returns.
 *
 * Vocabulary
 *   occurrence      one meeting the rule produces (a date + a slot)
 *   occurrence key  "<local date>T<local start>" — wall-clock, so it is stable
 *                   across a zone's DST changes and readable in the database
 *   exception       a deviation keyed on that occurrence key (skip/cancel/move)
 *
 * Counted, not observed: `max_occurrences` counts from the START of the schedule,
 * even for occurrences that fall before the preview window. A cap of 12 must not
 * mean "12 per preview".
 */

import { addMinutesToTime, zonedDateTimeToUtc } from "./timezone";

const DAY_MS = 86400000;

export const OCCURRENCE_LIMIT = 100;

export function parseDate(dateStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

export function daysBetween(fromDate, toDate) {
  return Math.round((parseDate(toDate) - parseDate(fromDate)) / DAY_MS);
}

export function weekdayOf(dateStr) {
  return parseDate(dateStr).getUTCDay(); // 0 = Sunday
}

function daysInMonth(dateStr) {
  const date = parseDate(dateStr);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function monthsBetween(fromDate, toDate) {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

/** Map of occurrence key → exception row. */
function exceptionIndex(exceptions) {
  const index = new Map();
  for (const exception of Array.isArray(exceptions) ? exceptions : []) {
    if (!exception?.occurrence_key) continue;
    index.set(String(exception.occurrence_key), exception);
  }
  return index;
}

/**
 * @param {object} schedule normalised schedule (see validate.js)
 * @param {{ from?: string, to?: string, limit?: number, exceptions?: object[] }} options
 * @returns {Array<{ date, weekday, occurrenceKey, startLocal, endLocal, minutes,
 *                   startUtc, endUtc, status, movedTo, reason }>}
 */
export function buildOccurrences(schedule, { from = null, to = null, limit = 25, exceptions = [] } = {}) {
  const slots = Array.isArray(schedule?.slots) ? schedule.slots : [];
  if (!schedule?.valid_from || slots.length === 0) return [];

  const frequency = schedule.frequency;
  const interval = frequency === "biweekly"
    ? Math.max(1, Number(schedule.interval_count) || 1) * 2
    : Math.max(1, Number(schedule.interval_count) || 1);

  const validFrom = schedule.valid_from;
  const validUntil = schedule.valid_until || null;
  const cap = Number.isFinite(Number(schedule.max_occurrences)) && Number(schedule.max_occurrences) > 0
    ? Number(schedule.max_occurrences)
    : null;

  // A preview always has a window: without one, the end of the schedule (or six
  // months) is the horizon. It is never unbounded.
  const windowFrom = from && from > validFrom ? from : validFrom;
  const windowTo = to || (validUntil || addDays(windowFrom, 182));
  const cappedTo = validUntil && validUntil < windowTo ? validUntil : windowTo;
  if (windowFrom > cappedTo) return [];

  const byKey = exceptionIndex(exceptions);
  const maxResults = Math.max(1, Math.min(Number(limit) || 25, OCCURRENCE_LIMIT));

  const results = [];
  let produced = 0;
  let date = validFrom;
  let guard = 0;

  while (guard < 4000) {
    guard += 1;
    if (validUntil && date > validUntil) break;
    if (date > cappedTo) break;

    const weekday = weekdayOf(date);
    let matches = false;

    if (frequency === "daily") {
      matches = daysBetween(validFrom, date) % interval === 0;
    } else if (frequency === "weekly" || frequency === "biweekly") {
      const weeks = Math.floor(daysBetween(validFrom, date) / 7);
      matches = weeks % interval === 0 && slots.some((slot) => slot.weekday === weekday);
    } else if (frequency === "monthly") {
      const targetDay = Math.min(parseDate(validFrom).getUTCDate(), daysInMonth(date));
      matches = monthsBetween(validFrom, date) % interval === 0 && parseDate(date).getUTCDate() === targetDay;
    }

    if (matches) {
      // Monthly has no weekday meaning: every slot is a separate meeting on that
      // day (a morning and an afternoon review, for instance).
      const daySlots = frequency === "monthly" ? slots : slots.filter((slot) => slot.weekday === weekday);
      for (const slot of daySlots) {
        produced += 1;
        if (cap !== null && produced > cap) return results;

        // Counted from the start, but only the window is returned.
        if (date < windowFrom) continue;

        const occurrenceKey = `${date}T${slot.start}`;
        const startUtc = zonedDateTimeToUtc(date, slot.start, schedule.timezone);
        const endUtc = new Date(startUtc.getTime() + slot.minutes * 60000);
        const exception = byKey.get(occurrenceKey);

        results.push({
          date,
          weekday,
          occurrenceKey,
          startLocal: slot.start,
          endLocal: addMinutesToTime(slot.start, slot.minutes),
          minutes: slot.minutes,
          startUtc: startUtc.toISOString(),
          endUtc: endUtc.toISOString(),
          timezone: schedule.timezone,
          status: exception ? exception.kind : "planned",
          movedTo: exception?.moved_to || null,
          reason: exception?.reason || null,
        });

        if (results.length >= maxResults) return results;
      }
    }

    date = addDays(date, 1);
  }

  return results;
}

