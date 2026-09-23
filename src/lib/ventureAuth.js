import { getSession } from "@/lib/auth";
import { getVentureFacts, getViewerRelationship, ventureAccessFacts } from "@/lib/ventureAccessFacts";

/** Roles that may always access Venture records (incl. archived, historical). */
export function roleIsPrivileged(role) {
  return ["staff", "super_admin", "program_manager"].includes(role);
}

/**
 * Staff actor on a Venture = global Venture authority OR a delegated staff
 * member with an ACTIVE assignment on this Venture. Mere Venture membership
 * (founders/team) is NOT staff. Used to gate staff-instrument operations
 * (investment engine, fundraising/investor pipelines, analytics/reports)
 * that were previously reachable by any member through requireVentureAccess.
 */
export async function isStaffActorForVenture(db, ventureId, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;
  if (!session.cid) return false;
  try {
    // venture_staff_assignments stores the VNT code (TEXT). The shared facts
    // resolve an internal UUID back to the code once, for every caller.
    const facts = await getVentureFacts(ventureId, db);
    return hasActiveVentureAssignment(facts?.code || ventureId, session.cid, db);
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
export async function resolveVentureLifecycle(ventureId, db) {
  try {
    // Shared with every other screen of the same page: the lifecycle state is
    // the Venture's own fact, and asking for it once is enough.
    const facts = await getVentureFacts(ventureId, db);
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
export async function requireOperationalVentureAccess({ ventureId, db, session, mutate = false }) {
  const lifecycle = await resolveVentureLifecycle(ventureId, db);
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
 * Shared venture access check — import this instead of re-implementing
 * the membership check in every route. Returns the session or null.
 *
 * Usage in a route:
 *   const { ventureId, session } = await requireVentureAccess(params.id);
 *   if (!session) return NextResponse.json({...}, {status: 404});
 *
 * Rules (Phase 2 — assignment-aware delegation):
 *   - GLOBAL roles (super_admin) bypass membership
 *     (org-wide Venture authority).
 *   - Everyone else must hold EITHER:
 *       a) an ACTIVE venture_members row (founder/member access), OR
 *       b) an ACTIVE staff assignment (venture_staff_assignments) —
 *          delegated staff access derived from the assignment, never from
 *          the global role alone.
 *   - Plain `staff`/`program_manager` WITHOUT an assignment no longer
 *     bypass: access is per-Venture via assignment or membership.
 *   - Non-member / non-assigned → 404 (don't leak existence).
 */
export async function hasActiveVentureAssignment(ventureCode, sessionCid, db) {
  if (!ventureCode || !sessionCid) return false;
  try {
    // Shares the cached relationship, so an access check and a staff-actor check
    // on the same screen never ask the database twice for the same answer.
    const relationship = await getViewerRelationship(ventureCode, sessionCid, db);
    return relationship.is_assigned;
  } catch (_) {
    return false;
  }
}

export async function requireVentureAccess(ventureId, db) {
  const session = await getSession();
  if (!session) return { ventureId, session: null };

  // Global Venture authority (Phase 2: narrowed from all staff/PM roles).
  const globalRoles = ["super_admin"];
  if (globalRoles.includes(session.role)) {
    return { ventureId, session };
  }

  if (session.cid) {
    // Two facts, one round trip each, asked once per viewer and Venture rather
    // than once per screen (see lib/ventureAccessFacts.js): the Venture's code
    // (venture_members stores the code, not the internal id) and then the
    // relationship itself — membership OR a delegated staff assignment.
    const { facts, relationship } = await ventureAccessFacts(ventureId, session.cid, db);
    if (facts && (relationship.is_member || relationship.is_assigned)) {
      return { ventureId, session };
    }
  }

  return { ventureId, session: null };
}
