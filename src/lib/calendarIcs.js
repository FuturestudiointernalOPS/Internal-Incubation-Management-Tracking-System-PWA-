/**
 * Calendar links — turn a platform event into the two things an invitation
 * e-mail needs: an `.ics` file (openable in ANY calendar app) and a one-click
 * "add to Google Calendar" link.
 *
 * Pure formatting, no I/O. Used by the Venture session invitations
 * (`@/services/ventures/sessionInvitees`) and reusable by any future invite.
 */

/** A Date → the UTC instant ICS wants: `YYYYMMDDTHHMMSSZ`. */
export function toIcsInstant(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escape the characters RFC 5545 reserves inside a text value. */
export function escapeIcsText(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold one content line at 75 octets (RFC 5545), continuation lines start with a space. */
function foldLine(line) {
  const value = String(line);
  if (value.length <= 75) return value;
  const parts = [];
  let rest = value;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length > 0) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

const icsLine = (name, value) => foldLine(`${name}:${value ?? ""}`);

/** `YYYYMMDD` → the next day, `YYYYMMDD` (an all-day DTEND is exclusive). */
function toIcsDateNextDay(ymd) {
  const date = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8) + 1));
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Build a complete single-event VCALENDAR.
 *
 * @param {object} event
 * @param {string} event.uid            stable unique id (e.g. `session-42@impactos`)
 * @param {string} event.title
 * @param {string} [event.description]
 * @param {string} [event.location]
 * @param {string} event.startIso       ISO start instant
 * @param {string} event.endIso         ISO end instant
 * @param {string} [event.organizerName]
 * @param {string} [event.organizerEmail]
 * @param {string} [event.url]          a meeting link
 * @returns {string|null} the .ics content, or null when a date is unusable
 */
export function buildIcsEvent(event) {
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(String(event?.allDayDate || ""));
  const start = allDay ? String(event.allDayDate).replace(/-/g, "") : toIcsInstant(event?.startIso);
  const end = allDay ? start : toIcsInstant(event?.endIso || event?.startIso);
  if (!start || !end) return null;
  // A REQUEST naming the recipient is what lets Gmail drop the event into the
  // calendar by itself; PUBLISH only offers it.
  const method = event.attendeeEmail ? "REQUEST" : "PUBLISH";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ImpactOS//Venture Session//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    icsLine("UID", event.uid || `event-${start}@impactos`),
    icsLine("DTSTAMP", toIcsInstant(new Date())),
    allDay ? icsLine("DTSTART;VALUE=DATE", start) : icsLine("DTSTART", start),
    allDay ? icsLine("DTEND;VALUE=DATE", toIcsDateNextDay(start)) : icsLine("DTEND", end),
    icsLine("SUMMARY", escapeIcsText(event.title || "Session")),
  ];
  if (event.description) lines.push(icsLine("DESCRIPTION", escapeIcsText(event.description)));
  if (event.location) lines.push(icsLine("LOCATION", escapeIcsText(event.location)));
  if (event.url) lines.push(icsLine("URL", event.url));
  if (event.organizerEmail) {
    const cn = event.organizerName ? `;CN=${escapeIcsText(event.organizerName)}` : "";
    lines.push(foldLine(`ORGANIZER${cn}:mailto:${event.organizerEmail}`));
  }
  if (event.attendeeEmail) {
    lines.push(foldLine(`ATTENDEE;CUTYPE=INDIVIDUAL;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${event.attendeeEmail}`));
  }
  if (event.alarmDaysBefore > 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      icsLine("DESCRIPTION", escapeIcsText(event.title || "Reminder")),
      `TRIGGER:-P${Math.floor(event.alarmDaysBefore)}D`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * A one-click "add to Google Calendar" link. Every e-mail carries it, so a
 * recipient whose calendar is not connected to ImpactOS can still add the
 * session in one tap — and it works even when the transport drops attachments.
 */
export function buildGoogleCalendarUrl(event) {
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(String(event?.allDayDate || ""));
  const day = allDay ? String(event.allDayDate).replace(/-/g, "") : null;
  const start = allDay ? day : toIcsInstant(event?.startIso);
  const end = allDay ? toIcsDateNextDay(day) : toIcsInstant(event?.endIso || event?.startIso);
  if (!start || !end) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title || "Session",
    dates: `${start}/${end}`,
  });
  if (event.description) params.set("details", String(event.description));
  if (event.location) params.set("location", String(event.location));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
