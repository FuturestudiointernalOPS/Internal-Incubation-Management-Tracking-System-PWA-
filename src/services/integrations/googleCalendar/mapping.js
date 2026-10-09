import crypto from "crypto";

/**
 * Google Calendar sync — pure rules (no I/O).
 *
 * What a platform task looks like once copied to Google, how to recognise our
 * own copies when reading Google back, how a Google event becomes a dashboard
 * entry, and which create/update/delete calls bring Google in line with the
 * platform. Everything here is a value in → value out, so it is unit-tested
 * without Google or a database.
 */

/** Marker written on every event the platform creates in Google. */
export const PLATFORM_MARKER = "impactos";

/** Name of the dedicated calendar created in the user's Google account. */
export const FUTURE_STUDIO_CALENDAR_NAME = "Future Studio";

/** 'YYYY-MM-DD' + n days, computed in UTC so no timezone shifts the day. */
export function addDays(ymd, days) {
  const [year, month, day] = String(ymd).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

const STATUS_TEXT = {
  pending: "Pending",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Done",
  carried_over: "Carried over",
};

/**
 * The Google event body for one platform task. Tasks carry dates only, so the
 * copy is an all-day event; Google's end date is exclusive, hence the +1 day.
 * Returns null for a task without any date (nothing to place in a calendar).
 */
export function taskToGoogleEvent(task, { appUrl = "" } = {}) {
  const startDay = task.start_day || task.end_day;
  const endDay = task.end_day || task.start_day;
  if (!startDay) return null;
  const lastDay = endDay < startDay ? startDay : endDay;
  const done = task.status === "completed";
  const lines = [
    "Future Studio · ImpactOS",
    `Status: ${STATUS_TEXT[task.status] || task.status || "Pending"}`,
  ];
  if (task.priority) lines.push(`Priority: ${task.priority}`);
  if (task.description) lines.push("", String(task.description));
  if (appUrl) lines.push("", `${appUrl}/admin/tasks`);
  return {
    summary: `${done ? "✓ " : ""}${task.title || "Task"}`,
    description: lines.join("\n"),
    start: { date: startDay },
    end: { date: addDays(lastDay, 1) },
    transparency: "transparent", // a task does not block the user's free/busy
    extendedProperties: {
      private: { fs_source: PLATFORM_MARKER, fs_task_id: String(task.id) },
    },
  };
}

/** Stable hash of an event body: equal hash → nothing to send to Google. */
export function fingerprintEvent(body) {
  return crypto.createHash("sha1").update(JSON.stringify(body)).digest("hex");
}

/** True for an event the platform itself wrote (a task copy). */
export function isPlatformEvent(event) {
  return event?.extendedProperties?.private?.fs_source === PLATFORM_MARKER;
}

/**
 * A Google event (read from the dedicated Future Studio calendar) → the row
 * stored for the dashboard, with an INCLUSIVE end date. Null when the event
 * has no usable date.
 */
export function normalizeGoogleEvent(event) {
  if (!event?.id) return null;
  const allDay = Boolean(event.start?.date);
  let startDate;
  let endDate;
  if (allDay) {
    startDate = event.start.date;
    endDate = event.end?.date ? addDays(event.end.date, -1) : startDate;
  } else if (event.start?.dateTime) {
    // The date as written in the event's own timezone offset.
    startDate = event.start.dateTime.slice(0, 10);
    endDate = (event.end?.dateTime || event.start.dateTime).slice(0, 10);
  } else {
    return null;
  }
  if (endDate < startDate) endDate = startDate;
  return {
    googleEventId: event.id,
    title: event.summary || "(Google Calendar)",
    description: event.description || null,
    location: event.location || null,
    startDate,
    endDate,
    startAt: allDay ? null : event.start.dateTime,
    endAt: allDay ? null : event.end?.dateTime || null,
    allDay,
    htmlLink: event.htmlLink || null,
  };
}

/**
 * The calls that bring Google in line with the platform.
 *   tasks — the user's syncable tasks; links — what was copied before.
 * Returns { creates: [{task, body, fingerprint}], updates: [{task, eventId,
 * body, fingerprint}], deletes: [{taskId, eventId}] }.
 */
export function planTaskSync(tasks, links, options = {}) {
  const linkByTask = new Map(links.map((link) => [String(link.task_id), link]));
  const creates = [];
  const updates = [];
  const seen = new Set();
  for (const task of tasks) {
    const body = taskToGoogleEvent(task, options);
    if (!body) continue;
    const key = String(task.id);
    seen.add(key);
    const fingerprint = fingerprintEvent(body);
    const link = linkByTask.get(key);
    if (!link) creates.push({ task, body, fingerprint });
    else if (link.fingerprint !== fingerprint)
      updates.push({ task, eventId: link.google_event_id, body, fingerprint });
  }
  const deletes = links
    .filter((link) => !seen.has(String(link.task_id)))
    .map((link) => ({ taskId: link.task_id, eventId: link.google_event_id }));
  return { creates, updates, deletes };
}

/**
 * A timed platform object (a program session or a coaching follow-up) → the
 * Google event body. Unlike a task this carries a real start and end instant, so
 * it is a timed event (not all-day) and it shows as BUSY (a session occupies the
 * person's time; a task does not).
 *
 * Instants are sent as UTC ISO strings: Google renders the instant in the
 * calendar's own timezone, so no timezone maths is needed here and no day shifts.
 */
export function timedEventToGoogleEvent(event, { appUrl = "" } = {}) {
  if (!event?.startsAt) return null;
  const endsAt = event.endsAt || event.startsAt;
  const lines = ["Future Studio · ImpactOS"];
  if (event.description) lines.push("", String(event.description));
  if (appUrl) lines.push("", appUrl);
  return {
    summary: event.title || "Event",
    description: lines.join("\n"),
    start: { dateTime: new Date(event.startsAt).toISOString() },
    end: { dateTime: new Date(endsAt).toISOString() },
    transparency: "opaque",
    ...(event.location ? { location: event.location } : {}),
    extendedProperties: {
      private: {
        fs_source: PLATFORM_MARKER,
        fs_ref: eventKey(event.source, event.sourceId),
      },
    },
  };
}

/** The stable identity of a timed source row across syncs: `<source>:<id>`. */
export function eventKey(source, sourceId) {
  return `${source}:${sourceId}`;
}

/**
 * The timed-event twin of `planTaskSync`. `events` and `links` are keyed by
 * `<source>:<id>`; unchanged events produce no Google call.
 * Returns { creates, updates, deletes }.
 */
export function planEventSync(events, links, options = {}) {
  const linkByKey = new Map(links.map((link) => [eventKey(link.source, link.source_id), link]));
  const creates = [];
  const updates = [];
  const seen = new Set();
  for (const event of events) {
    const body = timedEventToGoogleEvent(event, options);
    if (!body) continue;
    const key = eventKey(event.source, event.sourceId);
    seen.add(key);
    const fingerprint = fingerprintEvent(body);
    const link = linkByKey.get(key);
    if (!link) creates.push({ event, body, fingerprint });
    else if (link.fingerprint !== fingerprint)
      updates.push({ event, eventId: link.google_event_id, body, fingerprint });
  }
  const deletes = links
    .filter((link) => !seen.has(eventKey(link.source, link.source_id)))
    .map((link) => ({ source: link.source, sourceId: link.source_id, eventId: link.google_event_id }));
  return { creates, updates, deletes };
}

/** A stored Google event → the shape the dashboard calendar renders. */
export function toDashboardItem(row) {
  const time =
    !row.all_day && row.start_at
      ? new Date(row.start_at).toISOString().slice(11, 16)
      : "";
  return {
    id: `gcal-${row.google_event_id}`,
    title: row.title,
    description: row.description,
    location: row.location,
    start_date: row.start_day,
    end_date: row.end_day,
    time,
    status: "google",
    source: "google",
    html_link: row.html_link,
  };
}
