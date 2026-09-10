/**
 * ImpactOS — CONTEXT → PROFILE APPLICATION (Phase 6)
 *
 * The Context Roles registry (`context_role_profiles`, Phase 4) answers
 * "when someone holds role X inside context Y, which access profile should
 * seed their capabilities?". This module APPLIES that mapping at the
 * membership boundary:
 *
 *   venture_members (active, founder)  →  Founder profile capabilities
 *                                      →  additive individual grants
 *                                      →  user_capabilities (granted_by sentinel)
 *
 * Approved design rules:
 *   - ADDITIVE ONLY. Grants merge with profile/group capabilities by MAX() in
 *     the resolver. Nothing is ever downgraded, no identity is mutated, and
 *     `contacts.role` is never touched.
 *   - ATTRIBUTABLE. Every row this module creates is stamped
 *     `granted_by = "ctx:<context>:<role>"` and mirrored in
 *     `context_applied_grants`, so removal only ever deletes what this
 *     mechanism created. A manual grant (different granted_by) is NEVER
 *     overwritten and NEVER removed.
 *   - REVERSIBLE. When the last relationship that justified the grant ends
 *     (all ventures removed) or the registry mapping is cleared/disabled, the
 *     applied rows are removed and the user's cached authorization context is
 *     dropped.
 *   - NO RESOLVER CHANGE. Scope stays the authority on *where* (venture_own
 *     reads venture_members live); these grants only answer *whether* the
 *     capability exists.
 *
 * Callers: venture creation (pipeline), member add/remove/update routes,
 * lead change, contact merge — plus the idempotent reconcile endpoint
 * `GET /api/engineering/permissions/sync-context-grants`.
 */

import db, { initDb } from "@/lib/db";
import { getContextRoleProfile } from "./contextRoleProfiles";

let contextAppliedGrantsSchemaPromise = null;

/** granted_by stamp for grants this module owns — the only rows it may remove. */
export function contextGrantSentinel(context, roleKey) {
  return `ctx:${context}:${roleKey}`;
}

/** Founder-shaped membership rows (both legacy and current shapes). */
const FOUNDER_MATCH_SQL =
  "(member_type = 'founder' OR role IN ('founder', 'co-founder'))";

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
    })().catch((e) => {
      console.warn("[Authz] ensureContextAppliedGrantsSchema failed:", e.message);
      contextAppliedGrantsSchemaPromise = null;
      return false;
    });
  }
  return contextAppliedGrantsSchemaPromise;
}

/**
 * Pure change plan (unit-tested).
 *
 * @param {Object} args
 * @param {Object} args.desired    { "module.capability": { module, capability, level } }
 * @param {Array}  args.existing   current user_capabilities rows [{module, capability, granted_by}]
 * @param {Array}  args.provenance rows this module applied before [{module, capability}]
 * @param {string} args.sentinel   granted_by stamp owned by this mechanism
 * @returns {{ toApply: Array, toRevoke: Array }}
 */
export function planContextGrantChanges({
  desired = {},
  existing = [],
  provenance = [],
  sentinel,
}) {
  const desiredKeys = new Set(Object.keys(desired));
  const existingByKey = new Map(
    (existing || []).map((r) => [`${r.module}.${r.capability}`, r]),
  );

  const toApply = [];
  for (const item of Object.values(desired)) {
    const key = `${item.module}.${item.capability}`;
    const current = existingByKey.get(key);
    // A manual grant (or another mechanism's grant) always wins: never
    // overwrite it, never claim it as ours.
    if (current && current.granted_by !== sentinel) continue;
    // Already applied at this level — nothing to write (keeps the reconcile
    // report honest and the writes minimal).
    if (current && Number(current.access_level) === Number(item.level ?? 1)) continue;
    toApply.push({
      module: item.module,
      capability: item.capability,
      level: Number(item.level ?? 1),
    });
  }

  const toRevoke = (provenance || [])
    .filter((r) => !desiredKeys.has(`${r.module}.${r.capability}`))
    .map((r) => ({ module: r.module, capability: r.capability }));

  return { toApply, toRevoke };
}

