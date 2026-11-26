/**
 * Timezone maths for recurring schedules — PURE, no database, no HTTP.
 *
 * A schedule is written in WALL-CLOCK time in one IANA zone ("every Tuesday at
 * 16:00, Africa/Porto-Novo"). The platform stores the resulting UTC instant on
 * the session, because the calendar integration sends instants and lets Google
 * render them. These two conversions are the whole boundary:
 *
 *   wall clock (a date + a time + a zone)  →  the UTC instant it means
 *
 * No library: `Intl` already carries the zone database, and an offset lookup is
 * smaller than a dependency. The trade-off is recorded as decision N4.
 */

/** Whether `timeZone` is a zone the runtime knows. */
export function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone's offset from UTC at a given instant, in milliseconds
 * (positive east of UTC, e.g. +3 600 000 for Africa/Porto-Novo).
 */
export function zoneOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  // Some engines render midnight as 24 with hour12:false.
  const hour = read("hour") % 24;
  const asIfUtc = Date.UTC(read("year"), read("month") - 1, read("day"), hour, read("minute"), read("second"));
  return asIfUtc - utcMs;
}

/**
 * The UTC instant a wall-clock date + time means in `timeZone`.
 *
 * Two passes: the first guess uses the offset at the guessed instant, the second
 * re-reads the offset at the candidate instant. That second read is what keeps a
 * time near a DST boundary correct instead of an hour out. In a spring-forward
 * GAP (a wall time that does not exist) the post-transition offset wins, which
 * is what every calendar product does.
 */
export function zonedDateTimeToUtc(dateStr, timeStr, timeZone) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  const [hours, minutes] = String(timeStr).split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hours, minutes, 0);

  const firstOffset = zoneOffsetMs(wallClockAsUtc, timeZone);
  let utcMs = wallClockAsUtc - firstOffset;
  const secondOffset = zoneOffsetMs(utcMs, timeZone);
  if (secondOffset !== firstOffset) utcMs = wallClockAsUtc - secondOffset;

  return new Date(utcMs);
}

/** "16:00" + 30 → "16:30"; wraps past midnight rather than producing "24:30". */
export function addMinutesToTime(timeStr, minutes) {
  const [hours, mins] = String(timeStr).split(":").map(Number);
  const total = hours * 60 + mins + Number(minutes || 0);
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}
