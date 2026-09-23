/**
 * INVESTOR SELF-SERVICE OWN-SCOPE
 *
 * `requireInvestorSelfServiceAuthorization` admits a caller on role/capability,
 * or on the mere EXISTENCE of an investor profile. It says nothing about WHICH
 * resource the caller may touch. Everything here answers that second question:
 * bind a pipeline / workspace / document / request to the caller's own investor
 * profile, so one investor can never read or mutate another's data.
 *
 * Domain only — no HTTP. Routes turn a `false` into a 404.
 */

import {
  getDdDocumentById,
  getDdRequestInfoByRequestId,
  getInvestorProfileIdByUserId,
  getPipelineInvestorIdByPipelineId,
} from "@/models/investor";
import { getRelationshipWorkspaceDetail } from "@/models/investorRelations";

/** Roles that act on the WHOLE investor surface, not one investor's slice. */
const MANAGEMENT_ROLES = ["super_admin", "staff", "program_manager"];

export function isInvestorManagement(session) {
  return Boolean(session) && MANAGEMENT_ROLES.includes(session.role);
}

function sameOwner(ownerId, profileId) {
  if (ownerId === null || ownerId === undefined) return false;
  if (profileId === null || profileId === undefined) return false;
  return String(ownerId) === String(profileId);
}

/**
 * { management, profileId } for a session. `management` callers are not bound to
 * a single profile; a `profileId` of null with management=false means the caller
 * has investor access but no profile to scope to — the caller cannot be bound,
 * so routes must refuse.
 */
export async function resolveInvestorScope(session) {
  if (isInvestorManagement(session)) return { management: true, profileId: null };
  const userId = session?.cid || session?.id;
  if (!userId) return { management: false, profileId: null };
  const result = await getInvestorProfileIdByUserId(userId);
  return { management: false, profileId: result.rows?.[0]?.id ?? null };
}

/** True when `ownerId` (a row's investor_id) is the caller's own profile. */
export function isSameInvestor(ownerId, profileId) {
  return sameOwner(ownerId, profileId);
}

export async function investorOwnsPipeline(pipelineId, profileId) {
  const result = await getPipelineInvestorIdByPipelineId(pipelineId);
  return sameOwner(result.rows?.[0]?.investor_id, profileId);
}

export async function investorOwnsWorkspace(workspaceId, profileId) {
  const result = await getRelationshipWorkspaceDetail(workspaceId);
  return sameOwner(result.rows?.[0]?.investor_id, profileId);
}

export async function investorOwnsDdRequest(requestId, profileId) {
  const result = await getDdRequestInfoByRequestId(requestId);
  const pipelineId = result.rows?.[0]?.pipeline_id;
  if (!pipelineId) return false;
  return investorOwnsPipeline(pipelineId, profileId);
}

export async function investorOwnsDdDocument(docId, profileId) {
  const result = await getDdDocumentById(docId);
  const requestId = result.rows?.[0]?.request_id;
  if (!requestId) return false;
  return investorOwnsDdRequest(requestId, profileId);
}
