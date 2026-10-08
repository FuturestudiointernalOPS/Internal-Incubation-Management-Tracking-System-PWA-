/**
 * Investor service — the diligence request status transition.
 *
 * `update_request`: the own-request check, the per-role status policy, the
 * version-history append and the (best-effort) relationship-workspace timeline
 * entry. Every statement lives in `@/models/investor`. No SQL, no HTTP.
 */

import {
  getDdRequestInfoByRequestId,
  getDdRequestInfoForTimeline,
  getDdRequestVersionHistoryByRequestId,
  getRelationshipWorkspaceAssigneesByPipelineId,
  getRelationshipWorkspaceIdForStatusTimeline,
  insertDdStatusChangedTimeline,
  updateDdRequestResponse,
} from "@/models/investor";
import { canTransitionDiligenceStatus, diligenceTransitionRefusal } from "./status";
import { appendTransitionHistory } from "./questions";

/**
 * Move one information request to a new status, on behalf of the caller who owns
 * it. The Venture-side statuses are refused for a caller in investor context; a
 * refusal never writes anything.
 */
export async function updateDiligenceRequest({ payload, session, scope, ownsRequest, actor }) {
  const { request_id, status, response_text, response_file_url } = payload;
  if (!(await ownsRequest(request_id))) {
    return { ok: false, error: "errors.notFound", status: 404 };
  }

  const requestInfo = await getDdRequestInfoByRequestId(request_id);
  if (requestInfo.rows.length === 0) {
    return { ok: false, error: "Request not found", status: 404 };
  }
  const requestPipelineId = requestInfo.rows[0].pipeline_id;

  const relationshipWorkspaceResult =
    await getRelationshipWorkspaceAssigneesByPipelineId(requestPipelineId);
  const relationshipWorkspace = relationshipWorkspaceResult.rows[0] || {};
  const isRM = relationshipWorkspace.relationship_manager_id === actor;
  const isIM = relationshipWorkspace.investment_manager_id === actor;
  const isAdmin = session?.role === "super_admin";
  const isInvestorContext =
    !scope.management && scope.profileId !== null && scope.profileId !== undefined;

  if (!canTransitionDiligenceStatus({ status, isAdmin, isRM, isIM, isInvestorContext })) {
    return {
      ok: false,
      error: diligenceTransitionRefusal(status),
      status: 403,
    };
  }

  const versionHistoryResult = await getDdRequestVersionHistoryByRequestId(request_id);
  const newHistory = appendTransitionHistory(versionHistoryResult.rows[0], {
    toStatus: status,
    changedBy: actor,
    notes: response_text,
  });

  await updateDdRequestResponse({
    status,
    response_text,
    response_file_url,
    version_history: JSON.stringify(newHistory),
    request_id,
  });

  try {
    const timelineInfo = await getDdRequestInfoForTimeline(request_id);
    if (timelineInfo.rows.length > 0) {
      const relationshipWorkspaceForTimeline =
        await getRelationshipWorkspaceIdForStatusTimeline(timelineInfo.rows[0].pipeline_id);
      if (relationshipWorkspaceForTimeline.rows.length > 0) {
        await insertDdStatusChangedTimeline({
          workspace_id: relationshipWorkspaceForTimeline.rows[0].id,
          title: timelineInfo.rows[0].title,
          status,
        });
      }
    }
  } catch (_) {}

  return { ok: true };
}