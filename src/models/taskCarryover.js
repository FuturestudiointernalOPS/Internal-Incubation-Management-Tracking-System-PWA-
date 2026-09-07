import db from "@/lib/db";

/**
 * Carry-over chain cleanup.
 *
 * When a task is carried over, a NEW clone is created in the target week and
 * the source task is set to `carried_over`. The clone links back to its source
 * via `carried_over_from_task_id` (clone -> source -> source's source -> ...).
 *
 * Completing the clone must therefore also complete every `carried_over`
 * ancestor, otherwise those ancestors stay stuck as `carried_over` forever and
 * keep showing up in the carry-over list even though the work is done.
 *
 * This helper walks the chain backwards and marks each ancestor `completed`
 * (skipping anything already completed or archived). It is deliberately
 * non-fatal: a failure here must never roll back the completion that the user
 * just performed.
 *
 * @param {number|string} taskId - id of the task that was just completed
 * @returns {Promise<number>} number of ancestors marked completed
 */
export async function completeCarryoverAncestors(taskId) {
  let marked = 0;

  try {
    const rootRes = await db.execute({
      sql: "SELECT carried_over_from_task_id FROM tasks WHERE id = ?",
      args: [parseInt(taskId)],
    });
    if (rootRes.rows.length === 0) return marked;

    let ancestorId = rootRes.rows[0].carried_over_from_task_id;

    while (ancestorId) {
      const updateRes = await db.execute({
        sql: `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'completed' AND status != 'archived'`,
        args: [parseInt(ancestorId)],
      });

      if (updateRes.rowsAffected === 0) break; // chain end or already completed/archived

      marked += updateRes.rowsAffected;

      const nextRes = await db.execute({
        sql: "SELECT carried_over_from_task_id FROM tasks WHERE id = ?",
        args: [parseInt(ancestorId)],
      });
      if (nextRes.rows.length === 0) break;
      ancestorId = nextRes.rows[0].carried_over_from_task_id;
    }
  } catch (e) {
    console.error(
      "[taskCarryover] completeCarryoverAncestors failed (non-fatal):",
      e.message,
    );
  }

  return marked;
}
