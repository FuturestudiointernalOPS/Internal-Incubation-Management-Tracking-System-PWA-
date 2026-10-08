import db from "@/lib/db";

/**
 * Feature-key alignment statements (repository layer).
 *
 * These seven statements are the teeth of the one-time "FEATURES = dashboard
 * sections" migration. WHICH key absorbs which, and WHICH responsibility row
 * survives a merge, is a product decision: it lives in
 * `@/services/authorization/featureKeyAlignment`. Nothing here decides.
 *
 * Statements are byte-identical to the ones they were lifted from
 * (`@/models/authorization/backfill.js`).
 */

/**
 * Move + merge every `feature_eligibility` row of an old key onto the new key.
 * A deny (eligible = 0) wins over an allow: `MIN` on the insert, `LEAST` on the
 * conflict — the same precedence `evaluateEligibility` applies.
 */
export async function mergeFeatureEligibilityKey(newKey, oldKey) {
  return db.execute({
    sql: `INSERT INTO feature_eligibility
            (feature_key, identity_type, identity_value, eligible)
          SELECT ?, identity_type, identity_value, MIN(eligible)
            FROM feature_eligibility
           WHERE feature_key = ?
           GROUP BY identity_type, identity_value
          ON CONFLICT (feature_key, identity_type, identity_value)
          DO UPDATE SET eligible = LEAST(feature_eligibility.eligible, EXCLUDED.eligible)`,
    args: [newKey, oldKey],
  });
}

/** Drop the merged-away key's leftover rows. */
export async function deleteFeatureEligibilityKey(oldKey) {
  return db.execute({
    sql: "DELETE FROM feature_eligibility WHERE feature_key = ?",
    args: [oldKey],
  });
}

/** The responsibility rows carrying the target key or any legacy key it absorbs. */
export async function selectResponsibilitiesByKeys(keys) {
  const placeholders = keys.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT id, key FROM responsibilities WHERE key IN (${placeholders})`,
    args: keys,
  });
}

export async function renameResponsibilityKey(newKey, id) {
  return db.execute({
    sql: "UPDATE responsibilities SET key = ? WHERE id = ?",
    args: [newKey, id],
  });
}

/** Re-point a duplicate's user assignments onto the surviving row (idempotent). */
export async function repointUserResponsibilities(survivorId, dupeId) {
  return db.execute({
    sql: `INSERT INTO user_responsibilities (user_cid, responsibility_id, assigned_by)
          SELECT user_cid, ?, assigned_by FROM user_responsibilities WHERE responsibility_id = ?
          ON CONFLICT (user_cid, responsibility_id) DO NOTHING`,
    args: [survivorId, dupeId],
  });
}

export async function deleteUserResponsibilitiesForResponsibility(dupeId) {
  return db.execute({
    sql: "DELETE FROM user_responsibilities WHERE responsibility_id = ?",
    args: [dupeId],
  });
}

export async function deleteResponsibilityById(dupeId) {
  return db.execute({
    sql: "DELETE FROM responsibilities WHERE id = ?",
    args: [dupeId],
  });
}
