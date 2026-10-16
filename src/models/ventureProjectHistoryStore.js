/**
 * Venture project history — statements (REPOSITORY layer).
 *
 * The reads and the purge behind `@/services/ventures/projectHistory`: what the
 * project-management history currently holds, and the statements that clear it.
 *
 * WHY THIS FILE OWNS A BATCH, WHEN THE RULE IS "ONE STATEMENT PER FUNCTION"
 *
 * Clearing the history has to be ATOMIC: a failure halfway through would leave a
 * Venture with milestones and no tasks, or tasks and no journey — a state no
 * screen can explain and no restore can undo. So the deletes are one unit, run
 * through `db.transaction`, and they have to live together. Each statement is
 * still a single, named delete with no decisions attached; the DECISION to run
 * them at all is the service's.
 *
 * SCOPE (see `@/services/ventures/projectHistory` for the same list as data):
 * only the project-management content — the journey, its milestones, the
 * activities and the deliverables, and the records that hang off those. Venture
 * profiles, members and founders, staff assignments, permissions, notes, plans,
 * documents, verifications, coaching and financial records are NOT touched here
 * and are not referenced by this file at all.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, no decisions.
 */

import db from "@/lib/db";

/**
 * The purge, in DELETE order — children before the parents they hang off.
 *
 * `venture_tasks.parent_task_id` is `ON DELETE SET NULL`, so subtasks do not
 * need unwinding: one delete removes every task, and the self-reference is
 * cleared by the engine. `venture_deliverables` is deleted explicitly rather
 * than left to `SET NULL`, so the order is readable and the counts are real.
 */
const PURGE_STATEMENTS = [
  ["venture_task_activity", "DELETE FROM venture_task_activity"],
  ["venture_task_attachments", "DELETE FROM venture_task_attachments"],
  ["venture_task_comments", "DELETE FROM venture_task_comments"],
  ["venture_task_reviews", "DELETE FROM venture_task_reviews"],
  ["venture_task_submissions", "DELETE FROM venture_task_submissions"],
  ["venture_deliverable_reviews", "DELETE FROM venture_deliverable_reviews"],
  ["venture_dependencies", "DELETE FROM venture_dependencies"],
  ["venture_deliverables", "DELETE FROM venture_deliverables"],
  ["venture_milestone_activity", "DELETE FROM venture_milestone_activity"],
  ["venture_tasks", "DELETE FROM venture_tasks"],
  ["venture_milestones", "DELETE FROM venture_milestones"],
  ["venture_journey_stages", "DELETE FROM venture_journey_stages"],
];

/** The tables this purge clears, in delete order — for tests, UI and reports. */
export const PROJECT_HISTORY_TABLES = PURGE_STATEMENTS.map(([table]) => table);

/**
 * How much project-management history exists right now, per table (one round
 * trip). Used by the confirmation dialog, so the administrator sees the size of
 * what they are about to remove, and by the report after it ran.
 */
export function selectProjectHistoryCounts() {
  const counts = PURGE_STATEMENTS.map(([table]) => `SELECT '${table}' AS t, count(*)::int AS rows FROM ${table}`);
  return db.execute({
    sql: `${counts.join(" UNION ALL ")} ORDER BY t`,
    args: [],
  });
}

/**
 * Clear the project-management history of EVERY Venture, atomically.
 *
 * Returns `{ tables: [{ table, rows }], removed }`. Throws (and rolls back
 * everything) on the first failure — a partial clear is never committed.
 *
 * There is no `WHERE`: the scope IS "all Ventures", which is exactly the action
 * the administrator confirmed. Nothing outside PROJECT_HISTORY_TABLES is read
 * or written.
 */
export async function purgeVentureProjectHistory() {
  return db.transaction(async (query) => {
    const tables = [];
    let removed = 0;
    for (const [table, sql] of PURGE_STATEMENTS) {
      const result = await query(sql, []);
      const rows = result?.rowsAffected ?? 0;
      tables.push({ table, rows });
      removed += rows;
    }
    return { tables, removed };
  });
}
