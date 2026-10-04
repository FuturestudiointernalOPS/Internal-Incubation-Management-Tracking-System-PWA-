import db from "@/lib/db";

/**
 * Facilitation model — deliverables (REPOSITORY layer).
 *
 * The program-deliverable create and listing statements. Split verbatim out of
 * `models/facilitation.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Create a deliverable row, returning its id. */
export async function createDeliverable(deliverable) {
  return db.execute({
    sql: `INSERT INTO v2_deliverables (program_id, title, description, week_number)
                 VALUES (?, ?, ?, ?) RETURNING id`,
    args: [
      deliverable.program_id,
      deliverable.title,
      deliverable.description || null,
      deliverable.week_number || 1,
    ],
  });
}

/** Deliverable rows ordered by week (optionally for one program). */
export async function listDeliverables(programId) {
  let sql = "SELECT * FROM v2_deliverables";
  let args = [];
  if (programId) {
    sql += " WHERE program_id = ?";
    args.push(programId);
  }
  sql += " ORDER BY week_number ASC";

  return db.execute({ sql, args });
}
