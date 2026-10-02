/**
 * Investor service — the relationship workspaces.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the own-scope
 * binding of a workspace (the id comes from the request, so a non-management
 * caller is pinned to their own investor profile), the list scope, and the
 * create / update orchestration with its timeline entries and the best-effort
 * introduction notification. Every statement lives in
 * `@/models/investorRelations`. No SQL, no HTTP: a refusal is a value
 * ({ ok: false, status, error }) the HTTP boundary turns into a response.
 */

import {
  getInvestorUserIdByProfileId,
  getPipelineById,
  getRelationshipWorkspaceDetail,
  insertWorkspaceCreatedTimeline,
  insertWorkspaceStatusChangedTimeline,
  listRelationshipWorkspaces,
  listWorkspaceMeetings,
  listWorkspaceTimeline,
  notifyIntroductionApproved,
  updateRelationshipWorkspace,
  upsertRelationshipWorkspace,
} from "@/models/investorRelations";
import {
  resolveInvestorScope,
  isSameInvestor,
} from "@/models/authorization/investorScope";

/**
 * The relationship workspaces a caller may list, or one workspace detail (with
 * its meetings and timeline). Management sees everything; every other caller is
 * scoped to their own investor profile, and a caller with no profile sees an
 * empty list. A detail that is not the caller's own is a 404.
 */
export async function listRelationshipsForViewer({ workspaceId, ventureId, session }) {
  const scope = await resolveInvestorScope(session);

  if (workspaceId) {
    // Bind the workspace to the caller before returning it (or its meetings /
    // timeline) — the id comes from the request.
    const workspaceResult = await getRelationshipWorkspaceDetail(workspaceId);
    const workspace = workspaceResult.rows[0] || null;
    if (!scope.management && !isSameInvestor(workspace?.investor_id, scope.profileId)) {
      return { ok: false, status: 404, error: "errors.notFound" };
    }

    const [meetings, timeline] = await Promise.all([
      listWorkspaceMeetings(workspaceId),
      listWorkspaceTimeline(workspaceId),
    ]);
    return {
      ok: true,
      detail: { workspace, meetings: meetings.rows, timeline: timeline.rows },
    };
  }

  // List workspaces — scoped to the caller's profile unless they manage.
  const investorId = scope.management ? null : scope.profileId;
  if (!scope.management && !investorId) {
    return { ok: true, workspaces: [] };
  }

  const result = await listRelationshipWorkspaces({ investorId, ventureId });
  return { ok: true, workspaces: result.rows };
}

/**
 * Create (or re-activate) the relationship workspace of a pipeline: upsert the
 * workspace for the pipeline's investor/venture, log the creation on the
 * timeline, then notify the investor — the notification is best-effort and never
 * blocks the write.
 */
export async function createRelationshipWorkspace({
  pipelineId,
  relationshipManagerId = null,
  investmentManagerId = null,
  session,
}) {
  if (!pipelineId) return { ok: false, status: 400, error: "pipeline_id required" };

  const pipelineResult = await getPipelineById(pipelineId);
  if (pipelineResult.rows.length === 0) {
    return { ok: false, status: 404, error: "Pipeline not found" };
  }
  const pipeline = pipelineResult.rows[0];

  const result = await upsertRelationshipWorkspace(
    pipelineId,
    pipeline.investor_id,
    pipeline.venture_id,
    relationshipManagerId || null,
    investmentManagerId || null,
  );
  const workspace = result.rows[0];

  await insertWorkspaceCreatedTimeline(workspace.id, session.cid || session.id);

  try {
    const investorInfo = await getInvestorUserIdByProfileId(workspace.investor_id);
    if (investorInfo.rows.length > 0) {
      await notifyIntroductionApproved(investorInfo.rows[0].user_id);
    }
  } catch (_) {}

  return { ok: true, workspace };
}

/**
 * Update a workspace (assign managers, move the stage, close) and, when the
 * status changed, log it on the timeline.
 */
export async function updateRelationshipWorkspaceWithTimeline({ id, fields, session }) {
  if (!id) return { ok: false, status: 400, error: "id required" };

  const result = await updateRelationshipWorkspace(id, fields);

  if (result.updated === false) return { ok: false, status: 400, error: "Nothing to update" };
  if (result.rows.length === 0) return { ok: false, status: 404, error: "Workspace not found" };

  if (fields.status) {
    await insertWorkspaceStatusChangedTimeline(
      id,
      `Workspace status changed to: ${fields.status}`,
      session.cid || session.id,
    );
  }

  return { ok: true, workspace: result.rows[0] };
}
