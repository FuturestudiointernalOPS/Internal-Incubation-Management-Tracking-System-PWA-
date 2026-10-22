/**
 * PROFILE / CAPABILITY COHERENCE (MODEL layer).
 *
 * ONE read, the direction the existing assignment check does not cover: a
 * capability row whose profile does not exist. The other direction (an active
 * card whose profile carries no capability) already lives in
 * `listProfileAssignmentConsistency` — the check reads that instead of
 * duplicating it.
 *
 * It NEVER corrects anything: a check that silently repairs hides the bug that
 * created the drift.
 */

import db from "@/lib/db";

/** Capability rows whose profile does not exist. */
export function listCapabilitiesWithoutProfile() {
  return db.execute(`
    SELECT pc.profile_key AS profile_key, COUNT(*)::int AS capabilities
    FROM profile_capabilities pc
    WHERE NOT EXISTS (
      SELECT 1 FROM profiles p WHERE p.key = pc.profile_key
    )
    GROUP BY pc.profile_key
    ORDER BY pc.profile_key
  `);
}
