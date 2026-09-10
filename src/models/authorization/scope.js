/**
 * ImpactOS — Authorization Foundation: SCOPE ENGINE (Phase 5).
 *
 * SCOPE answers the third authorization question — after eligibility ("may
 * this identity ever do X?") and capability ("does this person hold X?"):
 *
 *     "WHICH RECORDS may the capability operate on?"
 *
 * Architecture (per the product directive — do NOT conflate these):
 *
 *     CAPABILITY  → cached authorization context (resolver, unchanged)
 *     SCOPE       → authoritative assignment data → data-layer predicate → query
 *
 * The security decision for scoped records comes from the ACTUAL predicate
 * (`isWithinScope`) reading assignment rows — never from cache freshness, and
 * never from client state. A failed cache invalidation must not grant scope;
 * it cannot, because this module never reads the capability cache at all.
 *
 * Phase 5a is deliberately INERT: predicates are implemented and verifiable
 * through the Permission Center verification endpoint, but no route enforces
 * them yet. The first consuming seam (a bounded route conversion) is the next,
 * explicitly-approved step.
 *
 * Fail-closed rules baked in here:
 *   - unknown/unsupported policy  → deny
 *   - resolver (db) error         → deny
 *   - empty/missing resource id   → deny
 *   - no assigned rows            → deny
 *
 * The pure catalogue + decision composition live in ./scope-catalog (no db
 * import) so client components and tests can share the vocabulary.
 */

import db from "@/lib/db";
import { isScopePolicyImplemented } from "./scope-catalog";

export * from "./scope-catalog";

/**
 * The record ids a person is assigned to under a policy.
 *
 * Returns string[] (possibly empty) on success, or null when the policy is
 * unsupported/unknown or the lookup fails — callers MUST treat null as DENY.
 * Never throws.
 */
export async function resolveScopeIds(policyKey, userCid, { email = null } = {}) {
  if (!userCid || !isScopePolicyImplemented(policyKey)) return null;
  try {
    switch (policyKey) {
      case "venture_own": {
        // UNION matches requireVentureAccess() exactly: an active membership
        // (founders/team — the venture is theirs) OR an active delegated staff
        // assignment (venture_staff_assignments). Global-role bypass stays in
        // the resolver (Super Admin) and in the transitional legacy path.
        const r = await db.execute({
          sql: `SELECT DISTINCT CAST(venture_id AS TEXT) AS id
                FROM venture_members
                WHERE (user_cid = ? OR contact_id = ?) AND removed_at IS NULL
                UNION
                SELECT DISTINCT CAST(venture_id AS TEXT) AS id
                FROM venture_staff_assignments
                WHERE staff_contact_id = ? AND status = 'active'`,
          args: [userCid, userCid, userCid],
        });
        return r.rows.map((x) => String(x.id));
      }
      case "program_assigned": {
        // Assignment (program staff — staff_id may hold a cid OR an email)
        // UNION enrollment (participant_programs). Both are authoritative
        // context data; organizational membership is deliberately NOT used.
        const r = await db.execute({
          sql: `SELECT DISTINCT CAST(program_id AS TEXT) AS id
                FROM v2_program_staff
                WHERE staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?)
                UNION
                SELECT DISTINCT CAST(program_id AS TEXT) AS id
                FROM participant_programs
                WHERE participant_id = ?`,
          args: [userCid, email || userCid, userCid],
        });
        return r.rows.map((x) => String(x.id));
      }
      case "learning_own": {
        const r = await db.execute({
          sql: `SELECT DISTINCT CAST(course_id AS TEXT) AS id
                FROM lms_enrollments
                WHERE user_cid = ? AND status <> 'suspended'`,
          args: [userCid],
        });
        return r.rows.map((x) => String(x.id));
      }
      default:
        return null;
    }
  } catch (e) {
    console.warn(`[Scope] resolveScopeIds(${policyKey}) failed:`, e.message);
    return null; // fail closed — an unresolvable scope is a denial
  }
}

/**
 * Normalize a route's venture identifier to the canonical scope key.
 *
 * venture_members / venture_staff_assignments store the VNT code, while some
 * routes receive the internal UUID — the predicate compares strings, so pass
 * the canonical code. Fail-soft: when a UUID cannot be resolved (or the lookup
 * errors) the raw value is returned and the predicate simply won't match
 * (deny), never a false allow.
 */
export async function resolveVentureScopeId(ventureId) {
  if (ventureId === null || ventureId === undefined || ventureId === "") {
    return null;
  }
  const val = String(ventureId);
  if (val.startsWith("VNT-")) return val;
  try {
    const r = await db.execute({
      sql: "SELECT venture_id FROM ventures WHERE id::text = ?",
      args: [val],
    });
    return r.rows?.[0]?.venture_id || val;
  } catch (e) {
    console.warn("[Scope] resolveVentureScopeId failed:", e.message);
    return val;
  }
}

/**
 * The authoritative scope predicate: is THIS record within the person's scope?
 * Fail closed on every uncertainty (null/empty ids, unsupported policy, error).
 */
export async function isWithinScope(policyKey, userCid, resourceId, opts = {}) {
  if (resourceId === null || resourceId === undefined || resourceId === "") {
    return false;
  }
  const ids = await resolveScopeIds(policyKey, userCid, opts);
  if (!ids) return false;
  return ids.includes(String(resourceId));
}
