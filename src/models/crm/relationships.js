import db from "@/lib/db";

/**
 * CRM Contact-Organization Relationships model.
 *
 * Manages the person ↔ organization link table (crm_contact_organizations).
 * This is distinct from contact_roles (which expresses platform roles like
 * participant / investor / staff) — this table expresses real-world
 * relationships like "works_for", "founded", "advises", "represents".
 *
 * Part of the CRM Phase 1 foundation (see migrations/phase2_crm_organization_foundation.sql).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports — only the db engine.
 *  - One function per query.
 */

// ─── READ ────────────────────────────────────────────────────────────────────

/**
 * All relationships for a given contact, joined with the org name.
 * Ordered: primary first, then current, then by created_at DESC.
 */
export async function getCrmContactOrganizations(contactCid) {
  return db.execute({
    sql: `SELECT
            co.id,
            co.contact_cid,
            co.organization_id,
            co.relationship_type,
            co.title,
            co.is_primary,
            co.is_current,
            co.started_at,
            co.ended_at,
            co.notes,
            co.created_at,
            co.updated_at,
            o.name        AS org_name,
            o.type        AS org_type,
            o.website     AS org_website,
            o.industry    AS org_industry
          FROM crm_contact_organizations co
          JOIN crm_organizations o ON o.id = co.organization_id
          WHERE co.contact_cid = ?
            AND o.deleted_at IS NULL
          ORDER BY co.is_primary DESC, co.is_current DESC, co.created_at DESC`,
    args: [contactCid],
  });
}

/**
 * All contacts for a given organization (the "people at this org" view).
 * Joined with the contact name and email for display.
 */
export async function getCrmOrganizationContacts(organizationId) {
  return db.execute({
    sql: `SELECT
            co.id,
            co.contact_cid,
            co.organization_id,
            co.relationship_type,
            co.title,
            co.is_primary,
            co.is_current,
            co.started_at,
            co.ended_at,
            co.notes,
            co.created_at,
            c.name  AS contact_name,
            c.email AS contact_email,
            c.role  AS contact_role
          FROM crm_contact_organizations co
          JOIN contacts c ON c.cid = co.contact_cid
          WHERE co.organization_id = ?
          ORDER BY co.is_primary DESC, co.is_current DESC, c.name ASC`,
    args: [organizationId],
  });
}

/** Single relationship row by id. */
export async function getCrmContactOrganizationById(id) {
  return db.execute({
    sql: "SELECT * FROM crm_contact_organizations WHERE id = ?",
    args: [id],
  });
}

// ─── WRITE ───────────────────────────────────────────────────────────────────

/**
 * Create a person ↔ org relationship.
 * The UNIQUE constraint on (contact_cid, organization_id, relationship_type)
 * means this silently no-ops when the exact triple already exists.
 * Returns the new row, or null columns when the triple was already present.
 */
export async function createCrmContactOrganization({
  contact_cid,
  organization_id,
  relationship_type,
  title,
  is_primary,
  started_at,
  notes,
  created_by,
}) {
  return db.execute({
    sql: `INSERT INTO crm_contact_organizations
            (contact_cid, organization_id, relationship_type, title,
             is_primary, started_at, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (contact_cid, organization_id, relationship_type) DO NOTHING
          RETURNING *`,
    args: [
      contact_cid,
      organization_id,
      relationship_type ?? "works_for",
      title ?? null,
      is_primary ?? false,
      started_at ?? null,
      notes ?? null,
      created_by ?? null,
    ],
  });
}

/**
 * Update mutable fields on a relationship row.
 * updated_at is always stamped. Returns the updated row.
 */
export async function updateCrmContactOrganization(
  id,
  { relationship_type, title, is_primary, is_current, started_at, ended_at, notes },
) {
  return db.execute({
    sql: `UPDATE crm_contact_organizations
          SET relationship_type = COALESCE(?, relationship_type),
              title             = COALESCE(?, title),
              is_primary        = COALESCE(?, is_primary),
              is_current        = COALESCE(?, is_current),
              started_at        = COALESCE(?, started_at),
              ended_at          = COALESCE(?, ended_at),
              notes             = COALESCE(?, notes),
              updated_at        = NOW()
          WHERE id = ?
          RETURNING *`,
    args: [
      relationship_type ?? null,
      title ?? null,
      is_primary ?? null,
      is_current ?? null,
      started_at ?? null,
      ended_at ?? null,
      notes ?? null,
      id,
    ],
  });
}

/** Hard-delete a relationship row (no business data here, just a link). */
export async function deleteCrmContactOrganization(id) {
  return db.execute({
    sql: "DELETE FROM crm_contact_organizations WHERE id = ? RETURNING id",
    args: [id],
  });
}
