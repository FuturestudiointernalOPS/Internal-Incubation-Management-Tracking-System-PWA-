/**
 * STAFF CALENDAR MODEL — the pure half of the staff calendar.
 *
 * No React, no fetch. It turns the dashboard payload's events into the items
 * the calendar draws, computes the visible days, lays timed items out in
 * columns, and builds the write payloads for the two things the calendar can
 * create (a task, a meeting). Kept apart so it can be tested without a browser.
 *
 * Three kinds of item, because the data has three kinds of time:
 *   - "task"      — a day, never an hour (tasks carry dates, not times)
 *   - "meeting"   — sessions and calendar events; timed when the feed carries a
 *                   start (`starts_at`), otherwise all-day
 *   - "milestone" — programme start/end and deliverable due dates; all-day
 */

export const TASK_STATUSES = ["pending", "in_progress", "blocked", "completed", "carried_over"];
// Statuses a person may pick from the calendar. "Carried over" is produced by
// the carry-over action (it creates the copy in the next week), never set here.
export const SETTABLE_STATUSES = ["pending", "in_progress", "blocked", "completed"];
export const KINDS = ["task", "meeting", "milestone"];

export const pad = (value) => String(value).padStart(2, "0");
export const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const parseKey = (key) => {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(year, month - 1, day);
};
export const sameDay = (first, second) => dateKey(first) === dateKey(second);
export const addDays = (date, count) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
export const minutesOf = (time) => time[0] * 60 + time[1];
export const timeLabel = (time) => `${pad(time[0])}:${pad(time[1])}`;

/** Monday of the week containing `date`. */
export function weekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** ISO-8601 week number and its year (matches the server's week arithmetic). */
export function isoWeek(source) {
  const date = new Date(Date.UTC(source.getFullYear(), source.getMonth(), source.getDate()));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((date - yearStart) / 86400000 + 1) / 7), year: date.getUTCFullYear() };
}

/** The days a view shows. `mode` is "day" | "week" | "month". */
export function daysOfView(mode, anchor) {
  if (mode === "day") return [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())];
  if (mode === "week") {
    const first = weekStart(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(first, index));
  }
  const total = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  return Array.from({ length: total }, (_, index) => new Date(anchor.getFullYear(), anchor.getMonth(), index + 1));
}

/** First and last day (as keys) of every month a set of days touches — what must be loaded. */
export function monthsNeeded(days) {
  const seen = new Map();
  for (const day of days) seen.set(`${day.getFullYear()}-${day.getMonth()}`, { year: day.getFullYear(), month: day.getMonth() });
  return [...seen.values()];
}

// ─── Normalising the feed ────────────────────────────────────────────────────

const SOURCE_KIND = { task: "task", session: "meeting", event: "meeting", program: "milestone", deliverable: "milestone", google: "meeting" };
const STATUS_RANK = { blocked: 0, in_progress: 1, pending: 2, carried_over: 3, completed: 4 };

function localTime(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  return { key: dateKey(date), time: [date.getHours(), date.getMinutes()] };
}

/**
 * Turn the dashboard's events into calendar items.
 *
 * - The same task shown twice on a day (a carried-over copy next to the
 *   original) is one item, drawn with its most pressing status.
 * - A task's position in its span ("start" | "mid" | "end" | "single") is read
 *   from whether the same task also appears the day before / after.
 * - A meeting with a `starts_at` is timed and placed on the LOCAL day/time of
 *   that instant, so what is drawn matches the clock the person reads.
 */
export function normalizeEvents(events) {
  const taskDays = new Set();
  for (const event of events || []) {
    if (event.source === "task") taskDays.add(`${event.related_id}:${event.date}`);
  }
  const taskItems = new Map();
  const items = [];

  for (const event of events || []) {
    const kind = SOURCE_KIND[event.source];
    if (!kind || !event.date) continue;

    if (kind === "task") {
      const day = parseKey(event.date);
      const hasPrev = taskDays.has(`${event.related_id}:${dateKey(addDays(day, -1))}`);
      const hasNext = taskDays.has(`${event.related_id}:${dateKey(addDays(day, 1))}`);
      const position = hasPrev && hasNext ? "mid" : hasPrev ? "end" : hasNext ? "start" : "single";
      const item = {
        uid: String(event.id),
        kind,
        source: "task",
        title: event.title || "",
        key: event.date,
        status: event.status || "pending",
        priority: event.priority || null,
        relatedId: event.related_id,
        projectId: event.project_id ?? null,
        position,
        allDay: true,
        start: null,
        end: null,
        place: null,
        raw: event,
      };
      // One task per title per day: keep the most pressing copy.
      const dedupeKey = `${item.key}:${item.title.trim().toLowerCase()}`;
      const known = taskItems.get(dedupeKey);
      if (!known) {
        taskItems.set(dedupeKey, item);
        items.push(item);
      } else if ((STATUS_RANK[item.status] ?? 2) < (STATUS_RANK[known.status] ?? 2)) {
        Object.assign(known, item);
      }
      continue;
    }

    const startedAt = localTime(event.starts_at);
    const endedAt = localTime(event.ends_at);
    let key = event.date;
    let start = null;
    let end = null;
    if (kind === "meeting" && startedAt) {
      key = startedAt.key;
      start = startedAt.time;
      end =
        endedAt && endedAt.key === startedAt.key && minutesOf(endedAt.time) > minutesOf(startedAt.time)
          ? endedAt.time
          : [Math.min(23, start[0] + 1), start[1]];
    }
    items.push({
      uid: String(event.id),
      kind,
      source: event.source,
      title: event.title || "",
      key,
      status: event.status || null,
      priority: null,
      relatedId: event.related_id,
      projectId: event.project_id ?? null,
      position: "single",
      allDay: !start,
      start,
      end,
      place: event.location || null,
      raw: event,
    });
  }
  return items;
}

