/**
 * STANDUP UPSERT SERVICE
 *
 * Unified service that ensures a standup report exists for a given
 * (user_id, week_number, year). Called whenever a task is created,
 * updated, or deleted — keeping the weekly standup in sync.
 *
 * Pattern:
 *   - If standup exists → update it with latest task context
 *   - If no standup → create a minimal one (placeholder standup)
 *
 * This removes the need for manual "Create Weekly Standup" — task
 * creation IS standup creation.
 */

import db from "@/lib/db";

/**
 * Upsert a weekly standup for a user.
 * Called after task creation/update to keep standup in sync.
 *
 * @param {Object} params
 * @param {string} params.user_id
 * @param {string} params.user_name
 * @param {string} [params.user_role] - defaults to "staff"
 * @param {number} params.week_number
 * @param {number} params.year
 * @param {Object} [params.taskContext] - optional task metadata for the standup
 * @returns {{ standupId: number, action: "created"|"updated"|"skipped" }}
 */
export async function standupUpsert({
  user_id,
  user_name,
  user_role = "staff",
  week_number,
  year,
  taskContext = {},
}) {
  // Check if standup already exists
  const existing = await db.execute({
    sql: `SELECT id, projects_tasks, top_priorities
          FROM v2_op_reports
          WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'standup'
          LIMIT 1`,
    args: [user_id, week_number, year],
  });

  if (existing.rows.length > 0) {
    // Standup exists — update task-related fields
    const standup = existing.rows[0];

    // Build updated projects_tasks field
    const existingTasks = standup.projects_tasks || "";
    const newTaskLine = `• ${taskContext.title || "New task"} (${taskContext.status || "in_progress"})`;
    const updatedTasks = existingTasks
      ? existingTasks.includes(taskContext.title)
        ? existingTasks // don't duplicate
        : `${existingTasks}\n${newTaskLine}`
      : newTaskLine;

    await db.execute({
      sql: `UPDATE v2_op_reports
            SET projects_tasks = ?, status = 'submitted'
            WHERE id = ?`,
      args: [updatedTasks, standup.id],
    });

    return { standupId: standup.id, action: "updated" };
  }

  // No standup exists — create a minimal one
  const taskLine = taskContext.title
    ? `• ${taskContext.title} (${taskContext.status || "in_progress"})`
    : "Tasks created this week.";

  const result = await db.execute({
    sql: `INSERT INTO v2_op_reports
          (user_id, user_name, user_role, report_type, week_number, year,
           status, projects_tasks, top_priorities)
          VALUES (?, ?, ?, 'standup', ?, ?, 'submitted', ?, ?)`,
    args: [
      user_id,
      user_name || "Unknown",
      user_role,
      week_number,
      year,
      taskLine,
      "Auto-generated from task creation",
    ],
  });

  const standupId = Number(result.lastInsertRowid);
  return { standupId, action: "created" };
}

/**
 * Rebuild the full projects_tasks field for a standup from all tasks
 * for the given user/week/year. Used when a task is deleted or status changes.
 *
 * @param {string} user_id
 * @param {number} week_number
 * @param {number} year
 */
export async function rebuildStandupTasks(user_id, week_number, year) {
  const standup = await db.execute({
    sql: `SELECT id FROM v2_op_reports
          WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'standup'
          LIMIT 1`,
    args: [user_id, week_number, year],
  });

  if (standup.rows.length === 0) return { action: "skipped" };

  const tasks = await db.execute({
    sql: `SELECT title, status FROM tasks
          WHERE user_id = ? AND created_week = ? AND created_year = ?
          AND status != 'completed'
          ORDER BY created_at ASC`,
    args: [user_id, week_number, year],
  });

  const lines = tasks.rows.map(
    (t) => `• ${t.title} (${t.status.replace(/_/g, " ")})`,
  );

  await db.execute({
    sql: `UPDATE v2_op_reports SET projects_tasks = ? WHERE id = ?`,
    args: [lines.join("\n") || "", standup.rows[0].id],
  });

  return { action: "rebuilt", taskCount: tasks.rows.length };
}
