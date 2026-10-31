import db from "@/lib/db";

/**
 * CRM time-based triggers — the records a scheduled rule can act on
 * (REPOSITORY layer).
 *
 * An event-driven rule fires on a write. A time-based rule has no write to
 * listen to, so these reads find the records that have crossed a threshold:
 *  - stale: no manual activity for the dormant window (14 days);
 *  - stuck: past the current stage's own target duration.
 *
 * Each row is returned in the shape the rule conditions evaluate (`status`,
 * `value`, `stage_name`, …) because the engine reads the context, not the row.
 */

const clamp = (limit) => Math.max(1, Math.min(200, Number(limit) || 100));

const OPEN_LEAD = "COALESCE(l.status, 'new') NOT IN ('converted', 'lost', 'unqualified')";

/** Open leads with no manual activity for the dormant window. */
export async function getStaleLeadCandidates(limit = 100) {
  return db.execute({
    sql: `
      SELECT
        l.*,
        own.name AS owner_name,
        c.name   AS contact_name,
        org.name AS organization_name,
        COALESCE(
          (SELECT MAX(a.activity_date) FROM crm_activities a WHERE a.lead_id = l.id),
          l.created_at
        ) AS last_activity_at
      FROM crm_leads l
      LEFT JOIN contacts own ON own.cid = l.owner_cid
      LEFT JOIN contacts c ON c.cid = l.contact_cid
      LEFT JOIN crm_organizations org ON org.id = l.organization_id AND org.deleted_at IS NULL
      WHERE l.deleted_at IS NULL
        AND ${OPEN_LEAD}
        AND COALESCE(
              (SELECT MAX(a.activity_date) FROM crm_activities a WHERE a.lead_id = l.id),
              l.created_at
            ) < NOW() - INTERVAL '14 days'
      ORDER BY last_activity_at ASC
      LIMIT ?
    `,
    args: [clamp(limit)],
  });
}

/** Active opportunities with no manual activity for the dormant window. */
export async function getStaleOpportunityCandidates(limit = 100) {
  return db.execute({
    sql: `
      SELECT
        o.*,
        p.name AS pipeline_name,
        s.name AS stage_name,
        own.name AS owner_name,
        COALESCE(
          (SELECT MAX(a.activity_date) FROM crm_activities a WHERE a.opportunity_id = o.id),
          o.created_at
        ) AS last_activity_at
      FROM crm_opportunities o
      JOIN crm_pipelines p ON p.id = o.pipeline_id
      JOIN crm_pipeline_stages s ON s.id = o.stage_id
      LEFT JOIN contacts own ON own.cid = o.owner_cid
      WHERE o.deleted_at IS NULL
        AND o.status = 'active'
        AND COALESCE(
              (SELECT MAX(a.activity_date) FROM crm_activities a WHERE a.opportunity_id = o.id),
              o.created_at
            ) < NOW() - INTERVAL '14 days'
      ORDER BY last_activity_at ASC
      LIMIT ?
    `,
    args: [clamp(limit)],
  });
}

/** Active opportunities past their current stage's target duration. */
export async function getStuckOpportunityCandidates(limit = 100) {
  return db.execute({
    sql: `
      SELECT
        o.*,
        p.name AS pipeline_name,
        s.name AS stage_name,
        s.target_days,
        own.name AS owner_name,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(hist.entered_at, o.created_at))) / 86400.0) AS days_in_stage
      FROM crm_opportunities o
      JOIN crm_pipelines p ON p.id = o.pipeline_id
      JOIN crm_pipeline_stages s ON s.id = o.stage_id
      LEFT JOIN contacts own ON own.cid = o.owner_cid
      LEFT JOIN LATERAL (
        SELECT MAX(h.changed_at) AS entered_at
        FROM crm_opportunity_stage_history h
        WHERE h.opportunity_id = o.id
      ) hist ON true
      WHERE o.deleted_at IS NULL
        AND o.status = 'active'
        AND s.is_terminal = false
        AND COALESCE(hist.entered_at, o.created_at)
            < NOW() - (s.target_days * INTERVAL '1 day')
      ORDER BY days_in_stage DESC
      LIMIT ?
    `,
    args: [clamp(limit)],
  });
}
