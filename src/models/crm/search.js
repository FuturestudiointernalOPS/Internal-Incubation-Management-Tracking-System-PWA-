import db from "@/lib/db";

/**
 * CRM global search reads (REPOSITORY layer).
 *
 * One query per object so each keeps its own shape and joins. The per-domain
 * visibility decision (people need `contacts.view`) lives in the service, not
 * here; organizations reuse `searchCrmOrganizations` from their own model.
 */

const pattern = (query) => `%${query}%`;
const clamp = (limit) => Math.max(1, Math.min(20, Number(limit) || 5));

/** People by name, email or phone. Soft-deleted records never appear. */
export async function searchCrmPeople(query, limit = 5) {
  const like = pattern(query);
  return db.execute({
    sql: `SELECT cid, name, email, phone, role
          FROM contacts
          WHERE deleted_at IS NULL
            AND (name ILIKE ? OR email ILIKE ? OR COALESCE(phone, '') ILIKE ?)
          ORDER BY name ASC
          LIMIT ?`,
    args: [like, like, like, clamp(limit)],
  });
}

/** Leads by title, description, or the person/organization they are attached to. */
export async function searchCrmLeads(query, limit = 5) {
  const like = pattern(query);
  return db.execute({
    sql: `SELECT
            l.id::text AS id,
            l.title,
            l.status,
            l.qualification_state,
            c.name   AS contact_name,
            org.name AS organization_name
          FROM crm_leads l
          LEFT JOIN contacts c ON c.cid = l.contact_cid
          LEFT JOIN crm_organizations org ON org.id = l.organization_id AND org.deleted_at IS NULL
          WHERE l.deleted_at IS NULL
            AND (
              l.title ILIKE ?
              OR COALESCE(l.description, '') ILIKE ?
              OR COALESCE(c.name, '') ILIKE ?
              OR COALESCE(org.name, '') ILIKE ?
            )
          ORDER BY l.updated_at DESC
          LIMIT ?`,
    args: [like, like, like, like, clamp(limit)],
  });
}

/** Opportunities by name, description, or the person/organization they concern. */
export async function searchCrmOpportunities(query, limit = 5) {
  const like = pattern(query);
  return db.execute({
    sql: `SELECT
            o.id::text AS id,
            o.name,
            o.status,
            p.name AS pipeline_name,
            s.name AS stage_name,
            c.name   AS contact_name,
            org.name AS organization_name
          FROM crm_opportunities o
          JOIN crm_pipelines p ON p.id = o.pipeline_id
          JOIN crm_pipeline_stages s ON s.id = o.stage_id
          LEFT JOIN contacts c ON c.cid = o.contact_cid
          LEFT JOIN crm_organizations org ON org.id = o.organization_id AND org.deleted_at IS NULL
          WHERE o.deleted_at IS NULL
            AND (
              o.name ILIKE ?
              OR COALESCE(o.description, '') ILIKE ?
              OR COALESCE(c.name, '') ILIKE ?
              OR COALESCE(org.name, '') ILIKE ?
            )
          ORDER BY o.updated_at DESC
          LIMIT ?`,
    args: [like, like, like, like, clamp(limit)],
  });
}
