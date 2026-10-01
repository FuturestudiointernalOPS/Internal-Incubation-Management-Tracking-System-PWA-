import {
  getOverdueTasks,
  findRecentOverdueNotification,
  createOverdueNotification,
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
