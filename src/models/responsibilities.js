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
 * Modules a responsibility owns that carry a base `view` capability.
 *
 * Modules come from the reverse of MODULE_TO_FEATURE (single source: a module
 * whose feature equals the responsibility key). `locked` modules (duplicates)
 * and modules with no `view` capability (facilitator) are excluded — they have
 * no base to grant.
 */
function responsibilityViewModules(responsibilityKey) {
  return Object.entries(MODULE_TO_FEATURE)
    .filter(([, feature]) => feature === responsibilityKey)
    .map(([module]) => module)
    .filter(
      (mod) =>
        !CAPABILITY_CATALOG[mod]?.locked &&
        Boolean(CAPABILITY_CATALOG[mod]?.capabilities?.view),
    );
}

/**
 * Grant the base `view` capability of every module owned by the
 * responsibility's feature, so a responsibility is never a dead-end (sidebar
 * shows the area AND its pages can actually load).
 *
 * Grants are additive and idempotent (INSERT … ON CONFLICT DO NOTHING): an
 * existing manual grant, restriction or higher level is never overwritten.
 * Every grant THIS call creates is also recorded in
 * `responsibility_capability_grants`, so unassigning the responsibility can
 * revoke exactly what it created (a pre-existing manual grant is left
 * untracked and therefore never revoked).
 *
 * Responsibilities whose feature owns no module (e.g. org_membership) grant
 * nothing here — their pages rely on manual grants/profiles.
 *
 * @returns {Promise<string[]>} granted `<module>.view` entries (informational).
 */
export async function grantResponsibilityBaseAccess({ userCid, responsibilityKey, grantedBy = null }) {
  const granted = [];
  if (!userCid || !responsibilityKey) return granted;

  for (const mod of responsibilityViewModules(responsibilityKey)) {
    // RETURNING tells us whether THIS call created the grant. A capability the
    // user already held (manual grant, another responsibility) returns no row,
    // so it is neither reported nor tracked — and never revoked later.
    const res = await db.execute({
      sql: `INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by)
            VALUES (?, ?, 'view', 1, ?)
            ON CONFLICT (user_cid, module, capability) DO NOTHING
            RETURNING module`,
      args: [userCid, mod, grantedBy],
    });
    if (!(res.rows || []).length) continue;
    await trackResponsibilityGrant({
      userCid,
      responsibilityKey,
      module: mod,
      capability: "view",
    });
    granted.push(`${mod}.view`);
  }
  return granted;
}

/** Record a capability a responsibility CREATE, so removal can revoke it. */
export async function trackResponsibilityGrant({ userCid, responsibilityKey, module, capability }) {
  return db.execute({
    sql: `INSERT INTO responsibility_capability_grants (user_cid, responsibility_key, module, capability)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (user_cid, responsibility_key, module, capability) DO NOTHING`,
    args: [userCid, responsibilityKey, module, capability],
  });
}

/** The capability grants a responsibility created for one user. */
export async function listResponsibilityGrants(userCid, responsibilityKey) {
  return db.execute({
    sql: `SELECT module, capability FROM responsibility_capability_grants
          WHERE user_cid = ? AND responsibility_key = ?`,
    args: [userCid, responsibilityKey],
  });
}

/**
 * Revoke the base grants a responsibility CREATED for a user (its
 * `responsibility_capability_grants` ledger).
 *
 * Only tracked grants are touched, and only at the base level (1) this
 * responsibility set — a deliberately raised level is left alone. A capability
 * another responsibility still tracks is kept. Rights coming from a profile or
 * a group live in other tables and are unaffected.
 *
 * @returns {Promise<string[]>} revoked `<module>.<capability>` entries.
 */
export async function revokeResponsibilityBaseAccess({ userCid, responsibilityKey }) {
  const revoked = [];
  if (!userCid || !responsibilityKey) return revoked;

  const tracked = await listResponsibilityGrants(userCid, responsibilityKey);
  const mine = tracked.rows || [];

  // Drop this responsibility's ledger FIRST, so the guard below only sees OTHER
  // responsibilities that still hold the same capability.
  await db.execute({
    sql: `DELETE FROM responsibility_capability_grants
          WHERE user_cid = ? AND responsibility_key = ?`,
    args: [userCid, responsibilityKey],
  });

  for (const row of mine) {
    const res = await db.execute({
      sql: `DELETE FROM user_capabilities
            WHERE user_cid = ? AND module = ? AND capability = ? AND access_level = 1
              AND NOT EXISTS (
                SELECT 1 FROM responsibility_capability_grants g
                WHERE g.user_cid = ? AND g.module = ? AND g.capability = ?
              )`,
      args: [
        userCid,
        row.module,
        row.capability,
        userCid,
        row.module,
        row.capability,
      ],
    });
    if (Number(res.rowsAffected ?? 0) > 0) {
      revoked.push(`${row.module}.${row.capability}`);
    }
  }
  return revoked;
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
