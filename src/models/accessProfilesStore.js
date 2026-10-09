/**
 * Access profiles + responsibilities — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/authorization/accessProfiles`: the profile
 * resolution (now by profile KEY, via `contextReads`) and the responsibilities
 * catalogue / user assignments.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/auth.js`. These
 * functions were relocated — NOT merged with the parallel implementations in
 * `models/authorization.js` / `models/responsibilities.js` — so behaviour is
 * unchanged.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Responsibilities ─────────────────────────────────────────────────────────

/** A user's active responsibilities. */
export function selectResponsibilitiesForUser(userCid) {
  return db.execute({
    sql: `SELECT r.id, r.name, r.key, r.description, r.icon, r.allowed_roles
          FROM responsibilities r
          JOIN user_responsibilities ur ON ur.responsibility_id = r.id
          WHERE ur.user_cid = ? AND r.is_active = 1
          ORDER BY r.name`,
    args: [userCid],
  });
}

/** Assign a responsibility to a user (idempotent). */
export function insertUserResponsibility(userCid, responsibilityId, assignedBy) {
  return db.execute({
    sql: `INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
          VALUES (?, ?, ?)
          ON CONFLICT (user_cid, responsibility_id) DO NOTHING`,
    args: [userCid, responsibilityId, assignedBy],
  });
}

/** Remove a responsibility from a user. */
export function deleteUserResponsibility(userCid, responsibilityId) {
  return db.execute({
    sql: "DELETE FROM user_responsibilities WHERE user_cid = ? AND responsibility_id = ?",
    args: [userCid, responsibilityId],
  });
}

/** Every active responsibility, by name. */
export function selectActiveResponsibilities() {
  return db.execute({
    sql: "SELECT * FROM responsibilities WHERE is_active = 1 ORDER BY name",
  });
}
