/**
 * Investor service — the diligence workspace actions.
 *
 * `create_workspace`, `add_request` and `add_note`: the writes that create the
 * workspace, put a request in it (with its relationship-workspace timeline
 * entry), and leave an investor note. Every statement lives in
 * `@/models/investor`. No SQL, no HTTP.
 */

import {
  getDiligenceWorkspaceIdByPipelineId,
  getInvestorProfileIdByUserIdForNotes,
  getRelationshipWorkspaceIdByPipelineId,
  insertDdInformationRequest,
  insertDdRequestAddedTimeline,
  insertInvestorNote,
  updatePipelineStageToDueDiligence,
  upsertDiligenceWorkspace,
} from "@/models/investor";

/** Create (or reuse) the diligence workspace and move the pipeline to it. */
export async function createDiligenceWorkspace({ pipelineId }) {
  const workspaceResult = await upsertDiligenceWorkspace(pipelineId);
  await updatePipelineStageToDueDiligence(pipelineId);
  return { ok: true, workspace: workspaceResult.rows[0] };
}

/**
 * Put an information request in the pipeline's workspace. The relationship
 * workspace timeline entry is best-effort: a failure there must not fail the
 * request itself.
 */
export async function addDiligenceRequest({ pipelineId, payload }) {
  const { title, description, category, priority, due_date, owner_id } = payload;
  if (!title) return { ok: false, error: "title required", status: 400 };

  const workspaceLookup = await getDiligenceWorkspaceIdByPipelineId(pipelineId);
  if (workspaceLookup.rows.length === 0) {
    return { ok: false, error: "Workspace not found. Create it first.", status: 404 };
  }

  const requestResult = await insertDdInformationRequest({
    workspace_id: workspaceLookup.rows[0].id,
    title,
    description,
    category,
    priority,
    due_date,
    owner_id,
  });

  try {
    const relationshipWorkspaceResult = await getRelationshipWorkspaceIdByPipelineId(pipelineId);
    if (relationshipWorkspaceResult.rows.length > 0) {
      await insertDdRequestAddedTimeline({
        workspace_id: relationshipWorkspaceResult.rows[0].id,
        title,
        category,
      });
    }
  } catch (_) {}

  return { ok: true, request: requestResult.rows[0] };
}

/** Leave a note on the pipeline, stamped with the caller's investor profile. */
export async function addDiligenceNote({ pipelineId, payload, actor }) {
  const { content, note_type } = payload;
  if (!content) return { ok: false, error: "content required", status: 400 };

  const profileResult = await getInvestorProfileIdByUserIdForNotes(actor);
  const noteResult = await insertInvestorNote({
    investor_id: profileResult.rows[0]?.id,
    pipeline_id: pipelineId,
    note_type,
    content,
  });
  return { ok: true, note: noteResult.rows[0] };
}