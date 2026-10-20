import { getSession } from "@/server/auth/session";
import { getVentureFacts, getViewerRelationship, ventureAccessFacts } from "@/services/ventures/accessFacts";
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
 * that were previously reachable by any member through requireVentureAccess.
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

/**
 * Shared venture access check — import this instead of re-implementing the
 * membership check in every route. Returns the session, or null plus a stable
 * `reason` that tells the route WHICH refusal to send.
 *
 * Usage in a route:
 *   const { session, reason } = await requireVentureAccess(params.id);
 *   if (!session) return ventureAccessRefusal(reason);
 *
 * Rules (Phase 2 — assignment-aware delegation):
 *   - GLOBAL roles (super_admin) bypass membership (org-wide authority).
 *   - Everyone else must hold EITHER an ACTIVE venture_members row, OR an
 *     ACTIVE staff assignment (venture_staff_assignments) — delegated staff
 *     access derived from the assignment, never from the role alone.
 *   - Plain `staff`/`program_manager` WITHOUT an assignment no longer bypass.
 *
 * D-6 (option 1 — honest refusals): the three situations are distinct.
 *   - `unauthenticated` → 401, nobody is signed in;
 *   - `not-found`       → 404, the Venture genuinely does not exist;
 *   - `out-of-scope`    → 403, the Venture exists but is not theirs.
 *
 * Masking a permission refusal as "not found" used to hide existence, but it
 * also told support staff the wrong thing. The only remaining 404 is the true
 * one.
 */
export async function requireVentureAccess(ventureId) {
  const session = await getSession();
  if (!session) return { ventureId, session: null, reason: "unauthenticated" };

  // Global Venture authority (Phase 2: narrowed from all staff/PM roles).
  if (isPlatformOwnerRole(session.role)) {
    return { ventureId, session, reason: null };
  }

  // Two facts, one round trip each, asked once per viewer and Venture rather
  // than once per screen (see services/ventures/accessFacts.js): the Venture's
  // own row — which carries the internal id the membership and assignment
  // tables key on since Phase 0 — and then the relationship itself.
  const { facts, relationship } = await ventureAccessFacts(ventureId, session.cid || "");
  if (!facts) return { ventureId, session: null, reason: "not-found" };

  if (session.cid && (relationship.is_member || relationship.is_assigned)) {
    return { ventureId, session, reason: null };
  }

  return { ventureId, session: null, reason: "out-of-scope" };
}
