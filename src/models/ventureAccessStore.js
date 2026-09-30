/**
 * Venture access facts — statements (REPOSITORY layer).
 *
 * The two questions every Venture screen asks: the Venture's own row (its code
 * and lifecycle state) and the viewer's relationship to it (member? delegated
 * staff?). The caching and the "which column" decision live in
 * `@/services/ventures/accessFacts`.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventureAccessFacts.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** The Venture's own row (code + lifecycle), keyed by the caller's column choice. */
export function selectVentureFacts(key, column) {
  return db.execute({
    sql: `SELECT venture_id AS code, status, is_archived FROM ventures WHERE ${column} = ? LIMIT 1`,
    args: [key],
  });
}

/** The viewer's relationship to one Venture, both facts in one statement. */
export function selectViewerRelationship(ventureCode, cid) {
  return db.execute({
    sql: `SELECT
              EXISTS (SELECT 1 FROM venture_members m
                      WHERE m.venture_id = ? AND m.contact_id = ? AND m.removed_at IS NULL) AS is_member,
              EXISTS (SELECT 1 FROM venture_staff_assignments a
                      WHERE a.venture_id = ? AND a.staff_contact_id = ? AND a.status = 'active') AS is_assigned`,
    args: [ventureCode, cid, ventureCode, cid],
  });
}
