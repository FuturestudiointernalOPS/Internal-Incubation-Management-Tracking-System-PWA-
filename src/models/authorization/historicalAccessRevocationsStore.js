/**
 * Authorization — historical access revocations (REPOSITORY layer).
 *
 * Phase 7, decision D3 (option c): the residual read an ex-manager keeps is
 * **revocable** by an administrator.
 *
 * WHY IT IS PERSISTED: the residual is RE-DERIVED from ended assignments on
 * every reconcile, so simply deleting the grant rows would let the next pass
 * re-apply them. The revocation is therefore stored here, and the history
 * reconcile consults it (`services/authorization/contextGrantHistory.js`).
 *
 * One row per (person, context): revoking ends the residual read for that
 * context type. The RELATIONSHIP HISTORY is never touched — only the derived
 * read-only consultation is affected (§13: no history is deleted).
 *
 * Layer (see docs/LAYER_SPLIT.md): repository — schema, reads and writes. The
 * decision (who may revoke, what is revocable) lives in the service.
 */

import db from "@/lib/db";

let schemaPromise = null;

/**
 * Idempotent runtime self-healing (same pattern as profile_assignments): no
 * migration required, fail-soft so the next call retries.
 */
export function ensureHistoricalRevocationsSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS historical_access_revocations (
        id SERIAL PRIMARY KEY,
        contact_cid TEXT NOT NULL,
        context TEXT NOT NULL,
        revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_by TEXT,
        reason TEXT DEFAULT '',
        UNIQUE (contact_cid, context)
      )`);
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_historical_revocations_cid
           ON historical_access_revocations(contact_cid)`,
      );
      return true;
    })().catch((error) => {
      console.warn("[Authz] ensureHistoricalRevocationsSchema failed:", error.message);
      schemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return schemaPromise;
}

/** The revocation row for one (person, context), or an empty set. */
export async function getHistoricalRevocation(cid, context) {
  await ensureHistoricalRevocationsSchema();
  try {
    return await db.execute({
      sql: `SELECT id, contact_cid, context, revoked_at, revoked_by, reason
            FROM historical_access_revocations
            WHERE contact_cid = ? AND context = ?`,
      args: [String(cid), String(context)],
    });
  } catch (error) {
    // Fail-soft: missing table mid-heal must not break permissions reconcile.
    console.warn("[Authz] getHistoricalRevocation failed:", error.message);
    return { rows: [] };
  }
}

/** Every revocation of one person, most recent first. */
export async function listHistoricalRevocations(cid) {
  await ensureHistoricalRevocationsSchema();
  try {
    return await db.execute({
      sql: `SELECT id, context, revoked_at, revoked_by, reason
            FROM historical_access_revocations
            WHERE contact_cid = ?
            ORDER BY revoked_at DESC, id DESC`,
      args: [String(cid)],
    });
  } catch (error) {
    console.warn("[Authz] listHistoricalRevocations failed:", error.message);
    return { rows: [] };
  }
}

/**
 * Record (or refresh) the revocation — idempotent. A second revoke updates the
 * stamp/actor/reason instead of inserting a duplicate.
 */
export async function upsertHistoricalRevocation({ cid, context, revokedBy = null, reason = "" }) {
  await ensureHistoricalRevocationsSchema();
  return db.execute({
    sql: `INSERT INTO historical_access_revocations (contact_cid, context, revoked_by, reason)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (contact_cid, context) DO UPDATE SET
            revoked_at = NOW(),
            revoked_by = EXCLUDED.revoked_by,
            reason = EXCLUDED.reason`,
    args: [String(cid), String(context), revokedBy, reason || ""],
  });
}

/** Remove a revocation (the "restore" path) — idempotent. */
export async function deleteHistoricalRevocation(cid, context) {
  await ensureHistoricalRevocationsSchema();
  return db.execute({
    sql: "DELETE FROM historical_access_revocations WHERE contact_cid = ? AND context = ?",
    args: [String(cid), String(context)],
  });
}