export function itemsOnDay(items, key) {
  return items
    .filter((item) => item.key === key)
    .sort((first, second) => {
      if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;
      if (!first.allDay) return minutesOf(first.start) - minutesOf(second.start) || minutesOf(first.end) - minutesOf(second.end);
      const rank = { task: 0, milestone: 1, meeting: 2 };
      return rank[first.kind] - rank[second.kind] || (STATUS_RANK[first.status] ?? 2) - (STATUS_RANK[second.status] ?? 2);
    });
}

/** Does an item pass the toolbar filters? */
export function matches(item, { on, status, query }) {
  const text = (query || "").trim().toLowerCase();
  if (text && !item.title.toLowerCase().includes(text)) return false;
  if (!on[item.kind]) return false;
  if (item.kind === "task" && status !== "all" && item.status !== status) return false;
  return true;
}

/** How many items each status filter would show, over a set of days. */
export function countByStatus(items, days, query) {
  const keys = new Set(days.map(dateKey));
  const counts = { all: 0, pending: 0, in_progress: 0, blocked: 0, completed: 0, carried_over: 0 };
  let meetings = 0;
  let milestones = 0;
  let tasks = 0;
  const text = (query || "").trim().toLowerCase();
  for (const item of items) {
    if (!keys.has(item.key)) continue;
    if (text && !item.title.toLowerCase().includes(text)) continue;
    if (item.kind === "meeting") meetings += 1;
    else if (item.kind === "milestone") milestones += 1;
    else {
      counts.all += 1;
      counts[item.status] = (counts[item.status] || 0) + 1;
      tasks += 1;
    }
  }
  return { ...counts, tasks, meetings, milestones };
}

/**
 * Place the day's TIMED items in side-by-side lanes so overlapping blocks do not
 * sit on top of each other. Returns each entry with its lane and the number of
 * lanes in its overlap group.
 */
export function layoutTimed(entries) {
  const sorted = entries
    .map((item) => ({ item, from: minutesOf(item.start), to: minutesOf(item.end) }))
    .sort((first, second) => first.from - second.from || first.to - second.to);
  let cluster = [];
  let clusterEnd = 0;
  const finish = () => {
    const lanes = cluster.reduce((max, entry) => Math.max(max, entry.lane + 1), 0);
    cluster.forEach((entry) => {
      entry.lanes = lanes;
    });
  };
  for (const entry of sorted) {
    if (cluster.length && entry.from >= clusterEnd) {
      finish();
      cluster = [];
      clusterEnd = 0;
    }
    let lane = 0;
    while (cluster.some((other) => other.lane === lane && other.to > entry.from)) lane += 1;
    entry.lane = lane;
    cluster.push(entry);
    clusterEnd = Math.max(clusterEnd, entry.to);
  }
  finish();
  return sorted;
}

/** The hour range the grid must cover for the given timed items (never narrower than 8–17). */
export function hourRange(timedItems) {
  let first = 8;
  let last = 17;
  for (const item of timedItems) {
    first = Math.min(first, Math.floor(minutesOf(item.start) / 60));
    last = Math.max(last, Math.ceil(minutesOf(item.end) / 60));
  }
  return { first, last: Math.max(first + 1, Math.min(24, last)) };
}

// ─── Write payloads ──────────────────────────────────────────────────────────

/** Validate the "new task / new meeting" form. Returns an error code or null. */
export function validateForm(form) {
  if (!form.title.trim()) return form.type === "meeting" ? "titleMeeting" : "titleTask";
  if (!form.date) return "date";
  if (form.type === "meeting") {
    if (!form.start || !form.end) return "times";
    if (form.end <= form.start) return "order";
  }
  return null;
}

/** Body for POST /api/tasks — a one-day task on `form.date`, assigned to the person. */
export function buildTaskPayload(form, user, now = new Date()) {
  const { week, year } = isoWeek(now);
  return {
    title: form.title.trim(),
    user_id: user.cid,
    user_name: user.name || "",
    status: form.status || "pending",
    created_week: week,
    created_year: year,
    start_date: form.date,
    end_date: form.date,
  };
}

/** Body for POST /api/events — a meeting on `form.date` between `form.start` and `form.end` (local time). */
export function buildMeetingPayload(form, user) {
  const at = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    const day = parseKey(form.date);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).toISOString();
  };
  return {
    program_id: null,
    title: form.title.trim(),
    description: null,
    event_type: "meeting",
    start_time: at(form.start),
    end_time: at(form.end),
    location: form.place?.trim() || null,
    created_by: user.cid,
  };
}
