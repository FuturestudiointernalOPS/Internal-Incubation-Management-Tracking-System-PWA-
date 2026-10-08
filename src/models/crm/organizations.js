import db from "@/lib/db";

/**
 * CRM Organizations model — data access for CRM organization records.
 *
 * Part of the CRM Phase 1 foundation (see migrations/phase2_crm_organization_foundation.sql).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports — only the db engine.
 *  - One function per query, named after the data it returns or the action it performs.
 *  - SQL lives here; decisions (authorization, validation) live in services or controllers.
 */

// ─── READ ────────────────────────────────────────────────────────────────────

/**
 * All non-deleted CRM organizations, ordered by name.
 * Optional owner_cid filter for "my organizations" views.
 */
export async function getCrmOrganizations({ ownerCid } = {}) {
  if (ownerCid) {
    return db.execute({
      sql: `SELECT * FROM crm_organizations
            WHERE deleted_at IS NULL AND owner_cid = ?
            ORDER BY name ASC`,
      args: [ownerCid],
    });
  }
  return db.execute(
    "SELECT * FROM crm_organizations WHERE deleted_at IS NULL ORDER BY name ASC",
  );
}

/** Single CRM organization by id. Returns null row when not found. */
export async function getCrmOrganizationById(id) {
  return db.execute({
    sql: "SELECT * FROM crm_organizations WHERE id = ? AND deleted_at IS NULL",
    args: [id],
  });
}

/**
 * Search CRM organizations by name fragment (case-insensitive).
 * Used by typeahead pickers in Phase 2+.
 */
export async function searchCrmOrganizations(query, limit = 20) {
  return db.execute({
    sql: `SELECT id, name, type, website, industry
          FROM crm_organizations
          WHERE deleted_at IS NULL AND LOWER(name) LIKE LOWER(?)
          ORDER BY name ASC
          LIMIT ?`,
    args: [`%${query}%`, Math.max(1, Math.min(100, parseInt(limit) || 20))],
  });
}

// ─── WRITE ───────────────────────────────────────────────────────────────────

/**
 * Insert a new CRM organization. Returns the created row.
 * Caller is responsible for authorization and field validation.
 */
export async function createCrmOrganization({
  name,
  type,
  website,
  industry,
  description,
  owner_cid,
  created_by,
}) {
  return db.execute({
    sql: `INSERT INTO crm_organizations
            (name, type, website, industry, description, owner_cid, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      name,
      type ?? null,
      website ?? null,
      industry ?? null,
      description ?? null,
      owner_cid ?? null,
      created_by ?? null,
    ],
  });
}

/**
 * Update mutable fields on an existing CRM organization.
 * updated_at is always stamped. Returns the updated row.
 */
export async function updateCrmOrganization(id, { name, type, website, industry, description, owner_cid }) {
  return db.execute({
    sql: `UPDATE crm_organizations
          SET name        = COALESCE(?, name),
              type        = COALESCE(?, type),
              website     = COALESCE(?, website),
              industry    = COALESCE(?, industry),
              description = COALESCE(?, description),
              owner_cid   = COALESCE(?, owner_cid),
              updated_at  = NOW()
          WHERE id = ? AND deleted_at IS NULL
          RETURNING *`,
    args: [
      name ?? null,
      type ?? null,
      website ?? null,
      industry ?? null,
      description ?? null,
      owner_cid ?? null,
      id,
    ],
  });
}

/**
 * Soft-delete a CRM organization.
 * Existing crm_contact_organizations rows remain (historical record).
 */
export async function softDeleteCrmOrganization(id, deletedByCid) {
  return db.execute({
    sql: `UPDATE crm_organizations
          SET deleted_at = NOW(), deleted_by = ?, updated_at = NOW()
          WHERE id = ? AND deleted_at IS NULL
          RETURNING id`,
    args: [deletedByCid ?? null, id],
  });
}
