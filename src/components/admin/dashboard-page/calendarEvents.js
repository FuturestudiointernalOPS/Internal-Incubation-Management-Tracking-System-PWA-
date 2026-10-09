import { dateKey, addDays, parseKey } from "@/components/staff/calendarModel";

const dayOf = (value) => (value ? String(value).split("T")[0].split(" ")[0] : "");

/**
 * The calendar's feed, built from the tasks the dashboard already reads: a task
 * is listed on each day between its start and its end (one day when it has only
 * one date), in the shape the calendar understands. `task` keeps the original
 * row so opening an item shows that task.
 */
export function tasksToEvents(tasks) {
  const seen = new Set();
  const events = [];
  for (const task of tasks || []) {
    if (!task || seen.has(task.id)) continue;
    seen.add(task.id);
    const start = dayOf(task.start_date) || dayOf(task.end_date);
    const end = dayOf(task.end_date) || start;
    if (!start) continue;
    let day = parseKey(start);
    const last = parseKey(end < start ? start : end);
    for (let guard = 0; day <= last && guard < 400; guard += 1) {
      const key = dateKey(day);
      events.push({
        id: `task-${task.id}-${key}`,
        source: "task",
        title: task.title,
        date: key,
        status: task.status,
        priority: task.priority,
        related_id: task.id,
        project_id: task.project_id ?? null,
        task,
      });
      day = addDays(day, 1);
    }
  }
  return events;
}

/**
 * The dashboard's Google Calendar entries (read-only), in the same event shape
 * as `tasksToEvents`: one event per day of the entry's span, flagged `source:
 * "google"` so the calendar draws it apart from the platform's own work. A
 * timed entry keeps its clock time, so it is placed on the hour grid.
 */
export function googleEventsToEvents(items) {
  const events = [];
  for (const item of items || []) {
    const start = dayOf(item?.start_date);
    if (!start) continue;
    const end = dayOf(item.end_date);
    let day = parseKey(start);
    const last = parseKey(end && end >= start ? end : start);
    for (let guard = 0; day <= last && guard < 400; guard += 1) {
      const key = dateKey(day);
      events.push({
        id: `${item.id}-${key}`,
        source: "google",
        title: item.title,
        date: key,
        status: "google",
        starts_at: item.time ? `${key}T${item.time}:00` : null,
        location: item.location || null,
        html_link: item.html_link || null,
      });
      day = addDays(day, 1);
    }
  }
  return events;
}
