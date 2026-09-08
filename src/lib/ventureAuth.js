import { getSession } from "@/lib/auth";

/** Roles that may always access Venture records (incl. archived, historical). */
export function roleIsPrivileged(role) {
  return ["staff", "super_admin", "program_manager", "developer", "admin"].includes(role);
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
  if (["super_admin", "developer", "admin"].includes(session.role)) return true;
  if (!session.cid) return false;
  try {
    // venture_staff_assignments stores the VNT code (TEXT). Convert an internal
    // UUID (if passed) back to the code so the assignment check matches.
    let code = ventureId;
    if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
      const v = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [ventureId] });
      if (v.rows?.[0]?.venture_id) code = v.rows[0].venture_id;
    }
    return hasActiveVentureAssignment(code, session.cid, db);
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
    if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
      const byId = await db.execute({
        sql: "SELECT status, is_archived FROM ventures WHERE id::text = ?",
        args: [ventureId],
      });
      if (byId.rows?.[0]) return byId.rows[0];
    }
    const r = await db.execute({
      sql: "SELECT status, is_archived FROM ventures WHERE venture_id = ?",
      args: [ventureId],
    });
    return r.rows?.[0] || null;
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
 *   - GLOBAL roles (super_admin / developer / admin) bypass membership
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
    const r = await db.execute({
      sql: "SELECT 1 FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' LIMIT 1",
      args: [ventureCode, sessionCid],
    });
    return (r.rows || []).length > 0;
  } catch (_) {
    return false;
  }
}

export async function requireVentureAccess(ventureId, db) {
  const session = await getSession();
  if (!session) return { ventureId, session: null };

  // Global Venture authority (Phase 2: narrowed from all staff/PM roles).
  const globalRoles = ["super_admin", "developer", "admin"];
  if (globalRoles.includes(session.role)) {
    return { ventureId, session };
  }

  if (session.cid) {
    // venture_members stores venture_id as the VNT code (TEXT). Convert an
    // internal UUID (if passed) back to the code so the membership check matches.
    let code = ventureId;
    try {
      if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
        const v = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [ventureId] });
        if (v.rows?.[0]?.venture_id) code = v.rows[0].venture_id;
      }
    } catch {}
    const r = await db.execute({
      sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL LIMIT 1",
      args: [code, session.cid],
    });
    if (r.rows?.length > 0) {
      return { ventureId, session };
    }
    // Delegated staff: explicit Venture assignment grants access (Phase 2).
    if (await hasActiveVentureAssignment(code, session.cid, db)) {
      return { ventureId, session };
    }
  }

  return { ventureId, session: null };
}
