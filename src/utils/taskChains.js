/**
 * taskChains — display helper for carry-over chains.
 *
 * A carried task exists once per week (each copy links to the previous one via
 * carried_over_from_task_id). Lists of "my tasks" should show ONE row per task
 * family: the NEWEST copy. Older copies remain in the database (weekly reports
 * and history keep them) — this only collapses what is rendered.
 *
 * Subtasks (parent_task_id set) always pass through untouched.
 */

/** Newest copy of a chain, from any member of that chain. */
function newestOf(task, byId, childrenOf) {
  let currentTask = task;
  const seen = new Set();
  while (!seen.has(currentTask.id)) {
    seen.add(currentTask.id);
    const successorCopies = (childrenOf.get(currentTask.id) || [])
      .filter((copy) => copy.status !== "archived")
      .sort(
        (first, second) =>
          (second.created_year || 0) - (first.created_year || 0) ||
          (second.created_week || 0) - (first.created_week || 0) ||
          (second.id || 0) - (first.id || 0),
      );
    const nextCopy = successorCopies[0];
    if (!nextCopy || !byId.has(nextCopy.id)) break;
    currentTask = nextCopy;
  }
  return currentTask;
}

/**
 * Collapse a task list so each carry-over chain appears only once
 * (its newest copy is kept). Idempotent and pure.
 *
 * @param {Array<object>} tasks - task rows (must include carried_over_from_task_id)
 * @returns {Array<object>} one row per chain (newest), subtasks untouched
 */
export function collapseChains(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return tasks || [];

  const byId = new Map();
  const childrenOf = new Map(); // source id -> copies pointing at it

  for (const task of tasks) {
    byId.set(task.id, task);
    if (!task.carried_over_from_task_id) continue;
    const parentTaskId = task.carried_over_from_task_id;
    if (!childrenOf.has(parentTaskId)) childrenOf.set(parentTaskId, []);
    childrenOf.get(parentTaskId).push(task);
  }

  const kept = new Set();
  const result = [];

  for (const task of tasks) {
    if (task.parent_task_id) {
      result.push(task); // sub-tasks always render under their parent
      continue;
    }
    const head = newestOf(task, byId, childrenOf);
    if (kept.has(head.id)) continue;
    kept.add(head.id);
    result.push(head);
  }

  return result;
}

