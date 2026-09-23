/**
 * VENTURE MEMBER ACCESS — who may see / change a Venture's roster.
 *
 * Shared by the membership route and the invitation route so the two can never
 * drift apart. Kept in the model layer because it is a domain rule about the
 * Venture, not an HTTP concern.
 *
 *   view   — GLOBAL staff see the roster; otherwise an active membership OR an
 *            active staff assignment on this Venture is required.
 *   mutate — founders manage the roster. Staff may too, but only when their
 *            assignment grants `founders:manage` (Lead Manager by default;
 *            Coach / Facilitator do not).
 */

import { hasVentureCapability, hasAnyVentureAssignment } from "@/lib/venturePermissions";

/**
 * `venture_members` keys on the VNT business code (TEXT), not the internal
 * UUID — convert an internal id back to the code so the lookups match.
 */
export async function resolveVentureCode(db, idOrCode) {
  if (!idOrCode) return idOrCode;
  if (typeof idOrCode === "string" && idOrCode.includes("-") && !idOrCode.startsWith("VNT-")) {
    try {
      const result = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [idOrCode] });
      return result.rows?.[0]?.venture_id || idOrCode;
    } catch {
      return idOrCode;
    }
  }
  return idOrCode;
}

export async function getVentureFounderCount(db, ventureId) {
  const code = await resolveVentureCode(db, ventureId);
  const result = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM venture_members WHERE venture_id = ? AND member_type = 'founder' AND removed_at IS NULL",
    args: [code],
  });
  return parseInt(result.rows?.[0]?.cnt || 0);
}

export async function isVentureMember(db, ventureId, cid) {
  const code = await resolveVentureCode(db, ventureId);
  const result = await db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL LIMIT 1",
    args: [code, cid],
  });
  return result.rows?.length > 0;
}

export async function isVentureFounder(db, ventureId, cid) {
  const code = await resolveVentureCode(db, ventureId);
  const result = await db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1",
    args: [code, cid],
  });
  return result.rows?.length > 0;
}

export async function checkVentureMemberViewAccess(db, ventureId, userRole, userCid) {
  if (["super_admin"].includes(userRole)) return true;
  if (!userCid) return false;
  if (await isVentureMember(db, ventureId, userCid)) return true;
  const code = await resolveVentureCode(db, ventureId);
  return hasAnyVentureAssignment(db, { ventureId: code, contactId: userCid });
}

export async function checkVentureMemberMutateAccess(db, ventureId, userRole, userCid) {
  if (["super_admin"].includes(userRole)) return true;
  if (!userCid) return false;
  if (await isVentureFounder(db, ventureId, userCid)) return true;
  const code = await resolveVentureCode(db, ventureId);
  return hasVentureCapability(db, { ventureId: code, contactId: userCid, area: "founders", action: "manage" });
}

export default {
  resolveVentureCode,
  getVentureFounderCount,
  isVentureMember,
  isVentureFounder,
  checkVentureMemberViewAccess,
  checkVentureMemberMutateAccess,
};
