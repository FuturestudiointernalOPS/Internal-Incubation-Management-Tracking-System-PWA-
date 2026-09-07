/**
 * Task Audit Logger
 *
 * Logs every task action to the immutable task_assignment_log table.
 * Each entry records: actor, target user, previous state, new state, action type.
 *
 * This is a WRITE-ONLY store — no update/delete operations are exposed.
 */

import db, { initDb } from "@/lib/db";

const ACTION_TYPES = {
  TASK_CREATED: 'TASK_CREATED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_ACCEPTED: 'TASK_ACCEPTED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_CARRIED_OVER: 'TASK_CARRIED_OVER',
  TASK_BLOCKED: 'TASK_BLOCKED',
  TASK_UNBLOCKED: 'TASK_UNBLOCKED',
};

async function logTaskEvent({
  task_id,
  project_id,
  actor_id,
  target_user_id,
  action_type,
  previous_state,
  new_state,
  description,
}) {
  try {
    await initDb();
    await db.execute({
      sql: `INSERT INTO task_assignment_log
        (task_id, project_id, actor_id, target_user_id, action_type, previous_state, new_state, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        parseInt(task_id),
        project_id || null,
        actor_id,
        target_user_id || null,
        action_type,
        previous_state ? JSON.stringify(previous_state) : null,
        new_state ? JSON.stringify(new_state) : null,
        description || null,
      ],
    });
  } catch (e) {
    console.error("Task audit log error:", e.message);
  }
}

export { logTaskEvent, ACTION_TYPES };
