import db from "@/lib/db";

/**
 * The person recorded as a program's manager — the relationship the program
 * scope rule matches on. Used by the readiness report's repair action and by
 * the assignment-derived grant reconcile that follows a change.
 */
export async function getProgramManager(programId) {
  return db.execute({
    sql: `SELECT CAST(p.id AS TEXT) AS id, p.name, CAST(p.assigned_pm_id AS TEXT) AS assigned_pm_id,
                 c.name AS pm_name
          FROM v2_programs p
          LEFT JOIN contacts c ON c.cid = CAST(p.assigned_pm_id AS TEXT)
          WHERE CAST(p.id AS TEXT) = ?
          LIMIT 1`,
    args: [String(programId)],
  });
}

/**
 * Record who manages a program (or clear it with null).
 *
 * A program with no recorded manager can never be matched by the program scope
 * rule, which would make it unreachable to everyone but the portfolio identity —
 * so assigning one is the repair step that has to precede enforcing that rule.
 * The caller reconciles the assignment-derived grants for both the new and the
 * previous manager; this function only records the relationship.
 */
export async function setProgramManager(programId, managerCid) {
  return db.execute({
    sql: "UPDATE v2_programs SET assigned_pm_id = ? WHERE CAST(id AS TEXT) = ?",
    args: [managerCid || null, String(programId)],
  });
}
