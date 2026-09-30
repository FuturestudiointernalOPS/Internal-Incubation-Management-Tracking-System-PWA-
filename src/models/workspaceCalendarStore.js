/**
 * Workspace — personal-calendar Venture sessions (REPOSITORY layer).
 *
 * The three statements behind a person's own Venture-session calendar: the
 * Venture scope (membership ∪ active staff assignment), the expansion of the
 * scope codes to the internal ids, and the session rows themselves.
 *
 * The decision (which scope applies, when the scope is empty and the sentinel is
 * needed) lives in `@/services/workspace/calendar`.
 *
 * SQL is byte-identical to what used to sit inline in `models/workspace.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** The person's Venture scope: membership ∪ active staff assignment. */
export function selectVentureScope(userId) {
  return db.execute({
    sql: `SELECT venture_id FROM venture_members
              WHERE (contact_id = ? OR user_cid = ?) AND removed_at IS NULL
            UNION
            SELECT venture_id FROM venture_staff_assignments
              WHERE staff_contact_id = ? AND status = 'active'`,
    args: [userId, userId, userId],
  });
}

/** Expand the scope codes to the internal ids too (rows may be keyed either way). */
export function selectInternalVentureIds(ventureCodes) {
  return db.execute({
    sql: `SELECT id::text AS id FROM ventures WHERE venture_id IN (${ventureCodes.map(() => "?").join(",")})`,
    args: ventureCodes,
  });
}

/** The person's sessions: own coach sessions ∪ venture-facing sessions of the scope. */
export function selectPersonalVentureSessions(userId, scopeList) {
  return db.execute({
    sql: `SELECT id, title, start_time, coach_name, status, venture_id,
                 milestone_ref, journey_stage_id, deliverable_id
          FROM venture_sessions
          WHERE start_time IS NOT NULL
            AND status NOT IN ('cancelled', 'no_show')
            AND (coach_contact_id = ?
                 OR (venture_facing = TRUE AND venture_id IN (${scopeList.map(() => "?").join(",")})))`,
    args: [userId, ...scopeList],
  });
}