/** Active founder relationships for one person (the justification for grants). */
export async function listActiveFounderVentures(cid) {
  if (!cid) return [];
  const r = await db.execute({
    sql: `SELECT DISTINCT CAST(venture_id AS TEXT) AS venture_id
          FROM venture_members
          WHERE removed_at IS NULL
            AND ${FOUNDER_MATCH_SQL}
            AND (contact_id = ? OR user_cid = ?)`,
    args: [String(cid), String(cid)],
  });
  return (r.rows || []).map((row) => String(row.venture_id)).filter(Boolean);
}

/** Capabilities the registry says this context role should provide. */
async function resolveContextDesiredCaps(context, roleKey) {
  const mapping = await getContextRoleProfile(context, roleKey);
  const row = mapping?.rows?.[0];
  if (!row || Number(row.is_active) !== 1 || !row.profile_id) {
    return { profile: null, desired: {}, reason: row ? "unmapped" : "no-registry-row" };
  }
  const caps = await db.execute({
    sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ?",
    args: [row.profile_id],
  });
  const desired = {};
  for (const c of caps.rows || []) {
    desired[`${c.module}.${c.capability}`] = {
      module: c.module,
      capability: c.capability,
      level: Number(c.access_level ?? 1),
    };
  }
  return { profile: row.profile_name || null, desired, reason: "mapped" };
}

async function invalidateUserContext(cid) {
  try {
    const { invalidateAuthorizationContext } = await import("./resolver");
    invalidateAuthorizationContext(String(cid));
  } catch (_) {
    // Cache invalidation is a freshness optimisation; the grant itself is
    // already written and the context TTL (60s) bounds the staleness.
  }
}

/**
 * Reconcile one person's context grants. Idempotent, never throws.
 *
 * @returns {{ success, cid, context, roleKey, profile, ventures, applied, revoked, reason }}
 */
