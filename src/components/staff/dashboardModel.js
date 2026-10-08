/**
 * STAFF DASHBOARD MODEL — the pure rules behind the staff dashboard's numbers.
 *
 * Reports (the weekly stand-up and retro) are read as the API returns them:
 * `{ report_type: "standup" | "retro", week_number, year, status, has_blockers }`.
 * Nothing here fetches or renders.
 */

import { addDays, dateKey, isoWeek, parseKey, weekStart } from "./calendarModel";

/** The `count` most recent ISO weeks up to and including the one containing `now`, oldest first. */
export function recentWeeks(now, count = 4) {
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(weekStart(now), (index - (count - 1)) * 7);
    return { ...isoWeek(date), start: dateKey(date) };
  });
}

const isSubmitted = (report) => report && report.status === "submitted";
const same = (report, week) => Number(report.week_number) === week.week && Number(report.year) === week.year;

/** What was handed in for one week. */
export function weekRecord(reports, week) {
  const ofWeek = (reports || []).filter((report) => same(report, week) && isSubmitted(report));
  const standups = ofWeek.filter((report) => report.report_type === "standup");
  return {
    ...week,
    standup: standups.length > 0,
    retro: ofWeek.some((report) => report.report_type === "retro"),
    blockers: standups.filter((report) => Boolean(report.has_blockers)).length,
  };
}

/**
 * How reliable someone's weekly reporting is, over the last four weeks.
 *
 * What was DUE is counted, not what exists: the three finished weeks owe a
 * stand-up and a retro each, the current week owes its stand-up, and its retro
 * only once Friday has come. 85 % or more handed in is "regular", half or more
 * is "at_risk", less is "inactive".
 */
export function regularity(record, now) {
  if (record.length === 0) return "inactive";
  const day = now.getDay(); // 0 Sun … 6 Sat
  const retroDue = day === 5 || day === 6 || day === 0;
  const current = record[record.length - 1];
  const finished = record.slice(0, -1);
  const due = finished.length * 2 + 1 + (retroDue ? 1 : 0);
  const done =
    finished.reduce((sum, week) => sum + (week.standup ? 1 : 0) + (week.retro ? 1 : 0), 0) +
    (current.standup ? 1 : 0) +
    (retroDue && current.retro ? 1 : 0);
  const ratio = due ? done / due : 0;
  return ratio >= 0.85 ? "regular" : ratio >= 0.5 ? "at_risk" : "inactive";
}

/** Totals for the "my operations" block, over every report the person has. */
export function operationTotals(reports) {
  const submitted = (reports || []).filter(isSubmitted);
  const standups = submitted.filter((report) => report.report_type === "standup");
  const retros = submitted.filter((report) => report.report_type === "retro");
  const withBlockers = standups.filter((report) => Boolean(report.has_blockers)).length;
  return {
    standups: standups.length,
    retros: retros.length,
    blockers: withBlockers,
    blockerRate: standups.length ? Math.round((withBlockers / standups.length) * 100) : 0,
  };
}

/**
 * The tasks the "today" card lists: everything of today's calendar that is a
 * task, once each, plus the open overdue ones (marked late). Order: late first,
 * then by status urgency.
 */
export function todayTasks(calendarItems, todayKey, overdue) {
  const rank = { blocked: 0, in_progress: 1, pending: 2, carried_over: 3, completed: 4 };
  const rows = new Map();
  for (const item of calendarItems) {
    if (item.kind !== "task" || item.key !== todayKey) continue;
    rows.set(String(item.relatedId), {
      id: item.relatedId,
      title: item.title,
      status: item.status,
      priority: item.priority,
      late: false,
    });
  }
  for (const task of overdue || []) {
    const id = String(task.id);
    if (rows.has(id)) continue;
    rows.set(id, { id: task.id, title: task.title, status: "pending", priority: task.priority, late: true });
  }
  return [...rows.values()].sort(
    (first, second) => Number(second.late) - Number(first.late) || (rank[first.status] ?? 2) - (rank[second.status] ?? 2),
  );
}

/** Programmes from several lists, one entry per id. */
export function uniquePrograms(...lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const program of list || []) {
      if (program?.id === undefined || program?.id === null) continue;
      if (!seen.has(String(program.id))) seen.set(String(program.id), program);
    }
  }
  return [...seen.values()];
}

export const todayKeyOf = (now) => dateKey(now);
export const dayOf = (key) => parseKey(key);
