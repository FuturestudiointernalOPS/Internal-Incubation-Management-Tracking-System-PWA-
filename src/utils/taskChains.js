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
  let cur = task;
  const seen = new Set();
  while (!seen.has(cur.id)) {
    seen.add(cur.id);
    const clones = (childrenOf.get(cur.id) || [])
      .filter((c) => c.status !== "archived")
      .sort(
        (a, b) =>
          (b.created_year || 0) - (a.created_year || 0) ||
          (b.created_week || 0) - (a.created_week || 0) ||
          (b.id || 0) - (a.id || 0),
      );
    const next = clones[0];
    if (!next || !byId.has(next.id)) break;
    cur = next;
  }
  return cur;
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

  for (const t of tasks) {
    byId.set(t.id, t);
    if (!t.carried_over_from_task_id) continue;
    const key = t.carried_over_from_task_id;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(t);
  }

  const kept = new Set();
  const result = [];

  for (const t of tasks) {
    if (t.parent_task_id) {
      result.push(t); // sub-tasks always render under their parent
      continue;
    }
    const head = newestOf(t, byId, childrenOf);
    if (kept.has(head.id)) continue;
    kept.add(head.id);
    result.push(head);
  }

  return result;
}

/** Number of copies a task family has (including the task itself). */
export function chainLength(task, byId, childrenOf) {
  let n = 0;
  let cur = task;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    n++;
    cur = null;
    // walk forward to newest
    const clones = (childrenOf.get(cur ? cur.id : task.id) || []).filter(
      (c) => c.status !== "archived",
    );
    if (clones.length) cur = clones[0];
  }
  return n;
}
