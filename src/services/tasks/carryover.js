/**
 * Tasks — carry-over use cases (SERVICE layer).
 *
 * The domain work behind `/api/tasks/carryover`. The CONTROLLER authenticates
 * and validates; everything below is the carry-over rule set:
 *
 *   - who may carry a task (its owner, assignee or supervisor — or a portfolio
 *     role) and which rows a caller may list;
 *   - the chain walk: the newest OPEN copy is the one cloned, so a task is never
 *     cloned twice and a finished copy is never revived;
 *   - the safety guards: completed/archived tasks are never cloned (409), and a
 *     copy already living in the target week is not cloned again (idempotency);
 *   - the migration order: clone → blockers → comments → resources → subtasks →
 *     flip the source to carried_over.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  getCarryoverEligibleTasks,
  getBlockersForTask,
  getTaskRowById,
  getLatestCarriedOverClone,
  createCarriedOverClone,
  migrateBlockersToTask,
  migrateCommentsToTask,
  migrateResourcesToTask,
  reparentSubtasksToTask,
  markTaskCarriedOver,
} from "@/models/taskLifecycle";
import {
  seesWholePortfolio,
  resolveListingScope,
} from "@/services/authorization/listingScope";
import { ownsTask } from "./access";

/** The tasks a caller may carry over this week, each with its blockers. */
export async function listCarryoverTasks({
  role,
  sessionCid,
  requestedCid,
  weekNumber,
  year,
}) {
  const scope = resolveListingScope({
    role,
    sessionCid,
    requestedCid,
    denialMessage: "You can only view your own tasks.",
  });
  if (scope.denied) return { status: 403, error: scope.denied };

  const result = await getCarryoverEligibleTasks(scope.cid, weekNumber, year);
  const tasks = await Promise.all(
    result.rows.map(async (task) => {
      const blockersResult = await getBlockersForTask(task.id);
      return { ...task, blockers: blockersResult.rows || [] };
    }),
  );
  return { status: 200, body: { success: true, tasks } };
}

/**
 * Carry a task over into a target week: clone its newest OPEN copy, migrate its
 * dependants, and flip the source.
 *
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function carryOverTask({
  taskId,
  targetWeek,
  targetYear,
  actorName,
  role,
  sessionCid,
}) {
  const oldId = parseInt(taskId);

  // 1. The task the caller asked to carry.
  const originalResult = await getTaskRowById(oldId);
  if (originalResult.rows.length === 0) {
    return { status: 404, error: "Task not found" };
  }
  const originalTask = originalResult.rows[0];

  // Object-level authorization: only the task's owner, assignee, supervisor —
  // or a portfolio role — may carry it over. Otherwise any authenticated user
  // could flip anyone's task by id.
  if (!seesWholePortfolio(role) && !ownsTask(originalTask, sessionCid)) {
    return { status: 403, error: "You can only carry over your own tasks." };
  }

  // 2. Follow the chain forward to find the LATEST clone (not the original).
  // This prevents repeatedly cloning the same original each week. Completed or
  // archived copies are never carried again — a finished task stays finished.
  let taskToClone = originalTask;
  while (true) {
    const nextCloneResult = await getLatestCarriedOverClone(taskToClone.id);
    if (nextCloneResult.rows.length === 0) break;
    taskToClone = nextCloneResult.rows[0];
  }
  const sourceTask = taskToClone;

  // 2b. Safety: never clone or flip a completed/archived task.
  if (sourceTask.status === "completed" || sourceTask.status === "archived") {
    const error = "Completed tasks cannot be carried over.";
    return { status: 409, error, body: { success: false, error, status: 409 } };
  }

  // 2c. Idempotency: the newest open copy already lives in the target week —
  // it was carried over already, so do not clone it a second time.
  if (
    Number(sourceTask.created_week) === Number(targetWeek) &&
    Number(sourceTask.created_year) === Number(targetYear)
  ) {
    return {
      status: 200,
      body: {
        success: true,
        id: sourceTask.id,
        oldId,
        action: "already_carried_over",
      },
    };
  }

  const sourceId = sourceTask.id;

  // 3. Clone the LATEST task — all fields including context are preserved.
  // The clone belongs to the task's owner; the actor comes from the session.
  const cloneResult = await createCarriedOverClone({
    user_id: originalTask.user_id,
    user_name: actorName,
    target_week: targetWeek,
    target_year: targetYear,
    sourceId,
    sourceTask,
  });
  const newId = Number(cloneResult.rows[0]?.id ?? cloneResult.lastInsertRowid);

  // 4-7. Move the dependants of the LATEST task (not the original) across.
  await migrateBlockersToTask(newId, sourceId);
  try {
    await migrateCommentsToTask(newId, sourceId);
  } catch {
    /* table may not exist yet */
  }
  try {
    await migrateResourcesToTask(newId, sourceId);
  } catch {
    /* table may not exist yet */
  }
  await reparentSubtasksToTask(newId, sourceId);

  // 8. Flip the LATEST task to carried_over (guarded in the model).
  await markTaskCarriedOver(sourceId);

  return {
    status: 200,
    body: { success: true, id: newId, oldId, action: "carried_over" },
  };
}
