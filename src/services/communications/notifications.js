import {
  getOverdueTasks,
  findRecentOverdueNotification,
  createOverdueNotification,
  getTasksDueInNext24Hours,
  findRecentDueReminder,
  createDueReminderNotification,
} from "@/models/workspace";

/**
 * Create an "overdue" notification for every overdue task, skipping tasks that
 * already got one within the last 24 hours (dedup done by the repository query).
 * Returns { overdueCount }. No HTTP, no SQL: the route owns transport.
 */
export async function notifyOverdueTasks() {
  // 1. Find tasks that are past their due date
  const overdueTasks = await getOverdueTasks();

  const tasks = overdueTasks.rows || [];
  let overdueCount = 0;

  for (const task of tasks) {
    // 2. Deduplicate: skip if an "overdue" notification already exists
    //    for this task within the last 24 hours
    const existing = await findRecentOverdueNotification(
      task.user_id,
      `%${task.title}%`,
    );

    if (existing.rows && existing.rows.length > 0) {
      continue; // Already notified recently
    }

    // 3. Format the end_date for display
    const endDateStr = task.end_date
      ? new Date(task.end_date).toISOString().split("T")[0]
      : "unknown";

    // 4. Create the overdue notification
    await createOverdueNotification(
      task.user_id,
      "Overdue Task",
      `Task "${task.title}" was due ${endDateStr} and is now overdue!`,
    );

    overdueCount++;
  }

  return { overdueCount };
}

/**
 * Create a "due reminder" notification for every task due within the next 24
 * hours, skipping tasks that already got one within the last 6 hours.
 * Returns { remindersCreated }. No HTTP, no SQL: the route owns transport.
 */
export async function notifyDueReminders() {
  // 1. Find tasks due within the next 24 hours
  const dueTasks = await getTasksDueInNext24Hours();

  const tasks = dueTasks.rows || [];
  let remindersCreated = 0;

  for (const task of tasks) {
    // 2. Deduplicate: skip if a due_reminder notification already exists
    //    for this task within the last 6 hours
    const existing = await findRecentDueReminder(
      task.user_id,
      `%${task.title}%`,
    );

    if (existing.rows && existing.rows.length > 0) {
      continue; // Already notified recently
    }

    // 3. Create the notification
    const endDateStr = task.end_date
      ? new Date(task.end_date).toISOString().split("T")[0]
      : "tomorrow";

    await createDueReminderNotification(
      task.user_id,
      "Due Date Reminder",
      `Task "${task.title}" is due tomorrow (${endDateStr}).`,
    );

    remindersCreated++;
  }

  return { remindersCreated };
}
