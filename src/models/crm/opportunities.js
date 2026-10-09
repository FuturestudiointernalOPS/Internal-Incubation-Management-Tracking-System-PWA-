import db from "@/lib/db";

/**
 * CRM Opportunities model — data access for crm_opportunities.
 *
 * Part of CRM Phase 3.
 * Pure data layer — no HTTP imports.
 *
 * ARCHITECTURAL NOTE: Never touches investment_pipeline or any fundraising
 * table. The fundraising pipeline is a separate, independent ImpactOS module.
 */

// ─── READ ────────────────────────────────────────────────────────────────────

/** List opportunities with optional filters. Joins for display names. */
export async function getCrmOpportunities({
  pipelineId,
  stageId,
  ownerCid,
  status,
  contactCid,
  organizationId,
} = {}) {
  let sql = `
    SELECT
      o.*,
      pl.name                AS pipeline_name,
      ps.name                AS stage_name,
      ps.position            AS stage_position,
      ps.is_terminal         AS stage_is_terminal,
      ps.outcome             AS stage_outcome,
      own.name               AS owner_name,
      c.name                 AS contact_name,
      c.email                AS contact_email,
      org.name               AS organization_name,
      l.title                AS lead_title
    FROM crm_opportunities o
    JOIN crm_pipelines        pl  ON pl.id  = o.pipeline_id
    JOIN crm_pipeline_stages  ps  ON ps.id  = o.stage_id
    LEFT JOIN contacts        own ON own.cid = o.owner_cid
    LEFT JOIN contacts        c   ON c.cid  = o.contact_cid
    LEFT JOIN crm_organizations org ON org.id = o.organization_id
    LEFT JOIN crm_leads       l   ON l.id   = o.lead_id
    WHERE o.deleted_at IS NULL
  `;
  const args = [];

  if (pipelineId)     { sql += ` AND o.pipeline_id = ?`;     args.push(pipelineId); }
  if (stageId)        { sql += ` AND o.stage_id = ?`;        args.push(stageId); }
  if (ownerCid)       { sql += ` AND o.owner_cid = ?`;       args.push(ownerCid); }
  if (status)         { sql += ` AND o.status = ?`;          args.push(status); }
  if (contactCid)     { sql += ` AND o.contact_cid = ?`;     args.push(contactCid); }
  if (organizationId) { sql += ` AND o.organization_id = ?`; args.push(organizationId); }

  sql += ` ORDER BY o.updated_at DESC`;

  return db.execute({ sql, args });
}

/** Single opportunity by id with all joins. */
export async function getCrmOpportunityById(id) {
  return db.execute({
    sql: `
      SELECT
        o.*,
        pl.name                AS pipeline_name,
        pl.type                AS pipeline_type,
        ps.name                AS stage_name,
        ps.position            AS stage_position,
        ps.probability         AS stage_probability,
        ps.is_terminal         AS stage_is_terminal,
        ps.outcome             AS stage_outcome,
        own.name               AS owner_name,
        c.name                 AS contact_name,
        c.email                AS contact_email,
        org.name               AS organization_name,
        l.title                AS lead_title,
        l.status               AS lead_status
      FROM crm_opportunities o
      JOIN crm_pipelines        pl  ON pl.id  = o.pipeline_id
      JOIN crm_pipeline_stages  ps  ON ps.id  = o.stage_id
      LEFT JOIN contacts        own ON own.cid = o.owner_cid
      LEFT JOIN contacts        c   ON c.cid  = o.contact_cid
      LEFT JOIN crm_organizations org ON org.id = o.organization_id
      LEFT JOIN crm_leads       l   ON l.id   = o.lead_id
      WHERE o.id = ? AND o.deleted_at IS NULL
    `,
    args: [id],
  });
}

