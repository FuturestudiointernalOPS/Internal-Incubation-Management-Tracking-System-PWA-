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
