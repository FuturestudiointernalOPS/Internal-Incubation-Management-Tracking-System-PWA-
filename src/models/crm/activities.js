import db from "@/lib/db";

/**
 * CRM Activities model.
 *
 * Part of CRM Phase 4 (Execution & Communication).
 * Unifies crm_activities (meetings, calls, notes, emails) and
 * the native ImpactOS tasks table into a single execution stream.
 */

/** 
 * Get all activities for a CRM record, uniting manual activities
 * and native ImpactOS tasks. With no context pair given it becomes the
 * global feed: every stored activity plus the tasks that carry a CRM context.
 */
export async function getCrmActivities({
  leadId,
  opportunityId,
  contactCid,
  organizationId,
}) {
  const crmArgs = [
    leadId || null,
    opportunityId || null,
    contactCid || null,
    organizationId || null,
  ];

  // We query tasks using context_type and context_id.
  const taskArgs = [
    leadId || null,
    opportunityId || null,
    contactCid || null,
    organizationId || null,
  ];

  // No context pair ⇒ global feed. The boolean parameter switches each UNION
  // half between "everything" (crm_activities) / "every CRM-context task"
  // (tasks) and the per-context filters below.
  const noFilter = crmArgs.every((value) => value === null);

  const sql = `
    SELECT
      a.id::text,
      a.type AS activity_type,
      a.title,
      a.description,
      a.outcome,
      a.activity_date,
      a.lead_id,
      a.opportunity_id,
      a.contact_cid,
      a.organization_id,
      a.owner_cid,
      a.reference_id,
      a.created_at,
      a.created_by,
      o.name AS owner_name
    FROM crm_activities a
    LEFT JOIN contacts o ON o.cid = a.owner_cid
    WHERE ?::boolean
       OR (?::uuid IS NOT NULL AND a.lead_id = ?)
       OR (?::uuid IS NOT NULL AND a.opportunity_id = ?)
       OR (?::text IS NOT NULL AND a.contact_cid = ?)
       OR (?::uuid IS NOT NULL AND a.organization_id = ?)

    UNION ALL

    SELECT
      t.id::text,
      'task' AS activity_type,
      t.title,
      t.description,
      t.status AS outcome,
      COALESCE(t.end_date::timestamptz, t.created_at) AS activity_date,
      CASE WHEN t.context_type = 'crm_lead' THEN t.context_id::uuid ELSE NULL END AS lead_id,
      CASE WHEN t.context_type = 'crm_opportunity' THEN t.context_id::uuid ELSE NULL END AS opportunity_id,
      CASE WHEN t.context_type = 'crm_contact' THEN t.context_id ELSE NULL END AS contact_cid,
      CASE WHEN t.context_type = 'crm_organization' THEN t.context_id::uuid ELSE NULL END AS organization_id,
      COALESCE(t.assigned_to, t.user_id) AS owner_cid,
      t.id::text AS reference_id,
      t.created_at,
      t.user_id AS created_by,
      o.name AS owner_name
    FROM tasks t
    LEFT JOIN contacts o ON o.cid = COALESCE(t.assigned_to, t.user_id)
    WHERE (?::boolean AND t.context_type IN ('crm_lead', 'crm_opportunity', 'crm_contact', 'crm_organization'))
       OR (?::text IS NOT NULL AND t.context_type = 'crm_lead' AND t.context_id = ?)
       OR (?::text IS NOT NULL AND t.context_type = 'crm_opportunity' AND t.context_id = ?)
       OR (?::text IS NOT NULL AND t.context_type = 'crm_contact' AND t.context_id = ?)
       OR (?::text IS NOT NULL AND t.context_type = 'crm_organization' AND t.context_id = ?)

    ORDER BY activity_date DESC NULLS LAST, created_at DESC
  `;

  return db.execute({
    sql,
    args: [
      noFilter,
      ...crmArgs.flatMap((v) => [v, v]), // 8 args for crm_activities
      noFilter,
      ...taskArgs.flatMap((v) => [v, v]), // 8 args for tasks
    ],
  });
}

/** Create a non-task activity (meeting, note, call, email pointer) */
export async function createCrmActivity({
  type, title, description, outcome, activity_date,
  lead_id, opportunity_id, contact_cid, organization_id,
  owner_cid, reference_id, created_by,
}) {
  return db.execute({
    sql: `INSERT INTO crm_activities
            (type, title, description, outcome, activity_date,
             lead_id, opportunity_id, contact_cid, organization_id,
             owner_cid, reference_id, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      type, title, description ?? null, outcome ?? null, activity_date ?? null,
      lead_id ?? null, opportunity_id ?? null, contact_cid ?? null, organization_id ?? null,
      owner_cid ?? null, reference_id ?? null, created_by ?? null,
    ],
  });
}

/** Update an existing CRM activity */
export async function updateCrmActivity(id, updates) {
  const allowed = ['title', 'description', 'outcome', 'activity_date', 'owner_cid'];
  const sets = [];
  const args = [];
  for (const f of allowed) {
    if (updates[f] !== undefined) {
      sets.push(`${f} = ?`);
      args.push(updates[f]);
    }
  }
  if (!sets.length) return { rows: [] };
  
  sets.push("updated_at = NOW()");
  args.push(id);

  return db.execute({
    sql: `UPDATE crm_activities SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Single activity by id (existence check the PATCH/DELETE routes share). */
export async function getCrmActivityById(id) {
  return db.execute({
    sql: "SELECT id, type FROM crm_activities WHERE id = ?",
    args: [id],
  });
}

/** Hard delete a manual activity (the table has no soft-delete column). */
export async function deleteCrmActivity(id) {
  return db.execute({
    sql: "DELETE FROM crm_activities WHERE id = ?",
    args: [id],
  });
}

/** Find the Next Action (closest upcoming task or meeting) */
export async function getCrmNextAction({ leadId, opportunityId }) {
  const result = await getCrmActivities({ leadId, opportunityId });
  const activities = result.rows || [];
  
  const now = new Date();
  
  // Find the earliest activity/task that is in the future AND not completed
  const upcoming = activities.filter(a => {
    if (a.activity_type === 'task' && a.outcome === 'completed') return false;
    if (a.activity_type === 'task' && a.outcome === 'cancelled') return false;
    if (a.activity_type === 'meeting' && a.outcome === 'completed') return false;
    if (a.activity_type === 'meeting' && a.outcome === 'cancelled') return false;
    
    if (!a.activity_date) return false;
    return new Date(a.activity_date) >= now;
  });

  upcoming.sort((a, b) => new Date(a.activity_date) - new Date(b.activity_date));
  
  return upcoming[0] || null;
}
