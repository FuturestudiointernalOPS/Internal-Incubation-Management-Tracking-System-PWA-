import db from "@/lib/db";

/**
 * CRM dashboard reads (REPOSITORY layer).
 *
 * The action dashboard answers "what needs attention now?" over the whole
 * workspace — the perimeter is shared, never filtered by owner (product
 * decision, Lot 1). Every statement is a read; the composition lives in
 * `@/services/crm/dashboard`.
 *
 * Definitions used here, kept explicit because they drive what a team sees:
 *  - a next action is overdue when its due date is before today;
 *  - a record with a dedicated next action is what counts — the fallback on the
 *    earliest task/meeting is resolved on the record screen, not aggregated;
 *  - a lead awaiting qualification is `not_assessed` or `in_review`;
 *  - a dormant opportunity has had NO manual activity for the stale window,
 *    measured on the activity date, falling back to the record's creation.
 */

const OPEN_LEAD_STATUSES = "COALESCE(l.status,'new') NOT IN ('converted','lost','unqualified')";

/** One row of scalar counts, so the dashboard costs one round-trip. */
export async function getCrmDashboardCounts() {
  return db.execute({
    sql: `
      SELECT
        (SELECT COUNT(*) FROM crm_leads l
          WHERE l.deleted_at IS NULL
            AND l.next_action IS NOT NULL
            AND l.next_action_due < CURRENT_DATE
            AND ${OPEN_LEAD_STATUSES}
        ) AS overdue_leads,
        (SELECT COUNT(*) FROM crm_opportunities o
          WHERE o.deleted_at IS NULL
            AND o.status = 'active'
            AND o.next_action IS NOT NULL
            AND o.next_action_due < CURRENT_DATE
        ) AS overdue_opportunities,
        (SELECT COUNT(*) FROM crm_leads l
          WHERE l.deleted_at IS NULL
            AND l.next_action IS NOT NULL
            AND l.next_action_due >= CURRENT_DATE
            AND l.next_action_due < CURRENT_DATE + INTERVAL '7 days'
            AND ${OPEN_LEAD_STATUSES}
        ) AS soon_leads,
        (SELECT COUNT(*) FROM crm_opportunities o
          WHERE o.deleted_at IS NULL
            AND o.status = 'active'
            AND o.next_action IS NOT NULL
            AND o.next_action_due >= CURRENT_DATE
            AND o.next_action_due < CURRENT_DATE + INTERVAL '7 days'
        ) AS soon_opportunities,
        (SELECT COUNT(*) FROM crm_leads l
          WHERE l.deleted_at IS NULL
            AND l.qualification_state IN ('not_assessed','in_review')
            AND ${OPEN_LEAD_STATUSES}
        ) AS awaiting_qualification,
        (SELECT COUNT(*) FROM crm_opportunities o
          WHERE o.deleted_at IS NULL
            AND o.status = 'active'
            AND COALESCE(
                  (SELECT MAX(a.activity_date) FROM crm_activities a WHERE a.opportunity_id = o.id),
                  o.created_at
                ) < NOW() - INTERVAL '14 days'
        ) AS stale_opportunities
    `,
  });
}

/** The most overdue next actions across leads and opportunities, soonest first. */
export async function getCrmOverdueNextActions(limit = 5) {
  return db.execute({
    sql: `
      SELECT * FROM (
        SELECT
          'lead' AS kind,
          l.id::text AS id,
          l.title,
          l.next_action,
          l.next_action_due AS due,
          own.name AS owner_name
        FROM crm_leads l
        LEFT JOIN contacts own ON own.cid = l.owner_cid
        WHERE l.deleted_at IS NULL
          AND l.next_action IS NOT NULL
          AND l.next_action_due < CURRENT_DATE
          AND ${OPEN_LEAD_STATUSES}

        UNION ALL

        SELECT
          'opportunity' AS kind,
          o.id::text AS id,
          o.name AS title,
          o.next_action,
          o.next_action_due AS due,
          own.name AS owner_name
        FROM crm_opportunities o
        LEFT JOIN contacts own ON own.cid = o.owner_cid
        WHERE o.deleted_at IS NULL
          AND o.status = 'active'
          AND o.next_action IS NOT NULL
          AND o.next_action_due < CURRENT_DATE
      ) items
      ORDER BY due ASC
      LIMIT ?
    `,
    args: [Math.max(1, Math.min(50, Number(limit) || 5))],
  });
}

