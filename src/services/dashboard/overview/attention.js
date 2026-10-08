/**
 * Dashboard service — the overview attention lists (tasks + blockers).
 *
 * The "needs attention" shaping: overdue tasks, tasks due today, and the
 * critical/high blockers that are not still in the future. No SQL, no HTTP.
 */

/**
 * The task counters plus the two attention lists (overdue, due today).
 * Only unfinished tasks can be overdue or due today.
 */
export function summarizeTaskStats(tasks, todayStr) {
  let totalTasks = 0;
  let openTasks = 0;
  let overdueTasks = 0;
  const overdueTaskList = [];
  const dueTodayList = [];

  totalTasks = tasks.length;
  for (const task of tasks) {
    if (task.status !== "completed") openTasks++;
    if (
      task.end_date &&
      task.status !== "completed" &&
      String(task.end_date).split("T")[0] < todayStr
    ) {
      overdueTasks++;
      overdueTaskList.push({
        id: task.id,
        title: task.title,
        due_date: task.end_date,
        priority: task.priority,
        project_id: task.project_id,
      });
    }
    if (
      task.end_date &&
      task.status !== "completed" &&
      String(task.end_date).split("T")[0] === todayStr
    ) {
      dueTodayList.push({
        id: task.id,
        title: task.title,
        type: "task",
        related_id: task.id,
        project_id: task.project_id,
      });
    }
  }

  return { totalTasks, openTasks, overdueTasks, overdueTaskList, dueTodayList };
}

/**
 * The blocker counters plus the attention list: a critical or high blocker counts
 * once its end date has passed (a blocker with no end date always counts).
 */
export function summarizeBlockers(blockers) {
  let activeBlockers = 0;
  let criticalBlockers = 0;
  const criticalBlockerList = [];
  const allBlockers = [];

  activeBlockers = blockers.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const blocker of blockers) {
    if (blocker.severity === "critical" || blocker.severity === "high") {
      let includeBlocker = true;
      if (blocker.end_date) {
        const dueDate = new Date(blocker.end_date);
        dueDate.setHours(0, 0, 0, 0);
        includeBlocker = dueDate <= today;
      }
      if (includeBlocker) {
        criticalBlockers++;
        criticalBlockerList.push({
          id: blocker.id,
          title: blocker.title,
          severity: blocker.severity,
          task_id: blocker.task_id,
          task_title: blocker.task_title,
          project_id: blocker.project_id,
        });
      }
    }
    allBlockers.push(blocker);
  }

  return { activeBlockers, criticalBlockers, criticalBlockerList, allBlockers };
}