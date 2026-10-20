import { getVentureFacts, getViewerRelationship } from "@/services/ventures/accessFacts";
import {
  isInternalStaffRole,
  isLegacyProgramManagerRole,
  isPlatformOwnerRole,
} from "@/lib/identity";

/** Roles that may always access Venture records (incl. archived, historical). */
export function roleIsPrivileged(role) {
  return (
    isPlatformOwnerRole(role) ||
    isInternalStaffRole(role) ||
    isLegacyProgramManagerRole(role)
  );
}

/**
 * Staff actor on a Venture = global Venture authority OR a delegated staff
 * member with an ACTIVE assignment on this Venture. Mere Venture membership
 * (founders/team) is NOT staff. Used to gate staff-instrument operations
 * (investment engine, fundraising/investor pipelines, analytics/reports)
 * that were previously reachable by any member through the legacy membership
 * gate.
 */
export async function isStaffActorForVenture(ventureId, session) {
  if (!session) return false;
  if (isPlatformOwnerRole(session.role)) return true;
  if (!session.cid) return false;
  try {
    // `venture_staff_assignments` keys on the INTERNAL id (Phase 0), resolved
    // inside the relationship read from whatever identifier we were handed.
    // Passing the reference straight through keeps the Venture's own facts a
    // cache hit for the caller that just asked for them.
    return hasActiveVentureAssignment(ventureId, session.cid);
  } catch (_) {
    return false;
  }
}

/** A Venture is archived when status='archived' OR is_archived=1. */
export function lifecycleIsArchived(lifecycle) {
  if (!lifecycle) return false;
  return (
    String(lifecycle.status || "").toLowerCase() === "archived" ||
    Number(lifecycle.is_archived) === 1 ||
    String(lifecycle.is_archived) === "true"
  );
}

/**
 * Resolve the lifecycle state of a Venture (status + is_archived). Accepts
 * the VNT code or the internal UUID. Never throws.
 */
export async function resolveVentureLifecycle(ventureId) {
  try {
    // Shared with every other screen of the same page: the lifecycle state is
    // the Venture's own fact, and asking for it once is enough.
    const facts = await getVentureFacts(ventureId);
    return facts ? { status: facts.status, is_archived: facts.is_archived } : null;
  } catch (_) {
    return null;
  }
}

/**
 * Operational access gate (Phase 3):
 *  - archived Venture: privileged roles may still READ (historical);
 *    mutations are blocked for EVERYONE (archive → resume first);
 *    non-privileged members lose active access entirely.
 *  - active/paused Venture: normal membership rules apply elsewhere.
 */
export async function requireOperationalVentureAccess({ ventureId, session, mutate = false }) {
  const lifecycle = await resolveVentureLifecycle(ventureId);
  if (!lifecycle) return { ok: false, code: "not_found" };
  const archived = lifecycleIsArchived(lifecycle);
  if (archived) {
    if (mutate) {
      return { ok: false, code: "archived", reason: "Archived Ventures are historical records. Resume the Venture before making changes." };
    }
    if (!roleIsPrivileged(session?.role)) {
      return { ok: false, code: "archived", reason: "This Venture is archived. Active Venture access has ended." };
    }
  }
  return { ok: true, lifecycle };
}

/**
 * Does this person hold an ACTIVE staff assignment on this Venture?
 * `ventureRef` is the access key ("VNT-…") or the internal id.
 */
export async function hasActiveVentureAssignment(ventureRef, sessionCid) {
  if (!ventureRef || !sessionCid) return false;
  try {
    // Shares the cached relationship, so an access check and a staff-actor check
    // on the same screen never ask the database twice for the same answer.
    const relationship = await getViewerRelationship(ventureRef, sessionCid);
    return relationship.is_assigned;
  } catch (_) {
    return false;
  }
}


