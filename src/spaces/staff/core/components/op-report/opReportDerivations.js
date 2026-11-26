/**
 * Pure derivations for the staff operational report.
 *
 * No React, no state, no fetch: the page holds the state and the hooks, and
 * builds its week, its report address, its task endpoints and its merged task
 * list by calling these. Moved out of page.js as-is.
 */

/** The blank new-task form the "Add Task" shortcut opens with. */
export const NEW_TASK_FORM = {
  name: "",
  project_id: "",
  category: "",
  start_date: "",
  start_time: "",
  due_date: "",
  due_time: "",
  collaborator: "",
  collaborator_note: "",
  project_search: "",
  show_dropdown: false,
};

/** The week the address names, or the current week when it names none. */
export function resolveWeekInfo(weekParam, yearParam, thisWeek) {
  if (isNaN(weekParam) || weekParam < 1 || weekParam > 53) return thisWeek;
  return {
    week: weekParam,
    year: !isNaN(yearParam) && yearParam >= 2000 ? yearParam : thisWeek.year,
  };
}

/** This person's report address for the named week and type (or null). */
export function buildReportUrl(userId, reportType, weekInfo) {
  return userId
    ? `/api/op-reports?user_id=${userId}&type=${reportType}&week=${weekInfo.week}&year=${weekInfo.year}`
    : null;
}

/**
 * One read per status plus the tasks assigned TO this person, for useApiMulti.
 * `statuses` is the status vocabulary; `listOf` builds the response selector.
 */
export function buildTaskEndpoints(userId, statuses, listOf) {
  return userId
    ? [
        ...statuses.map((status) => ({
          key: status,
          url: `/api/tasks?user_id=${userId}&status=${status}`,
          transform: listOf("tasks"),
        })),
        {
          key: "assigned",
          url: `/api/tasks?assigned_to=${userId}`,
          transform: listOf("tasks"),
        },
      ]
    : [];
}

/** Every status read plus the assigned read, deduplicated by task id. */
export function mergeTasks(taskAnswers, statuses) {
  const merged = new Map();
  for (const status of statuses) {
    for (const task of taskAnswers[status] || []) {
      if (!merged.has(task.id)) merged.set(task.id, task);
    }
  }
  for (const task of taskAnswers.assigned || []) {
    if (!merged.has(task.id)) merged.set(task.id, task);
  }
  return Array.from(merged.values());
}