/** Pipeline metrics for the dashboard. */
export async function getCrmPipelineMetrics(pipelineId) {
  return db.execute({
    sql: `
      SELECT
        COUNT(*)                                         AS total,
        COUNT(*) FILTER (WHERE status = 'active')       AS active_count,
        COUNT(*) FILTER (WHERE status = 'won')          AS won_count,
        COUNT(*) FILTER (WHERE status = 'lost')         AS lost_count,
        COALESCE(SUM(value) FILTER (WHERE status = 'active'), 0)  AS pipeline_value,
        COALESCE(SUM(value) FILTER (WHERE status = 'won'),    0)  AS won_value,
        COALESCE(SUM(value) FILTER (WHERE status = 'lost'),   0)  AS lost_value,
        COALESCE(SUM(value * probability / 100.0)
          FILTER (WHERE status = 'active' AND value IS NOT NULL AND probability IS NOT NULL), 0)
                                                        AS weighted_value
      FROM crm_opportunities
      WHERE deleted_at IS NULL
        -- The ::uuid casts give Postgres the parameter type: a bare "$1 IS NULL"
        -- is indeterminate and fails with 42P18.
        AND (?::uuid IS NULL OR pipeline_id = ?::uuid)
    `,
    args: [pipelineId ?? null, pipelineId ?? null],
  });
}

/** Count of opportunities grouped by stage for board view. */
export async function getCrmOpportunitiesByStage(pipelineId) {
  return db.execute({
    sql: `
      SELECT
        ps.id             AS stage_id,
        ps.name           AS stage_name,
        ps.position,
        ps.probability    AS stage_probability,
        ps.is_terminal,
        ps.outcome,
        COUNT(o.id)       AS opportunity_count,
        COALESCE(SUM(o.value), 0) AS stage_value
      FROM crm_pipeline_stages ps
      LEFT JOIN crm_opportunities o
        ON o.stage_id = ps.id AND o.deleted_at IS NULL
      WHERE ps.pipeline_id = ? AND ps.is_active = true
      GROUP BY ps.id, ps.name, ps.position, ps.probability, ps.is_terminal, ps.outcome
      ORDER BY ps.position ASC
    `,
    args: [pipelineId],
  });
}

// ─── WRITE ───────────────────────────────────────────────────────────────────

export async function createCrmOpportunity({
  name, description, lead_id, contact_cid, organization_id,
  pipeline_id, stage_id, owner_cid, value, currency,
  probability, expected_close_date, created_by,
}) {
  return db.execute({
    sql: `INSERT INTO crm_opportunities
            (name, description, lead_id, contact_cid, organization_id,
             pipeline_id, stage_id, owner_cid, value, currency,
             probability, expected_close_date, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      name,
      description ?? null,
      lead_id ?? null,
      contact_cid ?? null,
      organization_id ?? null,
      pipeline_id,
      stage_id,
      owner_cid ?? null,
      value ?? null,
      currency ?? null,
      probability ?? null,
      expected_close_date ?? null,
      created_by ?? null,
    ],
  });
}

export async function updateCrmOpportunity(id, updates) {
  const allowed = [
    'name', 'description', 'contact_cid', 'organization_id',
    'owner_cid', 'value', 'currency', 'probability',
    'expected_close_date', 'status', 'lost_reason',
  ];
  const sets = [];
  const args = [];
  for (const f of allowed) {
    if (updates[f] !== undefined) { sets.push(`${f} = ?`); args.push(updates[f]); }
  }
  if (!sets.length) return getCrmOpportunityById(id);
  sets.push('updated_at = NOW()');
  args.push(id);
  return db.execute({
    sql: `UPDATE crm_opportunities SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL RETURNING *`,
    args,
  });
}

/** Move stage — updates stage_id only. Stage history is written by the service layer. */
export async function setCrmOpportunityStage(id, stageId, status) {
  return db.execute({
    sql: `UPDATE crm_opportunities
          SET stage_id   = ?,
              status     = COALESCE(?, status),
              updated_at = NOW()
          WHERE id = ? AND deleted_at IS NULL
          RETURNING *`,
    args: [stageId, status ?? null, id],
  });
}

export async function softDeleteCrmOpportunity(id, deletedByCid) {
  return db.execute({
    sql: `UPDATE crm_opportunities
          SET deleted_at = NOW(), deleted_by = ?, updated_at = NOW()
          WHERE id = ? AND deleted_at IS NULL RETURNING id`,
    args: [deletedByCid ?? null, id],
  });
}
