/**
 * Authorization — scope engine (SERVICE layer).
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
 * Layer (see docs/LAYER_SPLIT.md): this is the decision; the statements it runs
 * live in `@/models/authorization/scopeReads`. The pure catalogue + decision
 * composition live in `@/models/authorization/scope-catalog` (no db import) so
 * client components and tests can share the vocabulary.
 */

import { isScopePolicyImplemented } from "@/models/authorization/scope-catalog";
import {
  getVentureOwnScopeIds,
  getProgramAssignedScopeIds,
  getProgramStaffedScopeIds,
  getLearningOwnScopeIds,
  getVentureIdByUuid,
  contactSharesStaffedProgram,
} from "@/models/authorization/scopeReads";

export * from "@/models/authorization/scope-catalog";

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
      // UNION matches requireVentureAccess() exactly: an active membership
      // (founders/team — the venture is theirs) OR an active delegated staff
      // assignment (venture_staff_assignments). Global-role bypass stays in
      // the resolver (Super Admin) and in the transitional legacy path.
      case "venture_own":
        return await getVentureOwnScopeIds(userCid);
      // Assignment (program staff — staff_id may hold a cid OR an email)
      // UNION enrollment (participant_programs). Both are authoritative
      // context data; organizational membership is deliberately NOT used.
      case "program_assigned":
        return await getProgramAssignedScopeIds(userCid, email);
      // The WRITE side of the same question: staffing only. Enrollment is
      // deliberately absent — a learner is attached to their program, and
      // being attached must never authorise changing it.
      case "program_staffed":
        return await getProgramStaffedScopeIds(userCid, email);
      case "learning_own":
        return await getLearningOwnScopeIds(userCid);
      default:
        return null;
    }
  } catch (error) {
    console.warn(`[Scope] resolveScopeIds(${policyKey}) failed:`, error.message);
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
  const value = String(ventureId);
  if (value.startsWith("VNT-")) return value;
  try {
    const resolved = await getVentureIdByUuid(value);
    return resolved || value;
  } catch (error) {
    console.warn("[Scope] resolveVentureScopeId failed:", error.message);
    return value;
  }
}

/**
 * The authoritative scope predicate: is THIS record within the person's scope?
 * Fail closed on every uncertainty (null/empty ids, unsupported policy, error).
 */
export async function isWithinScope(policyKey, userCid, resourceId, options = {}) {
  if (resourceId === null || resourceId === undefined || resourceId === "") {
    return false;
  }
  const ids = await resolveScopeIds(policyKey, userCid, options);
  if (!ids) return false;
  return ids.includes(String(resourceId));
}

/**
 * AUTHZ-CRM-1 — contact → programme rule.
 *
 * Staff-side management of ANOTHER person's contact record (alternative emails)
 * must not reach every contact in the database. The relationship that justifies
 * it is a shared programme: the target is a participant of a programme the
 * caller is STAFFED on (`program_staffed`, the same authority the scope engine
 * enforces — never the capability cache). Fail closed on any uncertainty.
 */
export async function isContactWithinStaffedPrograms(targetCid, staffCid, { email = null } = {}) {
  if (!targetCid || !staffCid) return false;
  try {
    return await contactSharesStaffedProgram(targetCid, staffCid, email);
  } catch (error) {
    console.warn("[Scope] isContactWithinStaffedPrograms failed:", error.message);
    return false;
  }
}