/** Active opportunities that have had no manual activity for the stale window. */
export async function getCrmStaleOpportunities(limit = 5) {
  return db.execute({
    sql: `
      SELECT
        o.id::text AS id,
        o.name,
        o.owner_cid,
        own.name AS owner_name,
        COALESCE(
          (SELECT MAX(a.activity_date) FROM crm_activities a WHERE a.opportunity_id = o.id),
          o.created_at
        ) AS last_activity_at
      FROM crm_opportunities o
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
    args: [Math.max(1, Math.min(50, Number(limit) || 5))],
  });
}

/**
 * Active value per pipeline, split by currency.
 *
 * Values are never summed across currencies: a total that mixes XOF and EUR is
 * a wrong number, so each currency is its own line.
 */
export async function getCrmPipelineValueByCurrency() {
  return db.execute({
    sql: `
      SELECT
        p.id::text AS id,
        p.name,
        o.currency,
        COALESCE(SUM(o.value), 0) AS value,
        COUNT(o.id) AS opportunity_count
      FROM crm_pipelines p
      LEFT JOIN crm_opportunities o
        ON o.pipeline_id = p.id
       AND o.deleted_at IS NULL
       AND o.status = 'active'
       AND o.value IS NOT NULL
      WHERE p.is_active = true
      GROUP BY p.id, p.name, o.currency
      ORDER BY p.name ASC, o.currency ASC
    `,
  });
}

/**
 * Won / lost counts and the average time an opportunity actually spends in a
 * stage.
 *
 * The dwell time comes from the append-only stage history: each row is a stage
 * entry, and the next row is the moment it was left. Only completed visits
 * count (an opportunity still sitting in a stage has not finished it), and
 * creation writes the first row, so the initial stage is measured too.
 */
export async function getCrmPerformance() {
  return db.execute({
    sql: `
      WITH transitions AS (
        SELECT
          opportunity_id,
          to_stage_id,
          changed_at,
          LEAD(changed_at) OVER (
            PARTITION BY opportunity_id ORDER BY changed_at ASC
          ) AS left_at
        FROM crm_opportunity_stage_history
      ),
      latest AS (
        SELECT
          opportunity_id,
          to_stage_id,
          changed_at,
          ROW_NUMBER() OVER (
            PARTITION BY opportunity_id ORDER BY changed_at DESC
          ) AS rn
        FROM crm_opportunity_stage_history
      ),
      closed AS (
        SELECT o.id, s.outcome, latest.changed_at
        FROM crm_opportunities o
        JOIN latest ON latest.opportunity_id = o.id AND latest.rn = 1
        JOIN crm_pipeline_stages s ON s.id = latest.to_stage_id
        WHERE o.deleted_at IS NULL
          AND o.status IN ('won', 'lost')
          AND s.outcome IN ('won', 'lost')
      )
      SELECT
        (SELECT COUNT(*) FROM crm_opportunities
          WHERE deleted_at IS NULL AND status = 'won') AS won,
        (SELECT COUNT(*) FROM crm_opportunities
          WHERE deleted_at IS NULL AND status = 'lost') AS lost,
        (SELECT AVG(EXTRACT(EPOCH FROM (left_at - changed_at)) / 86400.0)
           FROM transitions
          WHERE left_at IS NOT NULL AND left_at > changed_at
        ) AS avg_stage_days,
        (SELECT COUNT(*) FROM transitions
          WHERE left_at IS NOT NULL AND left_at > changed_at
        ) AS completed_transitions,
        -- The closing moment is when the record entered its terminal stage,
        -- read from the append-only history, not the row's updated_at (which
        -- any later edit would move).
        (SELECT COUNT(*) FROM closed
          WHERE outcome = 'won' AND changed_at >= NOW() - INTERVAL '90 days') AS won_90,
        (SELECT COUNT(*) FROM closed
          WHERE outcome = 'lost' AND changed_at >= NOW() - INTERVAL '90 days') AS lost_90
    `,
  });
}
