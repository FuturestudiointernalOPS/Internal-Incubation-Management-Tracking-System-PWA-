/**
 * VENTURE MEMBER ACCESS — who may see / change a Venture's roster.
 *
 * Shared by the membership route and the invitation route so the two can never
 * drift apart. Kept in the model layer because it is a domain rule about the
 * Venture, not an HTTP concern.
 *
 *   view   — the platform owner sees the roster; otherwise an active membership
 *            OR an active staff assignment on this Venture is required.
 *   mutate — founders manage the roster. Staff may too, but only when their
 *            assignment grants `founders:manage` (Lead Manager by default;
 *            Coach / Facilitator do not).
 */

import { hasVentureCapability, hasAnyVentureAssignment } from "@/services/ventures/permissions";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";
import { isPlatformOwnerRole } from "@/lib/identity";

/**
 * The identifier every Venture table keys on since Phase 0 (`ventures.id`),
 * from the access key the route carries. A code is resolved; an internal id
 * passes through. Same connection as the caller's, so an injected one stays in
 * control.
 */
export async function resolveVentureTableId(db, idOrRef) {
  return resolveVentureInternalId(idOrRef, db);
}

export async function getVentureFounderCount(db, ventureId) {
  const id = await resolveVentureTableId(db, ventureId);
  const result = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM venture_members WHERE venture_id = ? AND member_type = 'founder' AND removed_at IS NULL",
    args: [id],
  });
  return parseInt(result.rows?.[0]?.cnt || 0);
}

export async function isVentureMember(db, ventureId, cid) {
  const id = await resolveVentureTableId(db, ventureId);
  const result = await db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL LIMIT 1",
    args: [id, cid],
  });
  return result.rows?.length > 0;
}

export async function isVentureFounder(db, ventureId, cid) {
  const id = await resolveVentureTableId(db, ventureId);
  const result = await db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1",
    args: [id, cid],
  });
  return result.rows?.length > 0;
}

export async function checkVentureMemberViewAccess(db, ventureId, userRole, userCid) {
  if (isPlatformOwnerRole(userRole)) return true;
  if (!userCid) return false;
  if (await isVentureMember(db, ventureId, userCid)) return true;
  const id = await resolveVentureTableId(db, ventureId);
  return hasAnyVentureAssignment({ ventureId: id, contactId: userCid });
}

export async function checkVentureMemberMutateAccess(db, ventureId, userRole, userCid) {
  if (isPlatformOwnerRole(userRole)) return true;
  if (!userCid) return false;
  if (await isVentureFounder(db, ventureId, userCid)) return true;
  const id = await resolveVentureTableId(db, ventureId);
  return hasVentureCapability({ ventureId: id, contactId: userCid, area: "founders", action: "manage" });
}

export default {
  resolveVentureTableId,
  getVentureFounderCount,
  isVentureMember,
  isVentureFounder,
  checkVentureMemberViewAccess,
  checkVentureMemberMutateAccess,
};
