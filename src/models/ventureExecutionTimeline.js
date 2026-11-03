import db from "@/lib/db";

/**
 * EXECUTION EVIDENCE, MONTH BY MONTH — the data behind "work vs outcome".
 *
 * Two facts, both timestamped by the SYSTEM rather than typed by the founder:
 * a deliverable belongs to the month it was APPROVED, a journey stage to the
 * month it was COMPLETED. Milestones are deliberately NOT counted — the table
 * has no completion date (only `updated_at`, which any edit moves), so a
 * milestone month would be a guess wearing a number's clothes.
 */

/** Deliverables a reviewer approved, grouped by the month of approval. */
export async function selectApprovedDeliverablesByMonth(ventureDbId) {
  return db.execute({
    sql: `SELECT to_char(date_trunc('month', reviewed_at), 'YYYY-MM') AS period,
                 COUNT(*)::int AS approved
            FROM venture_deliverables
           WHERE venture_id::text = ?
             AND approval_status = 'approved'
             AND reviewed_at IS NOT NULL
           GROUP BY 1
           ORDER BY 1`,
    args: [String(ventureDbId)],
  });
}

/** Journey stages completed, grouped by the month they were completed. */
export async function selectCompletedStagesByMonth(ventureDbId) {
  return db.execute({
    sql: `SELECT to_char(date_trunc('month', completed_at), 'YYYY-MM') AS period,
                 COUNT(*)::int AS completed
            FROM venture_journey_stages
           WHERE venture_id::text = ?
             AND completed_at IS NOT NULL
           GROUP BY 1
           ORDER BY 1`,
    args: [String(ventureDbId)],
  });
}
