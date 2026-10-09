import db from "@/lib/db";

/**
 * CRM Opportunity Stage History model.
 *
 * Append-only log of every stage transition. Never overwritten.
 * Part of CRM Phase 3.
 */

/** All history for one opportunity, newest first. */
export async function getCrmStageHistory(opportunityId) {
  return db.execute({
    sql: `
      SELECT
        h.*,
        fs.name  AS from_stage_name,
        ts.name  AS to_stage_name,
        c.name   AS changed_by_name
      FROM crm_opportunity_stage_history h
      LEFT JOIN crm_pipeline_stages fs ON fs.id = h.from_stage_id
      JOIN  crm_pipeline_stages ts ON ts.id = h.to_stage_id
      LEFT JOIN contacts c ON c.cid = h.changed_by
      WHERE h.opportunity_id = ?
      ORDER BY h.changed_at DESC
    `,
    args: [opportunityId],
  });
}

/** Insert one stage history record. Always appends — never updates. */
export async function appendCrmStageHistory({
  opportunity_id,
  from_stage_id,
  to_stage_id,
  changed_by,
  metadata,
}) {
  return db.execute({
    sql: `INSERT INTO crm_opportunity_stage_history
            (opportunity_id, from_stage_id, to_stage_id, changed_by, metadata)
          VALUES (?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      opportunity_id,
      from_stage_id ?? null,
      to_stage_id,
      changed_by ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ],
  });
}
