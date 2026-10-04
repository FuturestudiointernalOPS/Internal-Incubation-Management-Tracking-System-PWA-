import db from "@/lib/db";

/**
 * Facilitation model — feedback (REPOSITORY layer).
 *
 * The weekly participant-feedback create and listing statements. Split verbatim
 * out of `models/facilitation.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Create a feedback row, returning its id. */
export async function createFeedback(feedback) {
  return db.execute({
    sql: `INSERT INTO v2_feedback (program_id, participant_id, week_number, learnings, accomplishments, suggestions)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      feedback.program_id,
      feedback.participant_id,
      feedback.week_number,
      feedback.learnings || null,
      feedback.accomplishments || null,
      feedback.suggestions || null,
    ],
  });
}

/** Feedback rows joined with participant name, newest first (optionally by program). */
export async function listFeedback(programId) {
  let sql = `SELECT f.*, c.name as participant_name
       FROM v2_feedback f
       LEFT JOIN contacts c ON f.participant_id = c.cid
       WHERE 1=1`;
  let args = [];
  if (programId) {
    sql += " AND f.program_id = ?";
    args.push(programId);
  }
  sql += " ORDER BY f.created_at DESC";

  return db.execute({ sql, args });
}
