/**
 * Dashboard service — the overview calendar assembly.
 *
 * Turns the parallel read bundle into the calendar rows: a task spanning several
 * days becomes one row per day (start / active / due), programs get a start and
 * an end row, sessions and venture sessions one row each, deliverables and v2
 * events one row each. No SQL, no HTTP.
 */

import { toDateStr, dateRange } from "./dates";

/**
 * The calendar rows of the overview, in the order the sources are read.
 *
 * Tasks span all days from start_date to end_date, so a task with no date at all
 * lands on today instead of disappearing.
 */
export function buildOverviewCalendar({
  taskDates = [],
  programs = [],
  sessions = [],
  ventureSessions = [],
  deliverables = [],
  events = [],
  todayStr,
}) {
  const calendarEvents = [];

  // Tasks → calendar — span all days from start_date to end_date
  for (const task of taskDates) {
    const startStr = toDateStr(task.start_date);
    const endStr = toDateStr(task.end_date);
    // If no dates at all, show on today
    if (!startStr && !endStr) {
      calendarEvents.push({
        id: `task-${task.id}-${todayStr}`,
        title: task.title,
        date: todayStr,
        type: "task_active",
        source: "task",
        status: task.status,
        priority: task.priority,
        related_id: task.id,
        project_id: task.project_id,
      });
      continue;
    }
    // Determine the effective date range
    const rangeStart = startStr || endStr;
    const rangeEnd = endStr || startStr;
    const days = dateRange(rangeStart, rangeEnd);
    for (const day of days) {
      const isFirst = day === rangeStart;
      const isLast = day === rangeEnd;
      calendarEvents.push({
        id: `task-${task.id}-${day}`,
        title: task.title,
        date: day,
        type: isFirst ? "task_start" : isLast ? "task_due" : "task_active",
        source: "task",
        status: task.status,
        priority: task.priority,
        related_id: task.id,
        project_id: task.project_id,
      });
    }
  }

  // Programs → calendar
  for (const program of programs) {
    if (program.start_date) {
      const startDateStr = toDateStr(program.start_date);
      if (startDateStr)
        calendarEvents.push({
          id: `program-${program.id}-start`,
          title: `${program.name} starts`,
          date: startDateStr,
          type: "program_start",
          source: "program",
          status: "active",
          related_id: program.id,
        });
    }
    if (program.end_date) {
      const endDateStr = toDateStr(program.end_date);
      if (endDateStr)
        calendarEvents.push({
          id: `program-${program.id}-end`,
          title: `${program.name} ends`,
          date: endDateStr,
          type: "program_end",
          source: "program",
          status: "active",
          related_id: program.id,
        });
    }
  }

  // Sessions → calendar
  for (const sessionRow of sessions) {
    calendarEvents.push({
      id: `session-${sessionRow.id}`,
      title: sessionRow.title,
      date: toDateStr(sessionRow.start_at),
      type: "session",
      source: "session",
      status: "scheduled",
      related_id: sessionRow.id,
      project_id: sessionRow.program_id,
    });
  }

  // Venture sessions: the coach's own sessions plus the venture-facing sessions
  // of the Ventures this person is part of.
  for (const sessionRow of ventureSessions) {
    calendarEvents.push({
      id: `vsess-${sessionRow.id}`,
      title: sessionRow.title,
      date: toDateStr(sessionRow.start_time),
      type: "venture_session",
      // "session" keeps the existing session colour/icon in the calendar UI;
      // the type still says exactly what it is.
      source: "session",
      status: sessionRow.status || "scheduled",
      related_id: sessionRow.id,
      project_id: null,
      description: sessionRow.coach_name ? `Coach: ${sessionRow.coach_name}` : null,
      milestone_ref: sessionRow.milestone_ref || null,
    });
  }

  // Deliverables → calendar
  for (const deliverable of deliverables) {
    calendarEvents.push({
      id: `deliverable-${deliverable.id}`,
      title: `${deliverable.title} due`,
      date: toDateStr(deliverable.due_date),
      type: "deliverable_due",
      source: "deliverable",
      status: "pending",
      related_id: deliverable.id,
    });
  }

  // v2_events → calendar
  for (const calendarEvent of events) {
    calendarEvents.push({
      id: `v2event-${calendarEvent.id}`,
      title: calendarEvent.title,
      date: toDateStr(calendarEvent.start_time),
      type: "event",
      source: "event",
      status: "scheduled",
      related_id: calendarEvent.id,
    });
  }

  return calendarEvents;
}