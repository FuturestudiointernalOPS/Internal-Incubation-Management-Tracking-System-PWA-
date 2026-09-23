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
import {
  listActiveProgramAssignments,
  listProgramAssignmentContacts,
  assignmentsForRole,
  loadAssignmentLookups,
  deriveFacilitatorDesiredCaps,
  deriveAssignmentsExpiry,
} from "./programAssignments";

let contextAppliedGrantsSchemaPromise = null;

/**
 * Context × role combinations the reconcile machinery can justify and resolve.
 *
 *   venture:founder        — active venture membership, "Founder" profile
 *   program:facilitator    — active program assignment; the PER-PROGRAM TICK
 *                            LIST decides which capabilities it really grants
 *   program:program_manager— active program assignment (named manager or a
 *                            program_manager staff row); registry-mapped profile
 *
 * `team` and venture-side consolidation are deliberately out of scope.
 */
export const SUPPORTED_CONTEXT_ROLES = [
  { context: "venture", roleKey: "founder" },
  { context: "program", roleKey: "facilitator" },
  { context: "program", roleKey: "program_manager" },
];

/** ISO date (YYYY-MM-DD) from a Date or a timestamp string; null when absent. */
function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }
  const iso = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

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
    })().catch((error) => {
      console.warn("[Authz] ensureContextAppliedGrantsSchema failed:", error.message);
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
 * @param {string|null} [args.expiresAt]  when provided (even null), the grant's
 *   expiry is managed by the caller: a row whose level AND expiry already match
 *   is left alone, so a program whose end date moved is picked up as a change.
 *   When omitted, expiry is out of scope and the previous comparison applies.
 * @returns {{ toApply: Array, toRevoke: Array }}
 */
export function planContextGrantChanges({
  desired = {},
  existing = [],
  provenance = [],
  sentinel,
  expiresAt,
}) {
  const desiredKeys = new Set(Object.keys(desired));
  const existingByKey = new Map(
    (existing || []).map((row) => [`${row.module}.${row.capability}`, row]),
  );

  const managesExpiry = expiresAt !== undefined;
  const expiryMatches = (row) =>
    !managesExpiry || isoDate(row?.expires_at) === isoDate(expiresAt);

  const toApply = [];
  for (const item of Object.values(desired)) {
    const key = `${item.module}.${item.capability}`;
    const current = existingByKey.get(key);
    // A manual grant (or another mechanism's grant) always wins: never
    // overwrite it, never claim it as ours.
    if (current && current.granted_by !== sentinel) continue;
    // Already applied at this level (and expiry, when managed) — nothing to
    // write (keeps the reconcile report honest and the writes minimal).
    if (
      current &&
      Number(current.access_level) === Number(item.level ?? 1) &&
      expiryMatches(current)
    ) {
      continue;
    }
    toApply.push({
      module: item.module,
      capability: item.capability,
      level: Number(item.level ?? 1),
      expiresAt: managesExpiry ? expiresAt : undefined,
    });
  }

  const toRevoke = (provenance || [])
    .filter((row) => !desiredKeys.has(`${row.module}.${row.capability}`))
    .map((row) => ({ module: row.module, capability: row.capability }));

  return { toApply, toRevoke };
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

/** Capabilities the registry says this context role should provide. */
export async function resolveContextDesiredCaps(context, roleKey) {
  const mapping = await getContextRoleProfile(context, roleKey);
  const row = mapping?.rows?.[0];
  if (!row || Number(row.is_active) !== 1 || !row.profile_id) {
    return { profile: null, desired: {}, reason: row ? "unmapped" : "no-registry-row" };
  }
  const capabilitiesResult = await db.execute({
    sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ?",
    args: [row.profile_id],
  });
  const desired = {};
  for (const capabilityRow of capabilitiesResult.rows || []) {
    desired[`${capabilityRow.module}.${capabilityRow.capability}`] = {
      module: capabilityRow.module,
      capability: capabilityRow.capability,
      level: Number(capabilityRow.access_level ?? 1),
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
 * Why do these grants exist, and what should they be? One place for the three
 * supported context roles, so the reconcile path stays identical for all of
 * them. Returns null for an unsupported pair (the caller reports it rather than
 * silently revoking).
 *
 * `expiresAt` is only produced for the PROGRAM contexts: program access ends
 * with the program, so the grant carries the latest program end date and the
 * resolver stops honouring it on its own once that date passes.
 */
async function resolveContextJustification(cid, { context, roleKey, email }) {
  if (context === "venture" && roleKey === "founder") {
    const ventures = await listActiveFounderVentures(cid);
    if (ventures.length === 0) {
      return {
        sourceIds: [],
        profile: null,
        desired: {},
        reason: "no active relationship",
        managesExpiry: false,
        expiresAt: null,
      };
    }
    const resolved = await resolveContextDesiredCaps(context, roleKey);
    return {
      sourceIds: ventures,
      profile: resolved.profile,
      desired: resolved.desired,
      reason: resolved.reason,
      managesExpiry: false,
      expiresAt: null,
    };
  }

  if (
    context === "program" &&
    (roleKey === "facilitator" || roleKey === "program_manager")
  ) {
    const { rows } = await listActiveProgramAssignments(cid, { email });
    const mine = assignmentsForRole(rows, roleKey);
    const sourceIds = mine.map((assignment) => String(assignment.program_id));
    if (mine.length === 0) {
      return {
        sourceIds,
        profile: null,
        desired: {},
        reason: "no active relationship",
        managesExpiry: true,
        expiresAt: null,
      };
    }
    const expiresAt = deriveAssignmentsExpiry(mine);
    if (roleKey === "facilitator") {
      // The FACILITATOR's per-program tick list is the source of truth: the
      // grant must reflect what the assignments actually grant, never a
      // blanket default. A capability ticked off in every program disappears
      // from the grant on the next reconcile.
      const lookups = await loadAssignmentLookups(mine);
      const { desired } = deriveFacilitatorDesiredCaps(mine, lookups);
      return {
        sourceIds,
        profile: "Facilitator assignment (per-program permissions)",
        desired,
        reason: Object.keys(desired).length ? "assigned" : "no per-program rights",
        managesExpiry: true,
        expiresAt,
      };
    }
    // Program manager: the Context Roles registry decides the profile.
    const resolved = await resolveContextDesiredCaps(context, roleKey);
    return {
      sourceIds,
      profile: resolved.profile,
      desired: resolved.desired,
      reason: resolved.reason,
      managesExpiry: true,
      expiresAt,
    };
  }

  return null;
}

/**
 * Reconcile one person's context grants. Idempotent, never throws.
 *
 * @returns {{ success, cid, context, roleKey, profile, applied, revoked, reason,
 *             expiresAt?, programs?, ventures? }}
 */
export async function syncContextGrantsForUser(
  cid,
  { context = "venture", roleKey = "founder", email = null } = {},
) {
  try {
    if (!cid) return { success: false, error: "cid is required" };
    await initDb();
    await ensureContextAppliedGrantsSchema();
    const sentinel = contextGrantSentinel(context, roleKey);

    // 1 + 2. Is the justifying relationship still active, and what should the
    //        grant be? (One dispatch for venture founder / program facilitator
    //        / program manager.)
    const support = await resolveContextJustification(cid, {
      context,
      roleKey,
      email,
    });
    if (!support) {
      return {
        success: false,
        cid: String(cid),
        context,
        roleKey,
        error: "unsupported context role",
      };
    }
    const { sourceIds, profile, desired, reason, managesExpiry } = support;
    const expiresAt = managesExpiry ? support.expiresAt : null;
    const resolved = { profile, desired, reason };

    // 3. What exists today (manual grants + what we applied before)?
    const [existingRes, provenanceRes] = await Promise.all([
      db.execute({
        sql: "SELECT module, capability, access_level, granted_by, expires_at FROM user_capabilities WHERE user_cid = ?",
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
      // Only the program contexts own an expiry. Passing undefined (not null)
      // keeps the venture path's comparison exactly as it was.
      expiresAt: managesExpiry ? expiresAt : undefined,
    });

    // 4. Apply (additive; manual grants are never overwritten by the planner).
    for (const item of plan.toApply) {
      await db.execute({
        sql: `INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by, expires_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (user_cid, module, capability) DO UPDATE SET
                access_level = EXCLUDED.access_level,
                granted_by = EXCLUDED.granted_by,
                expires_at = EXCLUDED.expires_at`,
        args: [
          String(cid),
          item.module,
          item.capability,
          item.level,
          sentinel,
          managesExpiry ? expiresAt : null,
        ],
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
          sourceIds.join(",") || null,
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

    // 6. Keep the justifying-relationship list AND the expiry fresh even when
    //    nothing else changed — a program whose end date moved must re-date the
    //    grant even though the capability set did not change.
    if (sourceIds.length > 0 && plan.toApply.length === 0 && plan.toRevoke.length === 0) {
      await db.execute({
        sql: "UPDATE context_applied_grants SET source_ref = ?, updated_at = NOW() WHERE user_cid = ? AND context = ? AND role_key = ?",
        args: [sourceIds.join(","), String(cid), context, roleKey],
      });
      if (managesExpiry) {
        await db.execute({
          sql: `UPDATE user_capabilities SET expires_at = ?
                WHERE user_cid = ? AND granted_by = ? AND expires_at IS DISTINCT FROM ?`,
          args: [expiresAt, String(cid), sentinel, expiresAt],
        });
      }
    }

    const changed = plan.toApply.length > 0 || plan.toRevoke.length > 0;
    if (changed) await invalidateUserContext(cid);

    return {
      success: true,
      cid: String(cid),
      context,
      roleKey,
      profile: resolved.profile,
      // Venture callers read `ventures`; program callers read `programs`. The
      // field name keeps the original contract intact.
      ...(context === "venture"
        ? { ventures: sourceIds }
        : { programs: sourceIds }),
      ...(managesExpiry ? { expiresAt } : {}),
      applied: plan.toApply.map((item) => `${item.module}.${item.capability}`),
      revoked: plan.toRevoke.map((item) => `${item.module}.${item.capability}`),
      reason: resolved.reason,
    };
  } catch (error) {
    console.warn(`[Authz] syncContextGrantsForUser(${cid}) failed:`, error.message);
    return { success: false, cid, error: error.message };
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
      for (const row of relRes.rows || []) if (row.cid) cids.add(String(row.cid));
    } else if (context === "program") {
      // Everyone who currently holds a program assignment (any role — the
      // per-role split happens inside the per-user reconcile).
      for (const cid of await listProgramAssignmentContacts()) cids.add(cid);
    }
    // People whose relationship ended still need a pass so their applied rows
    // are removed.
    const provRes = await db.execute({
      sql: "SELECT DISTINCT user_cid AS cid FROM context_applied_grants WHERE context = ? AND role_key = ?",
      args: [context, roleKey],
    });
    for (const row of provRes.rows || []) if (row.cid) cids.add(String(row.cid));

    const results = [];
    for (const cid of cids) {
      results.push(await syncContextGrantsForUser(cid, { context, roleKey }));
    }

    const applied = results.flatMap((result) => result.applied || []);
    const revoked = results.flatMap((result) => result.revoked || []);
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
  } catch (error) {
    console.warn("[Authz] syncAllContextGrants failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Reconcile EVERY supported context for ONE person. This is the "connect and
 * receive the changes" path: a facilitator or program manager who was already
 * in production when this mechanism shipped gets their assignment-derived
 * grants applied the moment their permissions are read — additively, so nothing
 * they hold today is taken away by the act of connecting.
 *
 * Cost-bounded by ON_CONNECT_TTL_MS: the caller is a hot read path, and a
 * reconcile is 3 × (a few queries). Once per window is enough — grants only
 * change when an assignment, a tick list, a profile or a program end date
 * changes, and the write paths already reconcile directly.
 */
const ON_CONNECT_TTL_MS = 5 * 60 * 1000;
const _lastOnConnectSync = new Map();

export async function syncContextGrantsOnConnect(cid, { email = null, force = false } = {}) {
  if (!cid) return { success: false, error: "cid is required" };
  const key = String(cid);
  const last = _lastOnConnectSync.get(key);
  if (!force && last && Date.now() - last < ON_CONNECT_TTL_MS) {
    return { success: true, skipped: true, reason: "within-ttl" };
  }
  _lastOnConnectSync.set(key, Date.now());

  const results = [];
  for (const spec of SUPPORTED_CONTEXT_ROLES) {
    results.push(
      await syncContextGrantsForUser(cid, { ...spec, email }),
    );
  }
  const applied = results.flatMap((result) => result.applied || []);
  const revoked = results.flatMap((result) => result.revoked || []);
  return {
    success: true,
    cid: key,
    contexts: results,
    applied,
    revoked,
    changes: applied.length + revoked.length,
  };
}

/**
 * Sweep every supported context across every relationship holder — the
 * backfill and the drift repair. This is what a scheduled run calls, and it is
 * also how access ENDS: when a program's end date passes, or its status is set
 * to completed/archived, the assignment stops being active and this pass
 * withdraws the grants it justified.
 *
 * Aggregates the per-context reports into the flat shape the earlier phases
 * returned (`evaluated` / `applied` / `revoked` / `changes`) so existing
 * consumers keep working, and adds `contexts` for the per-context detail.
 */
export async function syncAllContextGrantsEverywhere() {
  const contexts = [];
  for (const spec of SUPPORTED_CONTEXT_ROLES) {
    contexts.push(await syncAllContextGrants(spec));
  }
  const applied = contexts.flatMap((contextResult) => contextResult.applied || []);
  const revoked = contexts.flatMap((contextResult) => contextResult.revoked || []);
  return {
    success: contexts.every((contextResult) => contextResult.success !== false),
    contexts: contexts.map((contextResult) => ({
      context: contextResult.context,
      roleKey: contextResult.roleKey,
      evaluated: contextResult.evaluated ?? 0,
      applied: contextResult.applied || [],
      revoked: contextResult.revoked || [],
      changes: contextResult.changes ?? 0,
    })),
    evaluated: contexts.reduce((sum, contextResult) => sum + (contextResult.evaluated ?? 0), 0),
    applied,
    revoked,
    changes: applied.length + revoked.length,
  };
}

/**
 * Withdraw every grant this mechanism applied for ONE context/role, regardless
 * of whether the relationship still exists. Used when an administrator clears
 * or disables a mapping and wants the effect applied immediately rather than
 * waiting for the next reconcile to notice.
 */
export async function revokeAllContextGrants(cid, { context, roleKey }) {
  const sentinel = contextGrantSentinel(context, roleKey);
  try {
    if (!cid) return { success: false, error: "cid is required" };
    await initDb();
    await ensureContextAppliedGrantsSchema();
    const prov = await db.execute({
      sql: "SELECT module, capability FROM context_applied_grants WHERE user_cid = ? AND context = ? AND role_key = ?",
      args: [String(cid), context, roleKey],
    });
    const removed = [];
    for (const row of prov.rows || []) {
      await db.execute({
        sql: "DELETE FROM user_capabilities WHERE user_cid = ? AND module = ? AND capability = ? AND granted_by = ?",
        args: [String(cid), row.module, row.capability, sentinel],
      });
      removed.push(`${row.module}.${row.capability}`);
    }
    await db.execute({
      sql: "DELETE FROM context_applied_grants WHERE user_cid = ? AND context = ? AND role_key = ?",
      args: [String(cid), context, roleKey],
    });
    if (removed.length) await invalidateUserContext(cid);
    return { success: true, cid: String(cid), context, roleKey, revoked: removed };
  } catch (error) {
    console.warn(`[Authz] revokeAllContextGrants(${cid}) failed:`, error.message);
    return { success: false, error: error.message };
  }
}
