import db from "@/lib/db";

/**
 * CRM notifications — reads for the attention sweep (REPOSITORY layer).
 *
 * The sweep reuses the platform's existing in-app notification inbox
 * (`v2_notifications`), so a CRM alert appears in the same bell as every other
 * alert. It adds nothing new to that table except the additive columns the
 * inbox already knows how to carry (link, dedupe key, template key, params).
 *
 * The queries return the same shape per kind so the service can compose them:
 * { entity, id, name, owner_cid, … }.
 */

const clamp = (limit) => Math.max(1, Math.min(200, Number(limit) || 100));

let columnsEnsured = null;

/** Additive inbox columns, ensured once per process (the base schema predates them). */
export function ensureCrmNotificationColumns() {
  if (!columnsEnsured) {
    columnsEnsured = (async () => {
      await db.execute("ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS link TEXT");
      await db.execute("ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT");
      await db.execute("ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS template_key TEXT");
      await db.execute("ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS params JSONB");
    })().catch((error) => {
      columnsEnsured = null;
      throw error;
    });
  }
  return columnsEnsured;
}

/** Open leads and opportunities whose dedicated next action is past due. */
export async function getCrmOverdueNotificationCandidates(limit = 100) {
  return db.execute({
    sql: `
      SELECT * FROM (
        SELECT
          'lead' AS entity,
          l.id::text AS id,
          l.title AS name,
          l.owner_cid,
          l.next_action,
          l.next_action_due AS due
        FROM crm_leads l
        WHERE l.deleted_at IS NULL
          AND l.next_action IS NOT NULL
          AND l.next_action_due < CURRENT_DATE
          AND COALESCE(l.status, 'new') NOT IN ('converted', 'lost', 'unqualified')

        UNION ALL

        SELECT
          'opportunity' AS entity,
          o.id::text AS id,
          o.name AS name,
          o.owner_cid,
          o.next_action,
          o.next_action_due AS due
        FROM crm_opportunities o
        WHERE o.deleted_at IS NULL
          AND o.status = 'active'
          AND o.next_action IS NOT NULL
          AND o.next_action_due < CURRENT_DATE
      ) items
      ORDER BY due ASC
      LIMIT ?
    `,
    args: [clamp(limit)],
  });
}

/** Active opportunities with no manual activity for the dormant window. */
export async function getCrmDormantNotificationCandidates(limit = 100) {
  return db.execute({
    sql: `
      SELECT
        o.id::text AS id,
        o.name,
        o.owner_cid,
        COALESCE(
          (SELECT MAX(a.activity_date) FROM crm_activities a WHERE a.opportunity_id = o.id),
          o.created_at
        ) AS last_activity_at
      FROM crm_opportunities o
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
export async function getCrmStuckNotificationCandidates(limit = 100) {
  return db.execute({
    sql: `
      SELECT
        o.id::text AS id,
        o.name,
        o.owner_cid,
        s.name AS stage_name,
        s.target_days,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(hist.entered_at, o.created_at))) / 86400.0) AS days_in_stage
      FROM crm_opportunities o
      JOIN crm_pipeline_stages s ON s.id = o.stage_id
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

/** Whether this recipient already holds a notification with this dedupe key. */
export async function findCrmNotification(recipientId, dedupeKey) {
  return db.execute({
    sql: "SELECT 1 FROM v2_notifications WHERE recipient_id = ? AND dedupe_key = ? LIMIT 1",
    args: [recipientId, dedupeKey],
  });
}

/** One CRM notification row, localized at read time from its template key. */
export async function createCrmNotification({
  recipientId,
  title,
  message,
  type,
  link,
  dedupeKey,
  templateKey,
  params,
}) {
  await ensureCrmNotificationColumns();

  return db.execute({
    sql: `INSERT INTO v2_notifications
            (recipient_id, title, message, type, is_read, created_at,
             link, dedupe_key, template_key, params)
          VALUES (?, ?, ?, ?, 0, NOW(), ?, ?, ?, ?::jsonb)`,
    args: [
      recipientId,
      title,
      message,
      type,
      link ?? null,
      dedupeKey,
      templateKey,
      JSON.stringify(params ?? {}),
    ],
  });
}
