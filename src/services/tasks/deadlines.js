/**
 * Tasks — deadline reminder use case (SERVICE layer).
 *
 * The domain work behind POST /api/tasks/notify-deadlines (a cron job): find the
 * tasks due within 24 hours that have not been reminded today, and notify the
 * assignee with a human-readable time remaining. Idempotency is the query's job
 * (the model already filters tasks not notified today).
 *
 * The CONTROLLER keeps the `CRON_SECRET` gate — that is an authentication
 * concern, not a domain one.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  getTasksEndingWithin24Hours,
  createDeadlineNotification,
} from "@/models/taskLifecycle";

/** Notify the assignee of every task due within the next 24 hours. */
export async function notifyUpcomingDeadlines() {
  const tasks = await getTasksEndingWithin24Hours();

  let notified = 0;
  for (const task of tasks.rows) {
    const recipientId = task.assigned_to || task.user_id;
    if (!recipientId) continue;

    const hoursLeft = Math.max(
      1,
      Math.ceil((new Date(task.end_date) - new Date()) / 3600000),
    );
    const timeLabel = hoursLeft <= 1 ? "1 hour" : `${hoursLeft} hours`;

    await createDeadlineNotification(
      recipientId,
      "Upcoming Deadline",
      `Task "${task.title}" (#${task.id}) is due in ${timeLabel}`,
      "deadline",
    );
    notified++;
  }

  return { status: 200, body: { success: true, notified } };
}
