/**
 * profile — Who may read and edit a startup profile.
 *
 * Part of `services/ventures/profile` (split out of the former single
 * 441-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/profile.js`.
 */
import { selectFounderIdByEmail, selectFounderMemberIdByCid, selectVentureCodeByIdText } from "@/models/ventureProfileStore";

/**
 * Check if a user is authorized to edit a venture's startup profile.
 */
export async function canEditStartupProfile(ventureId, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;

  // Check if user is a founder of this venture
  const founderRes = await selectFounderIdByEmail(ventureId, session.email || "");
  if (founderRes.rows.length > 0) return true;

  // Check if user is a member with founder-like role
  const memberRes = await selectFounderMemberIdByCid(ventureId, session.cid);
  if (memberRes.rows.length > 0) return true;

  return false;
}

/**
 * Delegated staff read helper (Phase 2 — assignment-aware): a staff or
 * program_manager may act on a Venture only when they hold an explicit
 * active staff assignment (venture_staff_assignments). Resolves the VNT
 * code when passed the internal UUID.
 */
async function hasDelegatedVentureAssignment(ventureId, session) {
  if (!session?.cid) return false;
  try {
    const { hasActiveVentureAssignment } = await import("@/lib/ventureAuth");
    let code = ventureId;
    if (typeof ventureId === "string" && /[a-f0-9-]{36}/i.test(ventureId)) {
      const byId = await selectVentureCodeByIdText(ventureId);
      if (byId.rows?.[0]) code = byId.rows[0].venture_id;
    }
    return await hasActiveVentureAssignment(code, session.cid);
  } catch (_) {
    return false;
  }
}

/**
 * Check if a user has read access to a venture's startup profile.
 */
export async function canReadStartupProfile(ventureId, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;

  // Delegated staff (Phase 2): read access derives from an explicit Venture
  // assignment — never from the staff role alone.
  if (["staff", "program_manager"].includes(session.role)) {
    return hasDelegatedVentureAssignment(ventureId, session);
  }

  // Founders can read
  return canEditStartupProfile(ventureId, session);
}
