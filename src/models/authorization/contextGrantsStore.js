/**
 * Authorization — context grants store (REPOSITORY layer).
 *
 * Every statement the context-grant mechanism runs: the provenance schema, the
 * reads that decide what a grant should be, and the writes that apply or revoke
 * it. The plan and the decisions live in
 * `@/services/authorization/contextGrants`.
 *
 * Unlike the other `*Reads` modules, this one also writes — the mechanism owns
 * the rows it creates, and applying/revoking them is its data access.
 *
 * SQL is byte-identical to what used to sit inline in `contextGrants.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** Founder-shaped membership rows (both legacy and current shapes). */
const FOUNDER_MATCH_SQL =
  "(member_type = 'founder' OR role IN ('founder', 'co-founder'))";

let contextAppliedGrantsSchemaPromise = null;

/** Idempotent runtime self-healing for the provenance table (no migration). */
export function ensureContextAppliedGrantsSchema() {
  if (!contextAppliedGrantsSchemaPromise) {
    contextAppliedGrantsSchemaPromise = (async () => {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS context_applied_grants (
          id SERIAL PRIMARY KEY,
          user_cid TEXT NOT NULL,
          context TEXT NOT NULL,
          role_key TEXT NOT NULL,
          source_ref TEXT,
          module TEXT NOT NULL,
          capability TEXT NOT NULL,
          access_level INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_cid, context, role_key, module, capability)
        )`,
        args: [],
      });
      await db.execute({
        sql: `CREATE INDEX IF NOT EXISTS idx_context_applied_grants_user
         ON context_applied_grants(user_cid, context, role_key)`,
        args: [],
      });
      return true;
    })().catch((error) => {
      console.warn("[Authz] ensureContextAppliedGrantsSchema failed:", error.message);
      contextAppliedGrantsSchemaPromise = null;
      return false;
    });
  }
  return contextAppliedGrantsSchemaPromise;
}

/** Active founder relationships for one person (the justification for grants). */
export async function listActiveFounderVentures(cid) {
  if (!cid) return [];
  const result = await db.execute({
    sql: `SELECT DISTINCT CAST(venture_id AS TEXT) AS venture_id
          FROM venture_members
          WHERE removed_at IS NULL
            AND ${FOUNDER_MATCH_SQL}
            AND (contact_id = ? OR user_cid = ?)`,
    args: [String(cid), String(cid)],
  });
  return (result.rows || []).map((row) => String(row.venture_id)).filter(Boolean);
}

/** The capability rows one access profile carries (the registry-mapped grant). */
export async function getProfileCapabilityRows(profileId) {
  return db.execute({
    sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ?",
    args: [profileId],
  });
}

/** Everyone who currently holds a founder-shaped membership (any venture). */
export async function listFounderRelationshipCids() {
  return db.execute({
    sql: `SELECT DISTINCT COALESCE(NULLIF(contact_id, ''), user_cid) AS cid
              FROM venture_members
              WHERE removed_at IS NULL AND ${FOUNDER_MATCH_SQL}`,
  });
}

/** Everyone this mechanism has ever applied a grant to, for a context/role. */
export function listContextAppliedGrantCids(context, roleKey) {
  return db.execute({
    sql: "SELECT DISTINCT user_cid AS cid FROM context_applied_grants WHERE context = ? AND role_key = ?",
    args: [context, roleKey],
  });
}

/** A person's current capability rows (manual grants included). */
export function getUserCapabilityRows(cid) {
  return db.execute({
    sql: "SELECT module, capability, access_level, granted_by, expires_at FROM user_capabilities WHERE user_cid = ?",
    args: [String(cid)],
  });
}

/** What this mechanism previously applied for a person and a context/role. */
export function getContextAppliedGrantRows(cid, context, roleKey) {
  return db.execute({
    sql: "SELECT module, capability, access_level FROM context_applied_grants WHERE user_cid = ? AND context = ? AND role_key = ?",
    args: [String(cid), context, roleKey],
  });
}

/** Apply one capability grant (additive upsert). */
export function upsertUserCapability(cid, { module, capability, level, sentinel, expiresAt }) {
  return db.execute({
    sql: `INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by, expires_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (user_cid, module, capability) DO UPDATE SET
                access_level = EXCLUDED.access_level,
                granted_by = EXCLUDED.granted_by,
                expires_at = EXCLUDED.expires_at`,
    args: [String(cid), module, capability, level, sentinel, expiresAt],
  });
}

/** Record one applied grant in the provenance table. */
export function upsertContextAppliedGrant(cid, { context, roleKey, sourceRef, module, capability, level }) {
  return db.execute({
    sql: `INSERT INTO context_applied_grants (user_cid, context, role_key, source_ref, module, capability, access_level)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT (user_cid, context, role_key, module, capability) DO UPDATE SET
                access_level = EXCLUDED.access_level,
                source_ref = EXCLUDED.source_ref,
                updated_at = NOW()`,
    args: [String(cid), context, roleKey, sourceRef, module, capability, level],
  });
}

/** Revoke one capability grant — sentinel-guarded, so only our rows go. */
export function deleteUserCapability(cid, module, capability, sentinel) {
  return db.execute({
    sql: "DELETE FROM user_capabilities WHERE user_cid = ? AND module = ? AND capability = ? AND granted_by = ?",
    args: [String(cid), module, capability, sentinel],
  });
}

/** Drop one provenance row. */
export function deleteContextAppliedGrant(cid, context, roleKey, module, capability) {
  return db.execute({
    sql: "DELETE FROM context_applied_grants WHERE user_cid = ? AND context = ? AND role_key = ? AND module = ? AND capability = ?",
    args: [String(cid), context, roleKey, module, capability],
  });
}

/** Keep the justifying-relationship list fresh when nothing else changed. */
export function refreshContextAppliedGrantSource(cid, context, roleKey, sourceRef) {
  return db.execute({
    sql: "UPDATE context_applied_grants SET source_ref = ?, updated_at = NOW() WHERE user_cid = ? AND context = ? AND role_key = ?",
    args: [sourceRef, String(cid), context, roleKey],
  });
}

/** Re-date the grants when a program's end date moved. */
export function refreshUserCapabilityExpiry(cid, sentinel, expiresAt) {
  return db.execute({
    sql: `UPDATE user_capabilities SET expires_at = ?
                WHERE user_cid = ? AND granted_by = ? AND expires_at IS DISTINCT FROM ?`,
    args: [expiresAt, String(cid), sentinel, expiresAt],
  });
}

/**
 * The provenance pairs (module + capability) this mechanism applied — used by
 * the "withdraw everything for this context/role" path.
 */
export function getContextAppliedGrantPairs(cid, context, roleKey) {
  return db.execute({
    sql: "SELECT module, capability FROM context_applied_grants WHERE user_cid = ? AND context = ? AND role_key = ?",
    args: [String(cid), context, roleKey],
  });
}

/** Drop every provenance row for a person and a context/role. */
export function deleteAllContextAppliedGrants(cid, context, roleKey) {
  return db.execute({
    sql: "DELETE FROM context_applied_grants WHERE user_cid = ? AND context = ? AND role_key = ?",
    args: [String(cid), context, roleKey],
  });
}