export async function syncContextGrantsForUser(
  cid,
  { context = "venture", roleKey = "founder" } = {},
) {
  try {
    if (!cid) return { success: false, error: "cid is required" };
    await initDb();
    await ensureContextAppliedGrantsSchema();
    const sentinel = contextGrantSentinel(context, roleKey);

    // 1. Is the relationship that justifies these grants still active?
    const supportedContext =
      context === "venture" && roleKey === "founder";
    const ventures = supportedContext ? await listActiveFounderVentures(cid) : [];
    const justified = ventures.length > 0;

    // 2. What should the mapped profile provide?
    const resolved = justified
      ? await resolveContextDesiredCaps(context, roleKey)
      : { profile: null, desired: {}, reason: "no active relationship" };

    // 3. What exists today (manual grants + what we applied before)?
    const [existingRes, provenanceRes] = await Promise.all([
      db.execute({
        sql: "SELECT module, capability, access_level, granted_by FROM user_capabilities WHERE user_cid = ?",
        args: [String(cid)],
      }),
      db.execute({
        sql: "SELECT module, capability, access_level FROM context_applied_grants WHERE user_cid = ? AND context = ? AND role_key = ?",
        args: [String(cid), context, roleKey],
      }),
    ]);
    const plan = planContextGrantChanges({
      desired: resolved.desired,
      existing: existingRes?.rows || [],
      provenance: provenanceRes?.rows || [],
      sentinel,
    });

    // 4. Apply (additive; manual grants are never overwritten by the planner).
    for (const item of plan.toApply) {
      await db.execute({
        sql: `INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by, expires_at)
              VALUES (?, ?, ?, ?, ?, NULL)
              ON CONFLICT (user_cid, module, capability) DO UPDATE SET
                access_level = EXCLUDED.access_level,
                granted_by = EXCLUDED.granted_by,
                expires_at = NULL`,
        args: [String(cid), item.module, item.capability, item.level, sentinel],
      });
      await db.execute({
        sql: `INSERT INTO context_applied_grants (user_cid, context, role_key, source_ref, module, capability, access_level)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT (user_cid, context, role_key, module, capability) DO UPDATE SET
                access_level = EXCLUDED.access_level,
                source_ref = EXCLUDED.source_ref,
                updated_at = NOW()`,
        args: [
          String(cid),
          context,
          roleKey,
          ventures.join(",") || null,
          item.module,
          item.capability,
          item.level,
        ],
      });
    }

    // 5. Revoke only what this mechanism created (sentinel-guarded).
    for (const item of plan.toRevoke) {
      await db.execute({
        sql: "DELETE FROM user_capabilities WHERE user_cid = ? AND module = ? AND capability = ? AND granted_by = ?",
        args: [String(cid), item.module, item.capability, sentinel],
      });
      await db.execute({
        sql: "DELETE FROM context_applied_grants WHERE user_cid = ? AND context = ? AND role_key = ? AND module = ? AND capability = ?",
        args: [String(cid), context, roleKey, item.module, item.capability],
      });
    }

    // 6. Keep the venture list fresh even when nothing else changed.
    if (justified && plan.toApply.length === 0 && plan.toRevoke.length === 0) {
      await db.execute({
        sql: "UPDATE context_applied_grants SET source_ref = ?, updated_at = NOW() WHERE user_cid = ? AND context = ? AND role_key = ?",
        args: [ventures.join(","), String(cid), context, roleKey],
      });
    }

    const changed = plan.toApply.length > 0 || plan.toRevoke.length > 0;
    if (changed) await invalidateUserContext(cid);

    return {
      success: true,
      cid: String(cid),
      context,
      roleKey,
      profile: resolved.profile,
      ventures,
      applied: plan.toApply.map((i) => `${i.module}.${i.capability}`),
      revoked: plan.toRevoke.map((i) => `${i.module}.${i.capability}`),
      reason: resolved.reason,
    };
  } catch (e) {
    console.warn(`[Authz] syncContextGrantsForUser(${cid}) failed:`, e.message);
    return { success: false, cid, error: e.message };
  }
}

/**
 * Reconcile every person who has (or had) a justifying relationship.
 * This is the backfill + drift-repair entry point; safe to re-run.
 */
export async function syncAllContextGrants(
  { context = "venture", roleKey = "founder" } = {},
) {
  try {
    await initDb();
    await ensureContextAppliedGrantsSchema();

    const cids = new Set();
    if (context === "venture" && roleKey === "founder") {
      const relRes = await db.execute({
        sql: `SELECT DISTINCT COALESCE(NULLIF(contact_id, ''), user_cid) AS cid
              FROM venture_members
              WHERE removed_at IS NULL AND ${FOUNDER_MATCH_SQL}`,
      });
      for (const r of relRes.rows || []) if (r.cid) cids.add(String(r.cid));
    }
    // People whose relationship ended still need a pass so their applied rows
    // are removed.
    const provRes = await db.execute({
      sql: "SELECT DISTINCT user_cid AS cid FROM context_applied_grants WHERE context = ? AND role_key = ?",
      args: [context, roleKey],
    });
    for (const r of provRes.rows || []) if (r.cid) cids.add(String(r.cid));

    const results = [];
    for (const cid of cids) {
      results.push(await syncContextGrantsForUser(cid, { context, roleKey }));
    }

    const applied = results.flatMap((r) => r.applied || []);
    const revoked = results.flatMap((r) => r.revoked || []);
    return {
      success: true,
      context,
      roleKey,
      evaluated: results.length,
      applied,
      revoked,
      changes: applied.length + revoked.length,
      results,
    };
  } catch (e) {
    console.warn("[Authz] syncAllContextGrants failed:", e.message);
    return { success: false, error: e.message };
  }
}
