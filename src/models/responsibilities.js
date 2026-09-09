import db from "@/lib/db";
import { MODULE_TO_FEATURE } from "@/models/authorization/eligibility";
import { CAPABILITY_CATALOG } from "@/models/authorization/capability-catalog";

/**
 * Responsibilities model — data access for the responsibilities controllers
 * (`src/app/api/responsibilities/route.js`, `src/app/api/responsibilities/assign/route.js`,
 * `src/app/api/responsibilities/access/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── POST / PUT / DELETE /api/responsibilities ────────────────────────────────

/** Insert a new responsibility definition (always active on creation). */
export async function createResponsibility(name, key, description, icon) {
  return db.execute({
    sql: `INSERT INTO responsibilities (name, key, description, icon, is_active)
            VALUES (?, ?, ?, ?, 1)`,
    args: [name.trim(), key.trim().toLowerCase(), description || "", icon || ""],
  });
}

/** Update a responsibility's display name. */
export async function updateResponsibilityName(id, name) {
  return db.execute({
    sql: "UPDATE responsibilities SET name = ?, updated_at = NOW() WHERE id = ?",
    args: [name.trim(), id],
  });
}

/** Update a responsibility's unique key. */
export async function updateResponsibilityKey(id, key) {
  return db.execute({
    sql: "UPDATE responsibilities SET key = ?, updated_at = NOW() WHERE id = ?",
    args: [key.trim().toLowerCase(), id],
  });
}

/** Update a responsibility's description. */
export async function updateResponsibilityDescription(id, description) {
  return db.execute({
    sql: "UPDATE responsibilities SET description = ?, updated_at = NOW() WHERE id = ?",
    args: [description, id],
  });
}

/** Update a responsibility's icon. */
export async function updateResponsibilityIcon(id, icon) {
  return db.execute({
    sql: "UPDATE responsibilities SET icon = ?, updated_at = NOW() WHERE id = ?",
    args: [icon, id],
  });
}

/** Update whether a responsibility is active (stored as 1/0). */
export async function updateResponsibilityActive(id, is_active) {
  return db.execute({
    sql: "UPDATE responsibilities SET is_active = ?, updated_at = NOW() WHERE id = ?",
    args: [is_active ? 1 : 0, id],
  });
}

/** How many users currently have a responsibility assigned (delete guard). */
export async function countResponsibilityAssignments(id) {
  return db.execute({
    sql: "SELECT COUNT(*) as cnt FROM user_responsibilities WHERE responsibility_id = ?",
    args: [id],
  });
}

/** Delete a responsibility definition by id. */
export async function deleteResponsibility(id) {
  return db.execute({
    sql: "DELETE FROM responsibilities WHERE id = ?",
    args: [id],
  });
}

// ── PUT /api/responsibilities/assign (audit lookups) ─────────────────────────

/** A responsibility's name + key by id, for assign/remove audit + grants. */
export async function getResponsibilityName(id) {
  return db.execute({
    sql: "SELECT name, key FROM responsibilities WHERE id = ?",
    args: [id],
  });
}

/** A contact's name by cid, for assign/remove audit messages. */
export async function getContactName(cid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

// ── GET /api/responsibilities/assign ─────────────────────────────────────────

/** A user's assigned responsibilities (id/name/key, active only, by name). */
export async function getAssignedResponsibilitiesForUser(userCid) {
  return db.execute({
    sql: `SELECT r.id, r.name, r.key
            FROM responsibilities r
            JOIN user_responsibilities ur ON ur.responsibility_id = r.id
            WHERE ur.user_cid = ? AND r.is_active = 1
            ORDER BY r.name`,
    args: [userCid],
  });
}

/** A contact's identity row (cid/name/role) by cid. */
export async function getContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid, name, role, group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

// ── Responsibility ↔ capability alignment (Option 1) ─────────────────────────

/**
 * Grant the base `view` capability of every module owned by the
 * responsibility's feature, so a responsibility is never a dead-end (sidebar
 * shows the area AND its pages can actually load).
 *
 * Modules come from the reverse of MODULE_TO_FEATURE (single source: a module
 * whose feature equals the responsibility key). Only modules exposing a
 * `view` capability are touched. Grants are additive and idempotent
 * (INSERT … ON CONFLICT DO NOTHING): an existing manual grant, restriction or
 * higher level is never overwritten, and removing the responsibility never
 * revokes them (they may be shared with an access profile).
 *
 * Responsibilities without a module mapping (operations, intelligence, …)
 * grant nothing here — their pages rely on manual grants/profiles.
 *
 * @returns {Promise<string[]>} granted `<module>.view` entries (informational).
 */
export async function grantResponsibilityBaseAccess({ userCid, responsibilityKey, grantedBy = null }) {
  const granted = [];
  if (!userCid || !responsibilityKey) return granted;

  const modules = Object.entries(MODULE_TO_FEATURE)
    .filter(([, feature]) => feature === responsibilityKey)
    .map(([module]) => module);

  for (const mod of modules) {
    // P1 catalog truth: modules marked `locked` (e.g. duplicates — super-admin
    // role-locked until a later phase opens them) never enter responsibility
    // base grants. The catalog is the single source for this decision.
    if (CAPABILITY_CATALOG[mod]?.locked) continue;
    if (!CAPABILITY_CATALOG[mod]?.capabilities?.view) continue;
    await db.execute({
      sql: `INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by)
            VALUES (?, ?, 'view', 1, ?)
            ON CONFLICT (user_cid, module, capability) DO NOTHING`,
      args: [userCid, mod, grantedBy],
    });
    granted.push(`${mod}.view`);
  }
  return granted;
}

// ── PUT /api/responsibilities/access ─────────────────────────────────────────

/** A responsibility's current access row (id/name/key/allowed_roles). */
export async function getResponsibilityAccess(id) {
  return db.execute({
    sql: "SELECT id, name, key, allowed_roles FROM responsibilities WHERE id = ?",
    args: [id],
  });
}

/** Persist a responsibility's allowed_roles (JSON array string, or null to reset). */
export async function setResponsibilityAllowedRoles(id, allowedRoles) {
  return db.execute({
    sql: "UPDATE responsibilities SET allowed_roles = ?, updated_at = NOW() WHERE id = ?",
    args: [allowedRoles, id],
  });
}
