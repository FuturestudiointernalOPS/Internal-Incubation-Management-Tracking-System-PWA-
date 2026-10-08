/**
 * STAFF TASKS MODEL — how the task table is filtered, ordered and counted.
 * Pure; the rows are the tasks `GET /api/tasks?user_id=…` returns.
 */

const dayOf = (value) => (value ? String(value).split("T")[0].split(" ")[0] : "");

/** The status a task moves to when the person presses "advance". */
export function nextStatus(status) {
  if (status === "completed") return null;
  return status === "in_progress" ? "completed" : "in_progress";
}

/** Top-level, non-archived tasks only: a subtask is tracked through its parent. */
export function topLevelTasks(tasks) {
  return (tasks || []).filter((task) => !task.parent_task_id && task.status !== "archived");
}

export const isOverdue = (task, todayKey) => task.status !== "completed" && dayOf(task.end_date) !== "" && dayOf(task.end_date) < todayKey;

/** Open work first (blocked, then active, then waiting), by due date; finished work last. */
export function sortTasks(tasks) {
  const rank = { blocked: 0, in_progress: 1, pending: 2, carried_over: 3, completed: 4 };
  return [...tasks].sort((first, second) => {
    const byStatus = (rank[first.status] ?? 2) - (rank[second.status] ?? 2);
    if (byStatus) return byStatus;
    const firstDue = dayOf(first.end_date) || "9999-12-31";
    const secondDue = dayOf(second.end_date) || "9999-12-31";
    return firstDue.localeCompare(secondDue) || Number(first.id) - Number(second.id);
  });
}

export function filterTasks(tasks, { status, query, projectNames }) {
  const text = (query || "").trim().toLowerCase();
  return tasks.filter((task) => {
    if (status && status !== "all" && task.status !== status) return false;
    if (!text) return true;
    const project = (projectNames && projectNames.get(String(task.project_id))) || "";
    return `${task.title || ""} ${project}`.toLowerCase().includes(text);
  });
}

export function taskKpis(tasks, todayKey) {
  return {
    open: tasks.filter((task) => task.status !== "completed").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    done: tasks.filter((task) => task.status === "completed").length,
    overdue: tasks.filter((task) => isOverdue(task, todayKey)).length,
  };
}

export const taskDay = dayOf;
